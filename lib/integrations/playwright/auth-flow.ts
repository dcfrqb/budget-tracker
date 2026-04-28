import type { Page, Locator } from "playwright";
import { humanDelay } from "./browser";

export type SmsResolver = () => Promise<string>;

// ─── State machine types ───────────────────────────────────────

type ScreenKind =
  | "password"
  | "pin_setup"
  | "pin_confirm"
  | "fast_pin"
  | "mybank"
  | "captcha"
  | "error"
  | "push_confirm"
  | "unknown";

type ClassifiedScreen = {
  kind: ScreenKind;
  meta?: {
    url: string;
    headingText?: string;
    inputAttrs?: Array<Record<string, string | null>>;
    errorCode?: string;
    matchedSelector?: string;
  };
};

type ActOnContext = { phone: string; pin: string; password?: string };

export type TinkoffSessionAuth = { sessionid: string; wuid: string };

// Cookie name candidates for the sessionid URL param. POC capture had value
// "JkvvUt....authenticon-..." which matches JSESSIONID/SpringSecurity sticky-route
// format. Live diagnostic 2026-04-28 confirmed there is no cookie literally named
// "sessionid"; SSO_SESSION is the most plausible match per design-doc cookie list.
const COOKIE_NAME_SESSIONID_CANDIDATES = [
  "SSO_SESSION",
  "sso_api_session",
  "psid",
  "ssoId",
  "api_sso_id",
  "sessionid",
];
const COOKIE_NAME_WUID_CANDIDATES = ["__P__wuid", "wuid"]; // confirmed __P__wuid

export async function extractSessionAuth(page: Page): Promise<TinkoffSessionAuth> {
  const cookies = await page.context().cookies();
  const tbankCookies = cookies.filter((c) => /(^|\.)tbank\.ru$/.test(c.domain));
  const names = tbankCookies.map((c) => c.name).sort();
  log(`extractSessionAuth: cookies after auth: ${JSON.stringify(names)}`);

  const findOne = (candidates: string[]) =>
    candidates
      .map((n) => tbankCookies.find((c) => c.name === n))
      .find((c) => c !== undefined);

  const sessionCookie = findOne(COOKIE_NAME_SESSIONID_CANDIDATES);
  const wuidCookie = findOne(COOKIE_NAME_WUID_CANDIDATES);

  if (sessionCookie && wuidCookie) {
    const preview = (v: string) => `${v.slice(0, 6)}…(len=${v.length})`;
    log(
      `extractSessionAuth: cookie path won — sessionid<-${sessionCookie.name}=${preview(sessionCookie.value)} wuid<-${wuidCookie.name}=${preview(wuidCookie.value)}`,
    );
    return { sessionid: sessionCookie.value, wuid: wuidCookie.value };
  }

  log(
    `extractSessionAuth: cookie path FAILED sid_found=${Boolean(sessionCookie)} wuid_found=${Boolean(wuidCookie)} — falling back to traffic listener`,
  );
  return harvestSessionAuthFromTraffic(page);
}

export async function harvestSessionAuthFromTraffic(
  page: Page,
  opts: { timeout?: number } = {},
): Promise<TinkoffSessionAuth> {
  const timeout = opts.timeout ?? 8_000;
  log(`harvestSessionAuthFromTraffic: armed listener, timeout=${timeout}ms`);
  const req = await page.waitForRequest(
    (r) => /tbank\.ru\/api\//.test(r.url()) && /[?&]sessionid=/i.test(r.url()),
    { timeout },
  );
  const u = new URL(req.url());
  const sessionid = u.searchParams.get("sessionid") ?? "";
  const wuid = u.searchParams.get("wuid") ?? "";
  if (!sessionid || !wuid) {
    log(
      `harvestSessionAuthFromTraffic: matched URL but missing params sid_present=${Boolean(sessionid)} wuid_present=${Boolean(wuid)}`,
    );
    throw new Error("tinkoff_session_cookies_missing");
  }
  const preview = (v: string) => `${v.slice(0, 6)}…(len=${v.length})`;
  log(
    `harvestSessionAuthFromTraffic: source=request sessionid=${preview(sessionid)} wuid=${preview(wuid)}`,
  );
  return { sessionid, wuid };
}

