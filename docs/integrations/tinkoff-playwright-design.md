# Tinkoff Retail via Playwright — design & implementation plan

> **Status (2026-04-28): connect flow stuck at "Введите пароль" screen. Anti-bot is fully bypassed (Phase 2: Xvfb + stealth landed). SMS arrives, gets typed, but the post-SMS branch detection in auth-flow is hardcoded for PIN-setup and silently misses the password screen. Next step is a screen-classifier state machine (see "Open work" section below).**
>
> POC at `scripts/probe-tinkoff-playwright.ts` was captured in early April with a freshly-bound device that went through PIN-setup. Real users with an existing LK password get a different post-SMS screen. The design assumed one linear path; reality is branching.

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

---

## Session log — 2026-04-27/28 smoke + anti-bot escalation

What happened end-to-end across one long debug session. Read this before touching the integration again — it captures every wall we hit and how we got past it.

### Phase 0 — initial smoke fails silently

Live connect against prod kept hanging in `NEEDS_OTP` with no log output. Adapter spawned a Playwright task in the background after `setStatus("NEEDS_OTP")`, and the task either silently leaked or never reached the SMS step. Three audit subagents flagged actual lifecycle defects which we landed before further smoke:

- `task` IIFE in `tinkoff-retail-playwright.ts:login` had no outer `.catch()`. A late rejection from `ctx.saveSecrets` / `ctx.setStatus("CONNECTED")` (the post-success path) crashed the Node process. Fixed: `.catch()` that classifies via `classifyAdapterError` and writes `setStatus("ERROR", code).catch(() => {})` — fire-and-forget, can't itself reject.
- `abortFn` only called `cancelSms`. The Chromium browser kept running on cancel/reconnect, leaking ~250MB per cycle. Fixed: capture `BrowserContext` in a closure variable inside `withTbankBrowser`'s callback; `abortFn` calls `activeBrowserCtx.close().catch(() => {})`.
- Two concurrent `launchPersistentContext` calls for the same `profileDir` raced on the fs lock. Fixed: module-level `_launchQueue: Map<string, Promise<unknown>>` in `browser.ts` keyed by `profileDir`, serializes same-credential launches; `prior.catch(() => {})` so a failed predecessor doesn't block.

Other small wins same session: `insufficient_privileges` and `invalid_credentials` i18n keys had copy-paste wording that didn't match their codes — corrected. Misleading hard-coded 6-digit OTP gate (`maxLength={6}`, `pattern="\d{6}"`, `code.length !== 6`, zod `\d{6}`) — loosened to 4-8 digits since T-Bank sends 4. `POST_OTP_STATUS_POLL_MS` 8s → 20s so the action waits long enough for the background task to reach `CONNECTED` on slow networks. `SENSITIVE_VALUE_PATTERNS` in `safe-error.ts` got a 4-digit-PIN redactor with char-class boundaries (so Cyrillic `пин`/`код` keywords also match). Server-side `[playwright-browser]` logs added for launch and callback failures (errors still rethrown).

Also added `submitOtp` auto-transition to `ERROR(session_expired)` when `pushSms` returns `false` after a server restart, so the credential doesn't dead-end in `NEEDS_OTP` with no path forward. UI gate uses `code.length !== 6 → < 4 || > 8` to match the new SMS length range.

### Phase 1 — phone field input mask

First real wall: phone POST submitted, redirect to `/auth/step?cid=...`, but the page rendered with title "Вход", body just "Вход Телефон", `headings=[]`, `buttons=[]`, and stayed there. We initially thought T-Bank's anti-bot was hiding the SMS form.

Owner correctly diagnosed: T-Bank's phone input has a `+7 (___) ___-__-__` mask, and `phoneInput.fill("+79118146000")` sets the value via the DOM setter — the masking layer treats the prepended `+7` as duplicate input and corrupts the result. Fixed: `pressSequentially(phoneDigits, { delay: 60 })` after stripping the `+7` prefix. The `Locator.fill` API is wrong for masked inputs in general; use keystroke simulation.

After this, `step3: phone field value="+7 (911) 814-60-00"` showed correctly and we reached the real SMS step.

### Phase 2 — anti-bot detection blocks the SMS form

