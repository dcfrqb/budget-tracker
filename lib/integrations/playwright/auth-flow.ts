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
    let kind: ScreenKind = "pin_setup";
    if (/Повторите|Подтвердите/i.test(headingText)) {
      kind = "pin_confirm";
    } else if (/Придумайте|Задайте|Создайте/i.test(headingText)) {
      kind = "pin_setup";
    } else if (/Введите PIN|Введите пин/i.test(headingText)) {
      kind = "fast_pin";
    }
    log(`classify: kind=${kind} url=${url} heading="${headingText}" numericInputs=${numericInputCount}`);
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

  if (count >= 4) {
    for (let i = 0; i < pin.length && i < count; i++) {
      await pinLocator.nth(i).fill(pin[i]);
    }
  } else {
    await pinLocator.first().pressSequentially(pin, { delay: 60 });
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
}): Promise<{ storageState: string }> {
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
      return { storageState };
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
}): Promise<void> {
  const { page, pin } = opts;

  await page.goto("https://www.tbank.ru/mybank/", { waitUntil: "domcontentloaded" });
  await detectCaptcha(page);

  const deadline = Date.now() + 8_000;

  while (Date.now() < deadline) {
    const currentUrl = page.url();

    if (currentUrl.includes("tbank.ru/mybank")) {
      return;
    }

    const numericCount = await page
      .locator('input[inputmode="numeric"], input[autocomplete="one-time-code"]')
      .count()
      .catch(() => 0);

    if (numericCount >= 4) {
      await fillPinInputs(page, pin);
      await humanDelay();
      await page.waitForURL(/^https:\/\/www\.tbank\.ru\/mybank/, { timeout: 30_000 });
      return;
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
