import { chromium, type BrowserContext, type Page } from "playwright";
import path from "node:path";
import { mkdir, readdir } from "node:fs/promises";

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
      (envHeadless === "false" || envHeadless === "0" ? false : true);

    // Anti-bot evasion: T-Bank's /auth/step SPA refuses to render when it
    // detects automation flags. We pass --disable-blink-features=
    // AutomationControlled to suppress the "Chrome is being controlled by
    // automated test software" banner and the matching CDP signal, and we
    // strip the boolean navigator.webdriver flag in an init script.
    const stealthArgs = [
      "--disable-blink-features=AutomationControlled",
      ...(headless ? ["--no-sandbox"] : []),
    ];

    let context: BrowserContext;
    try {
      context = await chromium.launchPersistentContext(profileDir, {
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

    // Override navigator.webdriver and a few other automation tells before
    // any page script runs. Keeps Tinkoff's anti-bot heuristics from short-
    // circuiting the SPA render.
    await context.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, "webdriver", {
        configurable: true,
        get: () => false,
      });
      // Some bot-detection libs check window.chrome / plugins length.
      // @ts-expect-error - injected at runtime
      if (!window.chrome) window.chrome = { runtime: {} };
      Object.defineProperty(navigator, "plugins", {
        configurable: true,
        get: () => [1, 2, 3, 4, 5],
      });
      Object.defineProperty(navigator, "languages", {
        configurable: true,
        get: () => ["ru-RU", "ru", "en-US", "en"],
      });
    });

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
