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

  // Step 1: navigate to login
  await page.goto("https://www.tbank.ru/login/", { waitUntil: "domcontentloaded" });

  // Step 2: captcha probe
  await detectCaptcha(page);

  // Step 3: fill phone and submit
  const phoneInput =
    page.locator('input[name="phone"]').first().or(
      page.locator('input[type="tel"]').first(),
    ).or(
      page.locator('input[autocomplete="tel"]').first(),
    );

  await phoneInput.waitFor({ state: "visible", timeout: 15_000 });
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
  await phoneInput.pressSequentially(phoneDigits, { delay: 60 });
  await humanDelay();

  // Scope submit button to the same form as the phone input to avoid
  // hitting an unrelated button when multiple forms are on the page.
  const phoneForm = phoneInput.locator("xpath=ancestor::form[1]");
  const phoneSubmitBtn = phoneForm.locator('button[type="submit"]').first();
  const hasPhoneSubmitBtn = await phoneSubmitBtn.isVisible({ timeout: 500 }).catch(() => false);
  if (hasPhoneSubmitBtn) {
    await phoneSubmitBtn.click();
  } else {
    await phoneInput.press("Enter");
  }
  await humanDelay();

  // Step 4: wait for SMS step
  await page.waitForURL(/id\.tbank\.ru\/auth\/step/, { timeout: 30_000 });
  const smsInput = page.locator('input[autocomplete="one-time-code"]').first();
  await smsInput.waitFor({ state: "visible", timeout: 15_000 });
  await detectCaptcha(page);

  // Step 5: get SMS code (no local timeout — sms-channel handles it)
  const sms = await smsResolver();

  // Step 6: fill SMS code; T-Bank may auto-submit
  await smsInput.fill(sms);
  await humanDelay();
  // If not auto-submitted, scope submit button to the form containing the SMS input.
  const smsForm = smsInput.locator("xpath=ancestor::form[1]");
  const smsSubmitBtn = smsForm.locator('button[type="submit"]').first();
  const hasSmsSubmit = await smsSubmitBtn.isVisible({ timeout: 800 }).catch(() => false);
  if (hasSmsSubmit) {
    await smsSubmitBtn.click();
    await humanDelay();
  } else {
    // Fallback: Enter key if form-scoped button not found
    await smsInput.press("Enter");
    await humanDelay();
  }

  // Step 7: wait for PIN screen — 4+ numeric inputs
  await page.waitForFunction(
    () => {
      const inputs = document.querySelectorAll('input[inputmode="numeric"], input[autocomplete="one-time-code"]');
      return inputs.length >= 4;
    },
    { timeout: 30_000 },
  );
  await detectCaptcha(page);

  // Step 8: fill PIN
  await fillPinInputs(page, pin);
  await humanDelay();

  // Defensive: check for "confirm PIN" screen
  // POC note: T-Bank may ask the user to confirm the PIN they just set.
  // Detection: still on /auth/step URL and 4+ pin inputs visible after the delay.
  const stillOnAuthStep = page.url().includes("/auth/step");
  if (stillOnAuthStep && (await isPinScreen(page))) {
    await fillPinInputs(page, pin);
    await humanDelay();
  }

  // Step 9: wait for redirect to mybank
  await page.waitForURL(/^https:\/\/www\.tbank\.ru\/mybank/, { timeout: 60_000 });

  // Step 10: capture storage state
  const storageState = JSON.stringify(await page.context().storageState());
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