const MAX_TRANSITIONS = 8;
const NETWORKIDLE_TIMEOUT_MS = 5_000;
const WAIT_FOR_CHANGE_TIMEOUT_MS = 8_000;
const CLASSIFIER_PROBE_TIMEOUT_MS = 1_500;
const DEBUG = process.env.DEBUG_PLAYWRIGHT !== "false";
const LOG_PREFIX = "[playwright-tbank]";
const log = (msg: string) => console.log(`${LOG_PREFIX} ${msg}`);

// ─── Password-redacting helpers ────────────────────────────────

function redactPassword(s: string, password: string | undefined): string {
  if (!password || !s) return s;
  const escaped = password.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return s.replace(new RegExp(escaped, "g"), "[REDACTED_PW]");
}

async function typePasswordSafely(locator: Locator, password: string): Promise<void> {
  try {
    await locator.pressSequentially(password, { delay: 60 });
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    const wrapped = new Error(redactPassword(raw, password));
    if (err instanceof Error) wrapped.name = err.name;
    throw wrapped;
  }
}

// ─── Screen diagnostics ────────────────────────────────────────

async function logScreenDiagnostics(page: Page, label: string): Promise<void> {
  if (!DEBUG) return;
  const url = page.url();
  const title = await page.title().catch(() => "?");
  const headings = await page
    .locator("h1, h2, h3, [role=heading]")
    .evaluateAll((nodes) => nodes.map((n) => (n as HTMLElement).innerText.trim()).filter(Boolean))
    .catch(() => [] as string[]);
  const inputAttrs = await page
    .locator("input")
    .evaluateAll((nodes) =>
      nodes.map((el) => {
        const input = el as HTMLInputElement;
        return {
          type: input.type,
          name: input.name,
          autocomplete: input.autocomplete,
          automationId: input.getAttribute("automation-id"),
          placeholder: input.placeholder,
          ariaLabel: input.getAttribute("aria-label"),
          inputmode: input.getAttribute("inputmode"),
        };
      }),
    )
    .catch(() => [] as unknown[]);
  const bodyText = await page
    .locator("body")
    .innerText({ timeout: 2000 })
    .catch(() => "?");
  log(
    `${label}: url=${url} title="${title}" headings=${JSON.stringify(headings)} inputs=${JSON.stringify(inputAttrs)} body(600)=${bodyText.slice(0, 600).replace(/\s+/g, " ")}`,
  );
}

// ─── Captcha detection ─────────────────────────────────────────

async function detectCaptcha(page: Page): Promise<void> {
  const probes = [
    () => page.locator('iframe[title*="captcha" i]').isVisible({ timeout: 1000 }),
    () => page.locator('iframe[src*="captcha" i]').isVisible({ timeout: 1000 }),
    () => page.getByRole("dialog").filter({ hasText: /проверка|captcha/i }).isVisible({ timeout: 1000 }),
    () => page.getByText(/проверка|captcha/i).isVisible({ timeout: 1000 }),
    () => page.locator('[class*="recaptcha" i]').isVisible({ timeout: 1000 }),
    () => page.locator('[class*="hcaptcha" i]').isVisible({ timeout: 1000 }),
    () => page.locator('[id*="captcha" i]').isVisible({ timeout: 1000 }),
  ];
  const results = await Promise.all(
    probes.map(async (probe) => {
      try {
        return await probe();
      } catch {
        return false;
      }
    }),
  );
  if (results.some(Boolean)) {
    throw new Error("captcha_required");
  }
}

// ─── Screen classifier ─────────────────────────────────────────

