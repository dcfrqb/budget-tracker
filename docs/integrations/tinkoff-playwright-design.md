# Tinkoff Retail via Playwright — design & implementation plan

> Status: phases A1–C implemented and committed. Awaiting prod smoke (live SMS/PIN flow + selector tuning). POC at `scripts/probe-tinkoff-playwright.ts` confirmed end-to-end auth + cookie capture works.

## Why Playwright, not raw HTTP

T-Bank web auth (`id.tbank.ru/auth/step?cid=...`) sends gzip-compressed POST bodies (`content-length: 1436`, `content-encoding: gzip`) carrying device fingerprint + anti-bot scores + CSRF tokens. Open-source clients that replicate this in raw HTTP get blocked within weeks because the fingerprint is unforgeable from Node. Playwright launches a real Chromium → server is indistinguishable from a normal user browser.

Past attempts and why they fail:
- Raw HTTP with field set: works for ~6 months, breaks on next Tinkoff anti-bot iteration.
- BYO-cookie: requires user to copy session every ~30 min — rejected by owner.
- Tinkoff Business OAuth: only for юрлиц, not retail.
- WebView in our app: same-origin policy blocks reading tbank.ru cookies.

## End-state architecture

```
[user]                    [our Next.js server]                [headless Chromium]
  │                              │                                   │
  │ POST /connect                │                                   │
  │ {phone, pin}                 │                                   │
  │─────────────────────────────►│                                   │
  │                              │ spawn Playwright                  │
  │                              │──────────────────────────────────►│
  │                              │                                   │ goto tbank.ru/login
  │                              │                                   │ fill phone
  │                              │                                   │ wait /auth/step (SMS)
  │                              │◄──────────────────────────────────│ status:NEEDS_OTP
  │ status:NEEDS_OTP             │                                   │
  │◄─────────────────────────────│                                   │
  │ enter SMS code               │                                   │
  │ POST /submit-otp             │                                   │
  │─────────────────────────────►│ pass to Playwright                │
  │                              │──────────────────────────────────►│ fill SMS
  │                              │                                   │ wait /auth/step (PIN)
  │                              │                                   │ fill PIN
  │                              │                                   │ wait redirect to mybank
  │                              │◄──────────────────────────────────│ extract cookies
  │                              │ encrypt + persist                 │
  │                              │ close browser                     │
  │ status:CONNECTED             │                                   │
  │◄─────────────────────────────│                                   │

[next sync — no SMS needed thanks to PIN + saved device cookies]
  │ POST /sync                   │                                   │
  │─────────────────────────────►│ spawn Playwright                  │
  │                              │──────────────────────────────────►│ ctx.addCookies(saved)
  │                              │                                   │ goto tbank.ru/mybank
  │                              │                                   │ if PIN screen → fill PIN
  │                              │                                   │ extract sessionid+wuid from URL
  │                              │                                   │ fetch /api/common/v1/operations
  │                              │◄──────────────────────────────────│ rows + fresh cookies
  │                              │ map → ImportRow → Transaction     │
```

## Why PIN matters

T-Bank flow at `id.tbank.ru/auth/step?cid=...` is a state machine with three steps:

1. **phone** → server sends SMS
2. **SMS confirm** → server requires PIN setup
3. **PIN set** → completes auth, sets device-trust cookie

Skipping step 3 (clicking "Не сейчас") gives `unknown auth scenario` — the OAuth callback to mybank fails. So PIN is mandatory part of the chain.

The PIN binds to the device (= browser cookies). Once set:
- Same browser + same PIN → fast-login flow shows the 4-digit-PIN screen instead of phone entry
- No SMS needed on subsequent sessions

For our adapter:
- User enters PIN in connect form (their choice, e.g. their app PIN or a separate one).
- We persist PIN encrypted alongside sessionid/wuid/cookies in `IntegrationCredential.encryptedPayload`.
- On every sync: load cookies → if T-Bank shows fast-PIN screen, fill the saved PIN → success without SMS.
- If cookies fully expired (months later): T-Bank falls back to full SMS flow → we re-prompt user.

