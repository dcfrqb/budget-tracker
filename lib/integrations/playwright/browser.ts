import { chromium as chromiumExtra } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { chromium as chromiumVanilla, type BrowserContext, type Page } from "playwright";
import path from "node:path";
import { mkdir, readdir } from "node:fs/promises";

// Lazy-init: calling chromiumExtra.use(StealthPlugin()) at module top-level
// crashes Next.js's "Collecting page data" step (puppeteer-extra-plugin-stealth
// 2.11.x evaluates an evasion sub-module before puppeteer-extra's type helper
// is initialised, throwing TypeError: n.typeOf is not a function). Defer the
// .use() call until the first real request hits withTbankBrowser. The boolean
// guard ensures we register the plugin exactly once even though .use() is
// idempotent in spirit.
let _stealthRegistered = false;

function getChromium() {
  if (process.env.TBANK_BROWSER_ENGINE === "vanilla") {
    return chromiumVanilla;
  }
  if (!_stealthRegistered) {
    chromiumExtra.use(StealthPlugin());
    _stealthRegistered = true;
  }
  return chromiumExtra;
}

export type TbankBrowserCtx = {
  context: BrowserContext;
  page: Page;
  saveStorageState: () => Promise<string>;
};

export function humanDelay(min = 800, max = 1200): Promise<void> {
  const ms = min + Math.random() * (max - min);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function profileDirFor(credentialId: string): string {
  const baseDir =
    process.env.PLAYWRIGHT_PROFILES_DIR ??
    "/var/lib/budget-tracker/playwright-profiles";
  return path.join(baseDir, credentialId);
}

const _launchQueue = new Map<string, Promise<unknown>>();

export async function withTbankBrowser<T>(
  opts: {
    credentialId: string;
    storageState?: string | null;
    headless?: boolean;
  },
  fn: (ctx: TbankBrowserCtx) => Promise<T>,
): Promise<T> {
  const profileDir = profileDirFor(opts.credentialId);

  const prior = _launchQueue.get(profileDir) ?? Promise.resolve();
  await prior.catch(() => {});

  const work = (async (): Promise<T> => {
    await mkdir(profileDir, { recursive: true });

    const entries = await readdir(profileDir);
    const isFresh = entries.length === 0;

    const envHeadless = process.env.PLAYWRIGHT_HEADLESS;
    const headless =
      opts.headless ??
      (envHeadless === "true" || envHeadless === "1"
        ? true
        : envHeadless === "false" || envHeadless === "0"
          ? false
          : process.env.DISPLAY
            ? false
            : true);

    console.log(
      "[playwright-browser] mode:",
      headless ? "headless" : "headed display=" + process.env.DISPLAY,
    );

    // --no-sandbox is unconditional: the container runs as root (no USER
    // directive in Dockerfile), so the chromium sandbox cannot acquire the
    // namespaces it needs and would crash on launch under headed mode too.
    // The container boundary is the trust boundary here — single-admin tool.
    const stealthArgs = [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
    ];

    let context: BrowserContext;
    try {
      context = await getChromium().launchPersistentContext(profileDir, {
        headless,
        viewport: { width: 1280, height: 800 },
        locale: "ru-RU",
        timezoneId: "Europe/Moscow",
        args: stealthArgs,
        ignoreDefaultArgs: ["--enable-automation"],
      });
    } catch (err) {
      console.error("[playwright-browser] launch failed:", err);
      throw err;
    }

    if (isFresh && opts.storageState) {
      try {
        const parsed = JSON.parse(opts.storageState) as {
          cookies?: unknown[];
        };
        if (Array.isArray(parsed.cookies) && parsed.cookies.length > 0) {
          await context.addCookies(
            parsed.cookies as Parameters<BrowserContext["addCookies"]>[0],
          );
        }
      } catch {
        throw new Error("invalid storageState JSON");
      }
    }

    const page = context.pages()[0] ?? (await context.newPage());

    const saveStorageState = async (): Promise<string> =>
      JSON.stringify(await context.storageState());

    try {
      return await fn({ context, page, saveStorageState });
    } catch (err) {
      console.error("[playwright-browser] callback failed:", err);
      throw err;
    } finally {
      try {
        await context.close();
      } catch (err) {
        console.error("[playwright-browser] close error:", err);
      }
    }
  })();

  _launchQueue.set(profileDir, work);

  try {
    return await work;
  } finally {
    if (_launchQueue.get(profileDir) === work) {
      _launchQueue.delete(profileDir);
    }
  }
}