async function classifyScreen(page: Page): Promise<ClassifiedScreen> {
  const url = page.url();

  // 1. mybank URL check
  if (/tbank\.ru\/mybank/i.test(url) && !/\/auth\//.test(url)) {
    log(`classify: kind=mybank url=${url}`);
    return { kind: "mybank", meta: { url } };
  }

  // 2. captcha probe (convert throw to classification)
  try {
    await detectCaptcha(page);
  } catch {
    log(`classify: kind=captcha url=${url}`);
    return { kind: "captcha", meta: { url } };
  }

  // 3. heading text probe
  const headingText = await page
    .locator("h1, h2, h3, [role=heading]")
    .first()
    .innerText({ timeout: CLASSIFIER_PROBE_TIMEOUT_MS })
    .catch(() => "");

  // 4. numeric input count → pin family
  const numericInputCount = await page
    .locator('input[inputmode="numeric"], input[autocomplete="one-time-code"]')
    .count()
    .catch(() => 0);

  if (numericInputCount >= 4) {
    const pinBody = await page
      .locator("body")
      .innerText({ timeout: 1500 })
      .catch(() => "");
    const pinBodySnippet = pinBody.slice(0, 300).replace(/\s+/g, " ").trim();
    let kind: ScreenKind = "pin_setup";
    if (/повторите|подтвердите|ещё\s+раз|еще\s+раз/i.test(headingText) || /повторите|подтвердите|ещё\s+раз|еще\s+раз/i.test(pinBody)) {
      kind = "pin_confirm";
    } else if (/введите\s*pin|введите\s*пин|быстрый\s+вход/i.test(headingText) || /введите\s*pin|введите\s*пин/i.test(pinBody)) {
      kind = "fast_pin";
    } else if (/придумайте|задайте|создайте/i.test(headingText)) {
      kind = "pin_setup";
    }
    log(`classify: kind=${kind} url=${url} heading="${headingText}" numericInputs=${numericInputCount} bodySnippet="${pinBodySnippet}"`);
    return { kind, meta: { url, headingText, matchedSelector: 'input[inputmode="numeric"], input[autocomplete="one-time-code"]' } };
  }

  // 5. password input chain
  const passwordSelectors = [
    '[automation-id="password-input"]',
    'input[type="password"]',
    'input[autocomplete="current-password"]',
    'input[name="password"]',
  ];
  for (const sel of passwordSelectors) {
    const visible = await page
      .locator(sel)
      .first()
      .isVisible({ timeout: CLASSIFIER_PROBE_TIMEOUT_MS })
      .catch(() => false);
    if (visible) {
      log(`classify: kind=password url=${url} heading="${headingText}" matchedSelector="${sel}"`);
      return { kind: "password", meta: { url, headingText, matchedSelector: sel } };
    }
  }

  // 6. push confirmation heading (RUNTIME-PROBE: best guess copy)
  const pushVisible = await page
    .getByText(/подтвердите\s+вход|это\s+я|откройте\s+приложение/i)
    .first()
    .isVisible({ timeout: CLASSIFIER_PROBE_TIMEOUT_MS })
    .catch(() => false);
  if (pushVisible) {
    log(`classify: kind=push_confirm url=${url} heading="${headingText}"`);
    return { kind: "push_confirm", meta: { url, headingText } };
  }

  // 7. error heading
  if (/ошибка/i.test(headingText)) {
    const bodyText = await page
      .locator("body")
      .innerText({ timeout: 2000 })
      .catch(() => "");
    let errorCode = "unknown_step";
    if (/неверн.*код|invalid.*otp|неправильн.*код/i.test(bodyText)) errorCode = "invalid_otp";
    else if (/слишком\s+много.*попыт|превышено.*попыт/i.test(bodyText)) errorCode = "too_many_attempts";
    else if (/неверн.*пароль|invalid.*password/i.test(bodyText)) errorCode = "invalid_password";
    log(`classify: kind=error url=${url} heading="${headingText}" errorCode=${errorCode}`);
    return { kind: "error", meta: { url, headingText, errorCode } };
  }

  // 8. unknown — dump diagnostics
  await logScreenDiagnostics(page, "classify-unknown");
  return { kind: "unknown", meta: { url, headingText } };
}