## DB schema

`IntegrationCredential.encryptedPayload` (TS shape) becomes:
```ts
type TinkoffPlaywrightSecrets = {
  phone: string;                 // canonical +7XXXXXXXXXX
  pin: string;                   // 4 digits chosen by user, AES-encrypted at rest
  cookies: Cookie[];             // Playwright cookie objects (domain, name, value, path, expires, httpOnly, secure, sameSite)
  storageState?: string;         // optional: Playwright storage_state JSON if simpler than raw cookies
  lastFastLoginAt?: number;      // ms — when PIN-only login last succeeded
  lastFullLoginAt?: number;      // ms — when SMS+PIN flow last ran
};
```

No Prisma migration needed — `encryptedPayload` is opaque blob.

`IntegrationAccountLink` (already in schema) stores `(credentialId, externalAccountId, accountId, label)` — used as-is.

## Files to create / change

### New
- `code/lib/integrations/playwright/browser.ts` — `withTbankBrowser(fn)` helper: launches Chromium with persistent profile dir keyed by credentialId, applies cookies, runs callback, captures fresh cookies, closes.
- `code/lib/integrations/playwright/auth-flow.ts` — `runFullLogin({phone, pin, smsResolver})`, `runFastLogin({pin})`. `smsResolver` is async fn that lets server suspend until UI submits SMS via OTP form.
- `code/lib/integrations/adapters/tinkoff-retail-playwright.ts` — replaces `tinkoff-retail.ts`. Implements `BankAdapter`: `login`, `submitOtp`, `listExternalAccounts`, `fetchTransactions`, `refreshSession`, `disconnect`.
- `code/lib/integrations/playwright/sms-channel.ts` — in-memory pending-SMS map keyed by credentialId, with promise-based wait. Used by adapter to bridge UI submitOtp → Playwright.

### Modify
- `code/lib/integrations/adapters/tinkoff-retail.ts` — DELETE (replaced).
- `code/lib/integrations/adapters/tinkoff-retail.client.ts` — DELETE (was raw HTTP).
- `code/lib/integrations/adapters/tinkoff-retail.types.ts` — replace `TinkoffSecrets` with `TinkoffPlaywrightSecrets`.
- `code/lib/integrations/registry.ts` — point to new adapter.
- `code/lib/integrations/types.ts` — no change.
- `code/lib/data/_mutations/integrations.ts` — `submitOtpForCredential` now writes SMS code into `sms-channel.ts` map instead of calling adapter.submitOtp directly. Adapter's submitOtp is no longer called from action — Playwright is already running and waiting.
- `code/components/settings/integrations/integrations-manager.tsx` — Connect dialog must accept BOTH `phone` AND `pin` for `tinkoff-retail-playwright` adapter (new field).
- `code/lib/validation/integrations.ts` — `connectTinkoffRetailSchema` adds `pin: z.string().regex(/^\d{4}$/)`.
- `code/lib/i18n/locales/{ru,en}.ts` — add keys: `settings.integrations.form.pin`, `settings.integrations.form.pin_hint`, `settings.integrations.tinkoff_retail.action.refresh_pin`.
- `code/Dockerfile` — install Playwright + Chromium (`RUN npx playwright install chromium --with-deps`). Image grows to ~700MB.
- `code/package.json` — `playwright` already devDependency; move to dependency since prod runs it.

## State machine — connect flow

`integration_credentials` already has `status: NEEDS_OTP`. Use it.