Even with phone correctly typed, `/auth/step` rendered with the form `<input automation-id="phone-input" ... disabled>` plus `<button automation-id="button-submit" ... disabled>` plus a `_Overlay_tft13_26` spinner that never went away. T-Bank's SPA was detecting automation and refusing to render the SMS UI past a loading skeleton.

We ran phases against a fingerprint probe (`scripts/tbank-fingerprint-probe.ts`) hitting `bot.sannysoft.com`, `creepjs`, `browserleaks.com/javascript`. Results before any stealth:
- `userAgent` literally contained `HeadlessChrome/147.0.7727.15` (the single biggest tell).
- `webglRenderer = "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) ..."` — software renderer signature.
- `pluginsLength = 0`, `windowChromePresent = false`, `headlessTell = true` (Notification.permission==="denied" ∧ permissions==="prompt"), `languages = ["ru-RU"]` only, `hardwareConcurrency = 2`.

**Phase 1 attempt: `playwright-extra` + `puppeteer-extra-plugin-stealth`** didn't move any signal. The plugin "registers" but its evasions silently no-op for `playwright-extra` + `launchPersistentContext`. **Confirmed dead-end for our setup.** Kept the dependency wired with a `TBANK_BROWSER_ENGINE=vanilla` kill-switch and a lazy-init guard (`chromiumExtra.use(StealthPlugin())` at module top-level crashes Next.js's "Collecting page data" with `TypeError: n.typeOf is not a function`; deferred into a `getChromium()` helper). Also added `serverExternalPackages: ["playwright", "playwright-extra", "puppeteer-extra-plugin-stealth"]` to `next.config.ts` so Next doesn't bundle native-addon-adjacent CJS into server chunks.

**Phase 2: real Chromium under Xvfb** — the structural fix that worked.