// ─── PIN input filler ──────────────────────────────────────────

async function fillPinInputs(page: Page, pin: string): Promise<void> {
  const pinLocator = page.locator('input[inputmode="numeric"], input[autocomplete="one-time-code"]');
  const count = await pinLocator.count();
  log(`fillPinInputs: count=${count} pinLen=${pin.length}`);

  if (count >= 4) {
    for (let i = 0; i < pin.length && i < count; i++) {
      const digitInput = pinLocator.nth(i);
      try {
        await digitInput.pressSequentially(pin[i], { delay: 60, timeout: 3_000 });
        log(`fillPinInputs[${i}]: keystroke ok`);
      } catch (err) {
        log(`fillPinInputs[${i}]: pressSequentially failed: ${err instanceof Error ? err.message : String(err)}`);
        throw err;
      }
    }
  } else {
    await pinLocator.first().pressSequentially(pin, { delay: 60, timeout: 5_000 });
    log(`fillPinInputs: combined-input keystroke ok`);
  }
}

// ─── Act on classified screen ──────────────────────────────────

async function actOn(page: Page, screen: ClassifiedScreen, ctx: ActOnContext): Promise<void> {
  switch (screen.kind) {
    case "password": {
      const sel = screen.meta?.matchedSelector ?? '[automation-id="password-input"]';
      const urlBefore = page.url();
      log(`actOn[password]: about to type password at URL=${urlBefore} selector="${sel}"`);
      if (!ctx.password) throw new Error("lk_password_required");
      const pwLocator = page.locator(sel).first();
      await pwLocator.click().catch((err) => {
        log(
          `actOn[password]: click failed (continuing): ${err instanceof Error ? err.message : String(err)}`,
        );
      });
      await pwLocator.press("ControlOrMeta+a").catch(() => {});
      await pwLocator.press("Delete").catch(() => {});
      await typePasswordSafely(pwLocator, ctx.password);
      log(`actOn[password]: password_typed=true selector="${sel}" url_before=${urlBefore}`);
      await humanDelay();
      const pwForm = pwLocator.locator("xpath=ancestor::form[1]");
      const pwSubmit = pwForm.locator('button[type="submit"]').first();
      const hasSubmit = await pwSubmit.isVisible({ timeout: 500 }).catch(() => false);
      if (hasSubmit) {
        log(`actOn[password]: clicking form-scoped submit`);
        await pwSubmit.click().catch((err) => {
          log(
            `actOn[password]: submit click failed: ${redactPassword(err instanceof Error ? err.message : String(err), ctx.password)}`,
          );
        });
      } else {
        log(`actOn[password]: pressing Enter (no form submit btn)`);
        await pwLocator.press("Enter").catch(() => {});
      }
      log(`actOn[password]: url_after=${page.url()}`);
      return;
    }

    case "pin_setup":
    case "pin_confirm":
    case "fast_pin": {
      log(`actOn[${screen.kind}]: start url=${page.url()}`);
      await fillPinInputs(page, ctx.pin);
      await humanDelay();
      // T-Bank's "Придумайте код" screen does NOT auto-advance after 4 digits —
      // it is an optional device-bind dialog with explicit "Установить" / "Не сейчас"
      // buttons. Per design doc, "Не сейчас" returns "unknown auth scenario", so we
      // must click "Установить" (or its sibling "Войти"/"Подтвердить" on confirm/fast).
      const submitCandidates = [
        'button:has-text("Установить")',
        'button:has-text("Подтвердить")',
        'button:has-text("Войти")',
        'button:has-text("Продолжить")',
        'button[automation-id="button-submit"]',
      ];
      let clicked = false;
      for (const sel of submitCandidates) {
        const btn = page.locator(sel).first();
        const visible = await btn.isVisible({ timeout: 800 }).catch(() => false);
        if (!visible) continue;
        const enabled = await btn.isEnabled({ timeout: 500 }).catch(() => false);
        if (!enabled) {
          log(`actOn[${screen.kind}]: button "${sel}" visible but disabled — skipping`);
          continue;
        }
        log(`actOn[${screen.kind}]: clicking "${sel}"`);
        await btn.click({ timeout: 2_000 }).catch((err) => {
          log(`actOn[${screen.kind}]: click "${sel}" failed: ${err instanceof Error ? err.message : String(err)}`);
        });
        clicked = true;
        break;
      }
      if (!clicked) {
        log(`actOn[${screen.kind}]: no submit button found — relying on auto-advance (may stall)`);
      }
      log(`actOn[${screen.kind}]: done url=${page.url()}`);
      return;
    }

    case "captcha":
      throw new Error("captcha_required");

    case "push_confirm":
      throw new Error("push_confirmation_required");

    case "error":
      throw new Error(screen.meta?.errorCode ?? "unknown_step");

    case "unknown":
      await logScreenDiagnostics(page, "actOn-unknown");
      throw new Error("unknown_step");

    case "mybank":
      throw new Error("actOn called on mybank screen — programmer error");
  }
}

