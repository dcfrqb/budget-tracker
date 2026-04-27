import type { Page } from "playwright";
import { humanDelay } from "./browser";

export type SmsResolver = () => Promise<string>;

async function detectCaptcha(page: Page): Promise<void> {
  const probes = [
    () => page.locator('iframe[title*="captcha" i]').isVisible({ timeout: 1000 }),
    () => page.locator('iframe[src*="captcha" i]').isVisible({ timeout: 1000 }),
    () => page.getByRole("dialog").filter({ hasText: /проверка|captcha/i }).isVisible({ timeout: 1000 }),
    () => page.getByText(/проверка|captcha/i).isVisible({ timeout: 1000 }),
    // reCAPTCHA / hCaptcha class-based probes
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

async function fillPinInputs(page: Page, pin: string): Promise<void> {
  const pinLocator = page.locator('input[inputmode="numeric"], input[autocomplete="one-time-code"]');
  const count = await pinLocator.count();

  if (count >= 4) {
    // PIN is split across multiple inputs — type each digit
    for (let i = 0; i < pin.length && i < count; i++) {
      await pinLocator.nth(i).fill(pin[i]);
    }
  } else {
    // Single combined input
    await page.keyboard.type(pin);
  }
}

async function isPinScreen(page: Page): Promise<boolean> {
  try {
    const countSignal = await page
      .locator('input[inputmode="numeric"], input[autocomplete="one-time-code"]')
      .count();
    if (countSignal >= 4) return true;

    // Semantic fallback: look for a heading, label, or role=group container
    // that mentions PIN/Пин/Код near the inputs. Catches single split-rendered
    // input designs where count-based check would miss.
    const semanticSignal = await Promise.any([
      page.locator('[aria-label*="PIN" i], [aria-label*="пин" i], [aria-label*="код" i]').isVisible({ timeout: 500 }),
      page.locator('[role="group"][aria-label*="PIN" i], [role="group"][aria-label*="пин" i]').isVisible({ timeout: 500 }),
      page.getByRole("heading").filter({ hasText: /пин|pin|код/i }).isVisible({ timeout: 500 }),
    ]).catch(() => false);

    return semanticSignal === true;
  } catch {
    return false;
  }
}

export async function runFullLogin(opts: {
  page: Page;
  phone: string;
  pin: string;
  smsResolver: SmsResolver;
}): Promise<{ storageState: string }> {
  const { page, phone, pin, smsResolver } = opts;
  const log = (msg: string) => console.log(`[playwright-flow] ${msg}`);

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
  // T-Bank's phone input has a "+7 (___) ___-__-__" mask. .fill() sets the
  // value via DOM and the mask layer corrupts it (the leading "+7 " prefix is
  // already shown as placeholder/mask, and the masking handler rejects extra
  // digits). pressSequentially simulates real key events so the mask absorbs
  // the input correctly. We strip the "+7"/"7"/"8" country prefix and feed
  // only the 10 trailing digits.
  const phoneDigits = phone.replace(/^\+7/, "").replace(/\D/g, "");
  await phoneInput.click();
  await phoneInput.press("ControlOrMeta+a").catch(() => {});
  await phoneInput.press("Delete").catch(() => {});
  log(`step3: typing ${phoneDigits.length} phone digits`);
  await phoneInput.pressSequentially(phoneDigits, { delay: 60 });
  log(`step3: phone field value=${JSON.stringify(await phoneInput.inputValue().catch(() => "?"))}`);
  await humanDelay();

  // Scope submit button to the same form as the phone input to avoid
  // hitting an unrelated button when multiple forms are on the page.
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
  // Tinkoff /auth/step is a SPA — wait for the panel to finish rendering
  // before introspecting the DOM, otherwise innerText is "Вход Телефон" stub.
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  const step4Title = await page.title().catch(() => "?");
  const step4Body = await page
    .locator("body")
    .innerText({ timeout: 2000 })
    .catch(() => "?");
  const step4Buttons = await page
    .locator("button, [role=button]")
    .evaluateAll((nodes) => nodes.map((n) => (n as HTMLElement).innerText.trim()).filter(Boolean))
    .catch(() => [] as string[]);
  const step4Headings = await page
    .locator("h1, h2, h3, [role=heading]")
    .evaluateAll((nodes) => nodes.map((n) => (n as HTMLElement).innerText.trim()).filter(Boolean))
    .catch(() => [] as string[]);
  // Dump tag-names that appear in the document — Tinkoff often hides UI in
  // <td-button>, <td-input>, etc. or inside Shadow DOM, so plain locators
  // miss them.
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
  // Dump outerHTML of the main container — should show the SPA root contents.
  const step4Html = await page
    .evaluate(() => {
      const main = document.querySelector("main, [role=main], #root, #app, body");
      return main ? (main as HTMLElement).outerHTML.slice(0, 4000) : "?";
    })
    .catch(() => "?");
  log(`step4: title="${step4Title}"`);
  log(`step4: headings=${JSON.stringify(step4Headings)}`);
  log(`step4: buttons=${JSON.stringify(step4Buttons)}`);
  log(`step4: tags=${JSON.stringify(step4Tags)}`);
  log(`step4: body (first 3000): ${step4Body.slice(0, 3000).replace(/\s+/g, " ")}`);
  log(`step4: html (first 4000): ${step4Html.replace(/\s+/g, " ")}`);
  const smsInput = page.locator('input[autocomplete="one-time-code"]').first();
  log("step5: waiting for SMS input visible");
  const smsVisible = await smsInput
    .waitFor({ state: "visible", timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
  if (!smsVisible) {
    // Dump page state so we can see what T-Bank actually shows here.
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

  // Step 5: get SMS code (no local timeout — sms-channel handles it)
  const sms = await smsResolver();
  log(`step5: got SMS code (${sms.length} chars)`);

  // Step 6: fill SMS code; T-Bank may auto-submit
  log("step6: filling SMS code");
  await smsInput.fill(sms);
  await humanDelay();
  // If not auto-submitted, scope submit button to the form containing the SMS input.
  const smsForm = smsInput.locator("xpath=ancestor::form[1]");
  const smsSubmitBtn = smsForm.locator('button[type="submit"]').first();
  const hasSmsSubmit = await smsSubmitBtn.isVisible({ timeout: 800 }).catch(() => false);
  if (hasSmsSubmit) {
    log("step6: clicking SMS submit");
    await smsSubmitBtn.click();
    await humanDelay();
  } else {
    log("step6: pressing Enter on SMS input (no submit btn)");
    await smsInput.press("Enter");
    await humanDelay();
  }
  log(`step6: post-submit URL=${page.url()}`);

  // Step 7: wait for PIN screen — 4+ numeric inputs
  log("step7: waiting for PIN screen (>=4 numeric inputs)");
  const pinScreenReached = await page
    .waitForFunction(
      () => {
        const inputs = document.querySelectorAll(
          'input[inputmode="numeric"], input[autocomplete="one-time-code"]',
        );
        return inputs.length >= 4;
      },
      { timeout: 30_000 },
    )
    .then(() => true)
    .catch(() => false);
  if (!pinScreenReached) {
    const title = await page.title().catch(() => "?");
    const url = page.url();
    const body = await page
      .locator("body")
      .innerText({ timeout: 2000 })
      .catch(() => "?");
    const inputCount = await page
      .evaluate(
        () =>
          document.querySelectorAll(
            'input[inputmode="numeric"], input[autocomplete="one-time-code"]',
          ).length,
      )
      .catch(() => -1);
    log(`step7: PIN screen NOT reached. url=${url} title="${title}" inputCount=${inputCount}`);
    log(`step7: body (first 800): ${body.slice(0, 800).replace(/\s+/g, " ")}`);
    throw new Error("pin_screen_missing");
  }
  log(`step7: PIN screen reached at ${page.url()}`);
  await detectCaptcha(page);

  // Step 8: fill PIN
  log("step8: filling PIN");
  await fillPinInputs(page, pin);
  await humanDelay();

  // Defensive: check for "confirm PIN" screen
  // POC note: T-Bank may ask the user to confirm the PIN they just set.
  // Detection: still on /auth/step URL and 4+ pin inputs visible after the delay.
  const stillOnAuthStep = page.url().includes("/auth/step");
  if (stillOnAuthStep && (await isPinScreen(page))) {
    log("step8b: PIN-confirm screen detected, filling again");
    await fillPinInputs(page, pin);
    await humanDelay();
  } else {
    log(`step8: post-PIN URL=${page.url()}`);
  }

  // Step 9: wait for redirect to mybank
  log("step9: waiting for /mybank redirect");
  const reachedMybank = await page
    .waitForURL(/^https:\/\/www\.tbank\.ru\/mybank/, { timeout: 60_000 })
    .then(() => true)
    .catch(() => false);
  if (!reachedMybank) {
    const title = await page.title().catch(() => "?");
    const body = await page
      .locator("body")
      .innerText({ timeout: 2000 })
      .catch(() => "?");
    log(`step9: /mybank NOT reached. url=${page.url()} title="${title}"`);
    log(`step9: body (first 800): ${body.slice(0, 800).replace(/\s+/g, " ")}`);
    throw new Error("mybank_redirect_missing");
  }
  log(`step9: at ${page.url()}`);

  // Step 10: capture storage state
  log("step10: capturing storageState");
  const storageState = JSON.stringify(await page.context().storageState());
  log(`step10: storageState captured (${storageState.length} chars)`);
  return { storageState };
}

export async function runFastLogin(opts: {
  page: Page;
  pin: string;
}): Promise<void> {
  const { page, pin } = opts;

  await page.goto("https://www.tbank.ru/mybank/", { waitUntil: "domcontentloaded" });
  await detectCaptcha(page);

  // Race up to 8 seconds for one of three states:
  // 1. Already on /mybank → done
  // 2. PIN screen (4+ digit inputs) → fill pin → wait /mybank → done
  // 3. SMS screen (single one-time-code input) → session_expired
  const deadline = Date.now() + 8_000;

  while (Date.now() < deadline) {
    const currentUrl = page.url();

    if (currentUrl.includes("tbank.ru/mybank")) {
      return;
    }

    if (await isPinScreen(page)) {
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
      if (smsInputVisible) {
        const count = await page
          .locator('input[inputmode="numeric"], input[autocomplete="one-time-code"]')
          .count();
        if (count < 4) {
          throw new Error("session_expired");
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message === "session_expired") throw err;
    }

    await new Promise((r) => setTimeout(r, 300));
  }

  throw new Error("unknown_step");
}