| event                            | from              | to            | side-effect                                                         |
|----------------------------------|-------------------|---------------|---------------------------------------------------------------------|
| connect (phone+pin)              | -                 | NEEDS_OTP     | spawn Playwright in detached process; reach SMS-step; emit otp-wait |
| user-submit-otp                  | NEEDS_OTP         | (transient)   | push code to sms-channel; Playwright resolves, fills, hits PIN-step |
| Playwright fills PIN, sees mybank| (transient)       | CONNECTED     | extract cookies; encrypt; save secrets; kill Playwright             |
| sync                             | CONNECTED         | CONNECTED     | spawn Playwright; load cookies; fast-PIN if needed; fetch operations|
| cookies fully invalidated        | CONNECTED         | NEEDS_OTP     | wipe cookies; require user to repeat connect                        |

Pending Playwright per credential:
- Stored in module-level `Map<credentialId, { browserPromise, smsResolver }>`.
- Lifetime: created on connect, destroyed on submitOtp success or 5-min timeout.
- This works because integrations are admin-only single-user — no horizontal scaling concerns.

## Cookie persistence trick

Playwright's `context.storageState()` returns the entire cookie + localStorage snapshot as JSON. Save the WHOLE blob, not individual cookies. On sync, `chromium.launch().newContext({ storageState: JSON.parse(blob) })` restores everything in one line.

Pro: works for any cookie change Tinkoff makes — we don't have to enumerate names.
Con: blob can be large (50-200KB per credential). AES-GCM encrypted that's fine.

## Anti-bot etiquette