// ─── Wait for screen change ────────────────────────────────────

async function waitForChange(
  page: Page,
  prevUrl: string,
  prevPrimarySelector: string | null,
): Promise<string> {
  const urlChangeArm = page
    .waitForFunction((prev) => location.href !== prev, prevUrl, {
      timeout: WAIT_FOR_CHANGE_TIMEOUT_MS,
    })
    .then(() => "url")
    .catch(() => "timeout_url");

  const inputDetachedArm =
    prevPrimarySelector !== null
      ? page
          .locator(prevPrimarySelector)
          .first()
          .waitFor({ state: "detached", timeout: WAIT_FOR_CHANGE_TIMEOUT_MS })
          .then(() => "input_detached")
          .catch(() => "timeout_input")
      : Promise.resolve("timeout_input");

  const overlayGoneArm = page
    .locator('[class*="_Overlay_" i]')
    .first()
    .waitFor({ state: "hidden", timeout: WAIT_FOR_CHANGE_TIMEOUT_MS })
    .then(() => "overlay_gone")
    .catch(() => "timeout_overlay");

  const winner = await Promise.race([urlChangeArm, inputDetachedArm, overlayGoneArm]);
  log(`waitForChange: winner=${winner} url=${page.url()}`);

  if (winner.startsWith("timeout")) return "timeout";
  return winner;
}

// ─── Full login flow ───────────────────────────────────────────