- Dockerfile (runner stage): single apt layer adds `xvfb dbus-x11 fonts-liberation libgbm1 x11-utils` alongside existing `openssl ca-certificates`.
- Inline entrypoint script `/app/docker-entrypoint-xvfb.sh`: `trap "kill 0" EXIT` to reap on container exit, `Xvfb :99 -screen 0 1920x1080x24 -ac +extension RANDR -nolisten tcp &`, polls `xdpyinfo` up to 10s, exports `DISPLAY=:99`, runs `npx prisma migrate deploy`, then `exec npm run start` (so `node` is PID 1 and `docker stop` SIGTERM reaches Next, not `sh`).
- `docker-compose.prod.yml` (file lives at the **repo root**, NOT in `code/` — owner's local clone is structured so `code/` IS the repo root, which threw off one reviewer): `shm_size: 1gb` on the app service so multi-process Chromium doesn't blow past the default 64MB shm; `DISPLAY: ":99"` env defensively.
- `browser.ts` mode resolution: `opts.headless > PLAYWRIGHT_HEADLESS env > if DISPLAY then headed else headless`. `--no-sandbox` stays unconditional because the container runs as root (no `USER` directive); without it Chromium can't acquire namespaces in headed mode either.
- `[playwright-browser] mode: headless | headed display=:99` log on every launch.
- **Footgun caught here**: the probe script hardcoded `headless: true` in its `withTbankBrowser` opts, which masked the env resolution and made it look like Phase 2 had no effect. Removed.

Probe re-run after Phase 2:
- `userAgent`: `Chrome/147.0.0.0` (no more `HeadlessChrome`) ✅
- `pluginsLength`: 5 ✅
- `headlessTell`: false ✅
- `notificationPermission`: default ✅
- `webglRenderer`: still SwiftShader (no GPU on VPS, can't fix without hardware) ⚠️
- `hardwareConcurrency`: 2 (VPS hw) ⚠️
- `screenWidth/Height`: 1280/800 (matches Playwright viewport, not Xvfb 1920x1080 — minor) ⚠️

Five out of eight signals flipped, including the load-bearing UA. **T-Bank started serving the real SMS form.**

### Phase 3 — what we found inside the post-anti-bot flow

Once anti-bot stopped blocking:

**Phone step (step 3):** `<input automation-id="phone-input" type="tel" name="phone">` inside a form with `automation-id="login-form"`. Submit button has `automation-id="button-submit"` and is `disabled` until JS validates the value — `pressSequentially` triggers it correctly, `fill` does not.

**SMS step (step 4-6):** URL becomes `/auth/step?cid=<sessionToken>`. Page is a SPA — `body.innerText` returns "Вход Телефон" stub for several seconds before content streams in. `await page.waitForLoadState("networkidle", { timeout: 10_000 })` after the URL change is mandatory or the body dump is meaningless. Real SMS input is `input[autocomplete="one-time-code"]`. **T-Bank auto-submits when the last digit is typed via keystrokes — do NOT chase a submit button or press Enter afterwards;** by the time `pressSequentially` resolves, the input is detached from DOM and any follow-up locator action will hang for the full 30s default timeout. Wrap `pressSequentially` in `.catch()` so a fast auto-submit-detached-input failure logs but doesn't kill the flow.

**Post-SMS branch (THE WALL we're at now):** Tinkoff renders **one of several screens** depending on account state. POC saw a fresh device (PIN-setup screen). Owner's account has an existing LK password and saw `body: "Введите пароль | Пароль | Не помню пароль"`. We added a 4th connect field `lkPassword` (zod optional at boundary, adapter enforces non-empty for tinkoff-retail, returns `lk_password_required`) plumbed end-to-end through `connectAdapterAction → loginAction → adapter.login → runFullLogin`. The field name is deliberately `lkPassword` because `password` already means the 4-digit PIN at every layer of this codebase.

Persisted `lkPassword` is stored in `TinkoffPlaywrightSecrets.password` (encrypted via existing AES-256-GCM `encryptedPayload`). LK password is unbounded length, so `safe-error.ts` `SENSITIVE_VALUE_PATTERNS` would NOT redact it if it ever leaked into a Playwright error message verbatim. `SENSITIVE_KEYS` covers JSON-encoded leaks. Likely fine in practice but flagged for future hardening.

`auth-flow.ts` got step 6.5 (password screen probe) and step 7 was rewritten as a `Promise.race(pinScreenPromise, mybankPromise)` so a direct redirect after password entry doesn't hang waiting for a PIN-setup screen that never shows.

**Where it broke**: `step6.5` selector list `input[type="password"], input[autocomplete="current-password"], input[name="password"]` failed to match T-Bank's password input. Looking at the captured HTML from step 4, T-Bank uses a custom Input component where the phone field is `<input automation-id="phone-input" type="tel" name="phone">`. By the same convention, the password input is almost certainly `<input automation-id="password-input">` — likely with `type="text"` and CSS-only masking (`-webkit-text-security: disc`), which is why `type=password` doesn't match. We added `[automation-id="password-input"]` as the first selector in the chain, plus a body+input-attribute dump on the failure path so the next run pinpoints the exact attributes.

This change is **uncommitted** at the moment owner switched conversations — `lib/integrations/playwright/auth-flow.ts` has the wider selector and the diagnostic dump in step6.5's `if (!pwVisible)` branch. Owner stopped before commit because the linear-step approach is the wrong abstraction for this branching flow.

### Open work — screen-classifier state machine (THE NEXT IMPLEMENTATION)

**Stop treating step 6.5 / 7 / 8 / 9 as a fixed sequence.** After SMS submit, T-Bank can show any of the following screens, in any order, possibly more than once:

1. **password-screen** — `[automation-id="password-input"]` (or a fallback that needs to be discovered from a real probe). Heading "Введите пароль". Buttons "Войти" and "Не помню пароль". Action: type the LK password via `pressSequentially`, expect transition (auto-submit likely; if not, click form-scoped submit).
2. **pin-setup-screen** — 4+ inputs matching `input[inputmode="numeric"], input[autocomplete="one-time-code"]`. Heading typically "Придумайте PIN-код" or similar (POC saw this). Action: `fillPinInputs(page, pin)`.
3. **pin-confirm-screen** — same shape as pin-setup but after the first fill, heading like "Повторите PIN-код". Action: `fillPinInputs(page, pin)` again.
4. **fast-pin-screen** — same shape, different heading ("Введите PIN-код" for a returning device). Action: `fillPinInputs(page, pin)` (the SAVED pin from secrets, not the connect-form pin if they differ on relogin).
5. **mybank** — URL matches `/^https:\/\/www\.tbank\.ru\/mybank/`. Terminal. Action: capture `storageState`, return.
6. **captcha** — any of the captcha probes hits. Terminal. Action: throw `captcha_required`.
7. **error-screen** — visible heading "Ошибка" or specific error text ("Неверный код", "Превышено количество попыток", etc). Terminal. Action: classify and throw with code.
8. **push-confirm-screen** — heading like "Подтвердите вход в приложении" (NOT confirmed seen yet but T-Bank does this for new devices). Terminal-pending. Action: throw `push_confirmation_required` or a similar new code; UI tells user to open T-Bank Mobile and tap "Это я".
9. **unknown** — none of the above match within a short window. Action: dump body + inputs, throw `unknown_step`.

**Suggested shape** in `runFullLogin`:

```ts
type ScreenKind =
  | "password" | "pin_setup" | "pin_confirm" | "fast_pin"
  | "mybank" | "captcha" | "error" | "push_confirm" | "unknown";

async function classifyScreen(page: Page): Promise<{ kind: ScreenKind; meta?: object }> {
  // URL check first — cheapest signal.
  if (/^https:\/\/www\.tbank\.ru\/mybank/.test(page.url())) return { kind: "mybank" };
  // Then captcha probes (existing detectCaptcha logic).
  // Then attribute-based input detection: automation-id="password-input" → password.
  // Then numeric-input count >= 4 → pin (further classify by heading text into setup/confirm/fast).
  // Then heading text scan for error markers.
  // Else unknown.
}

async function actOn(page: Page, screen: ScreenKind, ctx: { phone, pin, password }): Promise<void> {
  switch (screen) {
    case "password": /* type password, optionally click submit */
    case "pin_setup":
    case "pin_confirm":
    case "fast_pin": /* fillPinInputs */
    case "captcha": throw new Error("captcha_required");
    case "error": throw new Error(<classified code>);
    case "push_confirm": throw new Error("push_confirmation_required");
    case "unknown": throw new Error("unknown_step");
    case "mybank": /* unreachable here, terminal */
  }
}

// Loop:
const MAX_TRANSITIONS = 8; // password → pin_setup → pin_confirm → mybank is at most 4
for (let i = 0; i < MAX_TRANSITIONS; i++) {
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
  const screen = await classifyScreen(page);
  if (screen.kind === "mybank") {
    // capture storageState, return
  }
  await actOn(page, screen.kind, ctx);
  // After each action, wait for SOMETHING to change — URL, primary input attribute,
  // or the spinner overlay to vanish. Use Promise.race of cheap signals with a short timeout.
}
throw new Error("too_many_transitions");
```

**Things to nail down before coding the state machine:**

- The exact `automation-id` on the password input. The next probe run with the diagnostic dump already in `step6.5`'s `if (!pwVisible)` branch (uncommitted) will print the input attribute list — get that first, hard-code the selector, then build the classifier.
- Whether T-Bank shows the password screen FIRST and then a PIN-setup/fast-PIN screen, or just password → mybank for accounts with a saved PIN. POC said PIN is mandatory; live behaviour for an existing account is unknown until the password step actually completes.
- Push-confirmation screen — does it appear for new browser fingerprints? Need an explicit selector and copy. Likely heading "Подтвердите вход" / "Это я".
- Whether `runFastLogin` (used for subsequent syncs after first connect) even needs the same state machine or whether a saved-cookies path is enough. Keep `runFastLogin` separate; the state machine is for `runFullLogin`.

### Other open items, smaller

- **Trim step 4 debug noise** in `auth-flow.ts`. Right now we dump body 3000 chars, html 4000 chars, tags, headings, buttons every login. Useful while diagnosing the SPA; once the state machine works, gate behind a `DEBUG_PLAYWRIGHT` env or remove.
- **Live-replace pattern** for fast iteration without redeploys: copy the modified .ts file via `docker cp` directly into `/app/lib/integrations/playwright/auth-flow.ts` inside the running container, then run the probe via `docker exec ... npx tsx scripts/tbank-fingerprint-probe.ts`. Avoids the 4-minute build cycle. Don't forget that a real `docker compose up -d --build` will overwrite this hot-patch — it's diagnostic-only.
- **`scripts/` is not in the prod image.** The Dockerfile copies `lib/`, `prisma/`, `.next/`, `public/`, etc. but not `scripts/`. To run a probe in prod we `mkdir /app/scripts` inside the container and `docker cp` the file in. Either accept that, or add `COPY scripts ./scripts` to the runner stage of the Dockerfile.
- **WebGL and hardwareConcurrency leaks** persist in headed Xvfb. Tinkoff hasn't punished us for them so far, but if they tighten their checks we'll need to spoof via init script (`Object.defineProperty(navigator, "hardwareConcurrency", { get: () => 8 })` and a WebGL `getParameter` override). Not urgent.
- **Xvfb sidecar vs in-container.** Currently Xvfb runs in the same container as Next.js. If we ever scale to multiple app replicas, a sidecar pattern is cleaner. Not a today problem.

### Files touched in this session

`code/lib/integrations/adapters/tinkoff-retail-playwright.ts`, `code/lib/integrations/adapters/tinkoff-retail.types.ts`, `code/lib/integrations/playwright/auth-flow.ts`, `code/lib/integrations/playwright/browser.ts`, `code/lib/integrations/types.ts`, `code/lib/data/_mutations/integrations.ts`, `code/app/(shell)/settings/integrations/actions.ts`, `code/lib/validation/integrations.ts`, `code/components/settings/integrations/integrations-manager.tsx`, `code/lib/integrations/safe-error.ts`, `code/lib/i18n/locales/{ru,en}.ts`, `code/Dockerfile`, `code/docker-compose.prod.yml`, `code/next.config.ts`, `code/package.json`, `code/scripts/tbank-fingerprint-probe.ts` (new).

### Commits that landed this session (chronological, on `main`)

- `f9f8390` fix(integrations): harden tinkoff retail playwright adapter for live smoke (lifecycle: outer .catch, abortFn closes browser, _launchQueue serialisation, selector fallbacks, captcha probes)
- `26120ad` fix(integrations): close gaps from holistic tinkoff playwright review (NEEDS_OTP dead-end, OTP UX, POST_OTP_STATUS_POLL_MS bump, [playwright-browser] logs, PIN redaction in safe-error)
- `3e92537` fix(integrations): type tinkoff phone via pressSequentially through input mask
- `42ad74b` chore(integrations): add diagnostic logs to tinkoff playwright auth-flow
- `ef5bcff` chore(integrations): dump page title and body at /auth/step for diagnostics
- `3d53821` chore(integrations): wait for SPA networkidle and dump headings/buttons
- `61d1c58` chore(integrations): dump custom tag counts and main outerHTML at /auth/step
- `88be2e9` fix(integrations): stealth flags so tinkoff /auth/step SPA renders (initial hand-rolled --disable-blink-features + addInitScript — kept the launch flag, dropped the manual addInitScript when stealth plugin landed)
- `1b97a36` chore(integrations): fingerprint probe script for tbank anti-bot diagnosis
- `0a25f11` feat(integrations): playwright-extra + stealth plugin for tinkoff anti-bot
- `c671470` fix(integrations): lazy stealth init so next.js page-data collection survives
- `be4116a` feat(integrations): xvfb headed chromium for tinkoff anti-bot evasion
- `70ee127` chore(integrations): drop forced headless:true in tinkoff fingerprint probe
- `fac013d` fix(integrations): accept 4-8 digit OTP codes (tinkoff sends 4)
- `4201eda` chore(integrations): full step6-10 logging in tinkoff auth-flow
- `358f071` fix(integrations): type tinkoff SMS code via keystrokes, drop manual submit
- `7f009ae` feat(integrations): collect t-bank LK password as third connect field

### Uncommitted at conversation handoff

- `lib/integrations/playwright/auth-flow.ts`: step 6.5 selector chain extended with `[automation-id="password-input"]` as the first probe, plus an input-attributes + body dump on `if (!pwVisible)` failure path. `step6.5` waitFor timeout was 10s. Owner asked for state-machine refactor before committing this.

### Workflow lessons for the next session

- **Don't skip reviewer.** Phase 1 stealth-plugin commit broke prod build (`TypeError: n.typeOf is not a function` at Next.js page-data collection) because reviewer was skipped "to save time". Reviewer would have caught the module-load side-effect.
- **One coder pass per architectural change**, not three small ones. Coordinated changes across Dockerfile + compose + browser.ts in one prompt → one review → one deploy is much cheaper than iterating.
- **Live-replace via `docker cp` for probe iterations.** 4-minute rebuild cycles are fine for committed work; for diagnostic dumps that change one file, `docker cp` straight into the running container is 10x faster.
- **Russian to owner, English in subagent prompts** — already in CLAUDE.md but worth re-stating; this session followed it.