To stay under T-Bank's bot-detection threshold:
- Use `headless: false` if Chromium has DISPLAY available, else `headless: true` with `--no-sandbox`. (On our Linux VPS, headless+xvfb).
- Reuse the SAME persistent profile directory across syncs for one credential — keeps cookies, cache, storage. Path: `/var/lib/budget-tracker/playwright-profiles/<credentialId>/`. Mount as docker volume.
- Throttle: never more than 1 sync per credential per 5 min (already enforced by `MIN_INTERVAL_MS_PER_ADAPTER`).
- Add small `await page.waitForTimeout(800 + Math.random()*400)` between actions to look human.
- Spoof viewport `1280×800`, locale `ru-RU`, tz `Europe/Moscow`.
- Reuse User-Agent that Playwright Chromium sets by default — DO NOT override (Playwright's UA matches a real Chromium build).

## Production infrastructure

Dockerfile change:
```dockerfile
# After existing Node setup
RUN npx playwright install chromium --with-deps
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Volume for persistent browser profiles
VOLUME ["/var/lib/budget-tracker/playwright-profiles"]
```

`docker-compose.prod.yml`:
```yaml
services:
  app:
    volumes:
      - playwright-profiles:/var/lib/budget-tracker/playwright-profiles
volumes:
  playwright-profiles:
```

Memory: prod VPS has X GB RAM (check). Each Playwright sync ≈ 250MB. With single-user and 5-min throttle, never concurrent.

## Risks

1. **Tinkoff blocks our VPS IP** if they detect repeated server-side automation. Mitigation: profile-persistence (looks like a returning user), reasonable delays, low frequency.
2. **PIN-screen flow change.** If Tinkoff redesigns the fast-login UI, our selector breaks. Selectors should target stable attributes (input[autocomplete=one-time-code] or aria-label) not visual classes.
3. **Captcha showup.** If Tinkoff shows a captcha on suspicious activity, we have no path forward. Adapter detects captcha element → sets status NEEDS_OTP with errorMessage `captcha_required`, requires manual intervention.
4. **Headless Chromium crashes.** Wrap in try/finally that always closes browser. Track zombie process count via metrics if we add observability later.

## Out of scope for first implementation

- Multi-user support (we're admin-only single-user)
- Proxy rotation (single VPS for now)
- Captcha solving (manual fallback)
- Concurrent syncs (rate-limit prevents)

## Implementation status (2026-04-27)

Phases A1–C plus follow-up polish are merged on `main`. Open work is the live smoke and any selector tuning that follows.

- **A1 — foundation** (`da9defd`): `playwright/sms-channel.ts`, `playwright/browser.ts`, `playwright` moved to `dependencies` (pinned `1.59.1`).
- **A2 — auth-flow + adapter** (`0fac521`): `auth-flow.ts`, `session-registry.ts`, `tinkoff-retail-playwright.ts`, parser extraction, types rewrite, registry retarget. Old `tinkoff-retail.ts` and `tinkoff-retail.client.ts` deleted.
- **B — UI/validation/action/i18n** (`07f1f78`): PIN field with InfoCallout, `connectTinkoffRetailSchema` requires 4-digit PIN, `submitOtpForCredential` polls `session.promise` 8s for tinkoff-retail. RU+EN keys with parity.
- **C — infra** (`79d20e7`): Dockerfile and runner switched to `node:20-bookworm-slim` (Alpine doesn't run Chromium); `npx playwright install chromium --with-deps`; `playwright-profiles` named volume.
- **Polish**: mapping fidelity (`7f080b2` — rawCategory / cardLast4 / Math.abs+toFixed), error pipeline propagation (`3b5f44b`), exception classification (`29fd273`), `PLAYWRIGHT_HEADLESS` env override (`5d2ee6c`), env example (`f4d1ede`), `<code>: <details>` tolerance in mapAdapterError + circuit_open key (`000f504`), profileDirFor extraction (`83ed496`).

### Smoke checklist (next session)

1. Owner runs `npm install` in `code/` to regenerate `package-lock.json` (playwright now in deps), commits, pushes.
2. Local `docker compose -f docker-compose.prod.yml build app` to confirm Chromium installs cleanly in the bookworm-slim image.
3. Deploy: `ssh root@217.60.5.138 'cd /opt/budget-tracker && git pull origin main && docker compose -f docker-compose.prod.yml up -d --build'`.
4. In `/settings/integrations`, click Connect on `tinkoff-retail`, fill phone + chosen PIN. Expect status NEEDS_OTP.
5. Enter SMS code. Expect status CONNECTED within ~8s (background task finishes PIN+redirect).
6. Open "Manage links", select internal accounts for the external ones, save.
7. Click "Sync". Expect transactions imported.
8. **If any step fails**: errors in `cred.lastErrorMessage` are now translated. Tail logs via `docker compose logs -f app | grep playwright-browser`. For visible-Chromium debugging set `PLAYWRIGHT_HEADLESS=false` and `PLAYWRIGHT_PROFILES_DIR=/tmp/...` in dev, run locally against staged Tinkoff.
9. Selector tuning in `auth-flow.ts` is the most likely follow-up — POC was captured in early April, live UI may have drifted.

Estimated remaining effort: 1–2 selector iterations, ~30 min each.

## Reference: POC findings

POC `scripts/probe-tinkoff-playwright.ts` proved:
- Playwright Chromium → tbank.ru/login → full OAuth dance → id.tbank.ru/auth/step → SMS → PIN → mybank works end-to-end.
- After auth, `sessionid` and `wuid` appear in every API URL — extract via response handler or by reading `cookies()`.
- `accounts_light_ib` returns 200 at base auth level (use this, not `accounts_flat` which needs level 35).
- PIN setup is mandatory — clicking "Не сейчас" returns `unknown auth scenario`.

Live capture from POC (sample for reference):
- `sessionid=JkvvUtuuqKb37OEz2jzVi6yLx11w5Gcr.authenticon-5b8fcf7649-2lqzk`
- `wuid=37e3cc9953b3a771dcd757b8b2eb9f47`
- Cookies visible: `SSO_SESSION`, `SSO_SESSION_STATE`, `__P__wuid`, `sso_uaid`, `sso_user_id`, `api_sso_id`, `navi_token`, `tid_cid_timestamp`, `pcId`, `userType`, etc. — 15-20 cookies on `tbank.ru` and `id.tbank.ru` domains.