export async function runFullLogin(opts: {
  page: Page;
  phone: string;
  pin: string;
  password: string;
  smsResolver: SmsResolver;
}): Promise<{ storageState: string; sessionAuth: TinkoffSessionAuth }> {
  const { page, phone, pin, password, smsResolver } = opts;

  // Step 1: navigate to login
  log("step1: goto tbank.ru/login");
  await page.goto("https://www.tbank.ru/login/", { waitUntil: "domcontentloaded", timeout: 30_000 });
  log(`step1: arrived at ${page.url()}`);

  // Step 2: captcha probe
  await detectCaptcha(page);
  log("step2: no captcha");

  // Step 3: fill phone and submit
  const phoneInput =
    page.locator('input[name="phone"]').first().or(
      page.locator('input[type="tel"]').first(),
    ).or(
      page.locator('input[autocomplete="tel"]').first(),
    );

  log("step3: waiting for phone input");
  await phoneInput.waitFor({ state: "visible", timeout: 15_000 });
  log("step3: phone input visible");
  const phoneDigits = phone.replace(/^\+7/, "").replace(/\D/g, "");
  await phoneInput.click();
  await phoneInput.press("ControlOrMeta+a").catch(() => {});
  await phoneInput.press("Delete").catch(() => {});
  log(`step3: typing ${phoneDigits.length} phone digits`);
  await phoneInput.pressSequentially(phoneDigits, { delay: 60 });
  log(`step3: phone field value=${JSON.stringify(await phoneInput.inputValue().catch(() => "?"))}`);
  await humanDelay();

  const phoneForm = phoneInput.locator("xpath=ancestor::form[1]");
  const phoneSubmitBtn = phoneForm.locator('button[type="submit"]').first();
  const hasPhoneSubmitBtn = await phoneSubmitBtn.isVisible({ timeout: 500 }).catch(() => false);
  if (hasPhoneSubmitBtn) {
    log("step3: clicking form-scoped submit");
    await phoneSubmitBtn.click();
  } else {
    log("step3: pressing Enter (no form submit btn)");
    await phoneInput.press("Enter");
  }
  await humanDelay();

  // Step 4: wait for SMS step
  log("step4: waiting for /auth/step URL");
  await page.waitForURL(/id\.tbank\.ru\/auth\/step/, { timeout: 30_000 });
  log(`step4: at ${page.url()}`);
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  const step4Title = await page.title().catch(() => "?");
  const step4Buttons = await page
    .locator("button, [role=button]")
    .evaluateAll((nodes) => nodes.map((n) => (n as HTMLElement).innerText.trim()).filter(Boolean))
    .catch(() => [] as string[]);
  const step4Headings = await page
    .locator("h1, h2, h3, [role=heading]")
    .evaluateAll((nodes) => nodes.map((n) => (n as HTMLElement).innerText.trim()).filter(Boolean))
    .catch(() => [] as string[]);
  const step4Tags = await page
    .evaluate(() => {
      const all = document.querySelectorAll("*");
      const counts: Record<string, number> = {};
      for (const el of Array.from(all)) {
        const t = el.tagName.toLowerCase();
        counts[t] = (counts[t] ?? 0) + 1;
      }
      return Object.entries(counts)
        .filter(([t]) => t.includes("-") || /^(input|button|form|td|tb)/.test(t))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 30);
    })
    .catch(() => [] as Array<[string, number]>);
  log(`step4: title="${step4Title}"`);
  log(`step4: headings=${JSON.stringify(step4Headings)}`);
  log(`step4: buttons=${JSON.stringify(step4Buttons)}`);
  log(`step4: tags=${JSON.stringify(step4Tags)}`);
  if (DEBUG) {
    const step4Body = await page
      .locator("body")
      .innerText({ timeout: 2000 })
      .catch(() => "?");
    const step4Html = await page
      .evaluate(() => {
        const main = document.querySelector("main, [role=main], #root, #app, body");
        return main ? (main as HTMLElement).outerHTML.slice(0, 4000) : "?";
      })
      .catch(() => "?");
    log(`step4: body (first 3000): ${step4Body.slice(0, 3000).replace(/\s+/g, " ")}`);
    log(`step4: html (first 4000): ${step4Html.replace(/\s+/g, " ")}`);
  }

  const smsInput = page.locator('input[autocomplete="one-time-code"]').first();
  log("step5: waiting for SMS input visible");
  const smsVisible = await smsInput
    .waitFor({ state: "visible", timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
  if (!smsVisible) {
    const title = await page.title().catch(() => "?");
    const bodyText = await page
      .locator("body")
      .innerText({ timeout: 2000 })
      .catch(() => "?");
    log(`step5: SMS input NOT visible. title="${title}"`);
    log(`step5: body text (first 500 chars): ${bodyText.slice(0, 500).replace(/\s+/g, " ")}`);
    throw new Error("sms_input_missing");
  }
  log("step5: SMS input visible");
  await detectCaptcha(page);
  log("step5: no captcha; waiting for user to submit SMS code");

  // Step 5: get SMS code
  const sms = await smsResolver();
  log(`step5: got SMS code (${sms.length} chars)`);

  // Step 6: type SMS code
  log("step6: typing SMS code via keystrokes");
  await smsInput.click().catch((err) => {
    log(`step6: SMS input click failed (continuing): ${err instanceof Error ? err.message : String(err)}`);
  });
  await smsInput.press("ControlOrMeta+a").catch(() => {});
  await smsInput.press("Delete").catch(() => {});
  await smsInput.pressSequentially(sms, { delay: 80 }).catch((err) => {
    log(
      `step6: pressSequentially failed (likely auto-submit detached input): ${err instanceof Error ? err.message : String(err)}`,
    );
  });
  await humanDelay();
  log(`step6: post-type URL=${page.url()}`);

  // Steps 6.5+: state machine loop replacing old steps 6.5-9
  log(`loop: entering state machine, max ${MAX_TRANSITIONS} transitions`);
  for (let i = 0; i < MAX_TRANSITIONS; i++) {
    await page.waitForLoadState("networkidle", { timeout: NETWORKIDLE_TIMEOUT_MS }).catch(() => {});
    const screen = await classifyScreen(page);
    log(`loop[${i}]: kind=${screen.kind} url=${page.url()}`);

    if (screen.kind === "mybank") {
      log(`loop[${i}]: mybank reached, capturing storageState`);
      const storageState = JSON.stringify(await page.context().storageState());
      log(`loop[${i}]: storageState captured (${storageState.length} chars)`);
      log(`mybank: waiting for SPA to settle and fire API calls`);
      await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {
        log(`mybank: networkidle timed out (8s) — proceeding anyway`);
      });
      const sessionAuth = await extractSessionAuth(page);
      return { storageState, sessionAuth };
    }

    const prevUrl = page.url();
    const prevPrimary = screen.meta?.matchedSelector ?? null;
    await actOn(page, screen, { phone, pin, password });
    const winner = await waitForChange(page, prevUrl, prevPrimary);
    if (winner === "timeout") {
      log(
        `loop[${i}]: no change observed within ${WAIT_FOR_CHANGE_TIMEOUT_MS}ms — continuing to next classify pass`,
      );
    }
  }
  throw new Error("too_many_transitions");
}

export async function runFastLogin(opts: {
  page: Page;
  pin: string;
}): Promise<{ sessionAuth: TinkoffSessionAuth }> {
  const { page, pin } = opts;

  await page.goto("https://www.tbank.ru/mybank/", { waitUntil: "domcontentloaded" });
  await detectCaptcha(page);

  const deadline = Date.now() + 8_000;

  while (Date.now() < deadline) {
    const currentUrl = page.url();

    if (currentUrl.includes("tbank.ru/mybank")) {
      log(`mybank: waiting for SPA to settle and fire API calls`);
      await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {
        log(`mybank: networkidle timed out (8s) — proceeding anyway`);
      });
      const sessionAuth = await extractSessionAuth(page);
      return { sessionAuth };
    }

    const numericCount = await page
      .locator('input[inputmode="numeric"], input[autocomplete="one-time-code"]')
      .count()
      .catch(() => 0);

    if (numericCount >= 4) {
      await fillPinInputs(page, pin);
      await humanDelay();
      await page.waitForURL(/^https:\/\/www\.tbank\.ru\/mybank/, { timeout: 30_000 });
      log(`mybank: waiting for SPA to settle and fire API calls`);
      await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {
        log(`mybank: networkidle timed out (8s) — proceeding anyway`);
      });
      const sessionAuth = await extractSessionAuth(page);
      return { sessionAuth };
    }

    // Check for SMS-only screen (single one-time-code input without being a 4+ PIN array)
    try {
      const smsInputVisible = await page
        .locator('input[autocomplete="one-time-code"]')
        .first()
        .isVisible({ timeout: 300 });
      if (smsInputVisible && numericCount < 4) {
        throw new Error("session_expired");
      }
    } catch (err) {
      if (err instanceof Error && err.message === "session_expired") throw err;
    }

    await new Promise((r) => setTimeout(r, 300));
  }

  throw new Error("unknown_step");
}
