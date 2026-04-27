/**
 * Probe T-Bank retail auth via Playwright.
 *
 * Run:  npx tsx scripts/probe-tinkoff-playwright.ts
 *
 * Opens a non-headless Chromium so you can drive the login by hand
 * (phone → SMS → PIN). The script:
 *   1. logs every POST to id.tbank.ru/auth/* (URL + status — bodies are gzipped & opaque)
 *   2. waits until you reach www.tbank.ru/mybank/
 *   3. dumps cookies for tbank.ru / id.tbank.ru
 *   4. tries `/api/common/v1/operations` with extracted sessionid+wuid
 *
 * Goal: prove that headless-driven auth → captured cookies → working API call
 * is feasible for our adapter. If yes, we move on to a real headless flow.
 */
import { chromium, type BrowserContext, type Cookie } from "playwright";

const PIN_HINT = "1234"; // owner picks at connect time; just for the demo

async function main() {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({
    locale: "ru-RU",
    timezoneId: "Europe/Moscow",
    viewport: { width: 1280, height: 800 },
  });
  const page = await ctx.newPage();

  // ── Network log (URL + status only) ──────────────────────────
  page.on("request", (req) => {
    const url = req.url();
    if (url.includes("id.tbank.ru/auth") || url.includes("tbank.ru/api")) {
      console.log(`[REQ ] ${req.method()} ${url}`);
    }
  });
  page.on("response", async (res) => {
    const url = res.url();
    if (url.includes("id.tbank.ru/auth") || url.includes("tbank.ru/api")) {
      console.log(`[RES ] ${res.status()} ${url.slice(0, 120)}`);
    }
  });

  console.log("\n→ Opening login page. Drive the flow manually:");
  console.log(`  1. Enter your phone number`);
  console.log(`  2. Enter SMS code`);
  console.log(`  3. Set PIN (suggest "${PIN_HINT}" so we know it for next-run testing)`);
  console.log(`  4. Wait until the script auto-detects mybank…\n`);

  await page.goto("https://www.tbank.ru/login/", { waitUntil: "domcontentloaded" });

  // ── Wait for successful login = we land on mybank/ ──────────
  await page.waitForURL(/^https:\/\/www\.tbank\.ru\/mybank/, { timeout: 5 * 60_000 });
  console.log("\n✓ Reached mybank — auth complete\n");

  // ── Dump cookies ─────────────────────────────────────────────
  const cookies: Cookie[] = await ctx.cookies();
  const tbankCookies = cookies.filter((c) =>
    c.domain.endsWith("tbank.ru") || c.domain.endsWith(".tbank.ru"),
  );
  console.log(`Captured ${tbankCookies.length} tbank.ru cookies. Names:`);
  for (const c of tbankCookies) {
    console.log(`  ${c.domain}\t${c.name}\t(len ${c.value.length})`);
  }

  // ── Find sessionid & wuid in cookies ─────────────────────────
  const findCookie = (name: string) =>
    tbankCookies.find((c) => c.name === name)?.value;

  const possibleSessionid =
    findCookie("psid") || findCookie("sessionid") || findCookie("api_sso_id");
  const possibleWuid = findCookie("__P__wuid") || findCookie("wuid");

  console.log(`\nLikely sessionid cookie: ${possibleSessionid?.slice(0, 30)}…`);
  console.log(`Likely wuid cookie:      ${possibleWuid?.slice(0, 30)}…`);

  // ── Try fetching operations via page context (uses cookies) ─
  // This is the same call our adapter would make on every sync.
  // Use the PAGE's fetch so cookies are sent automatically.
  console.log("\n→ Calling /api/common/v1/operations (last 30 days) via page context…");

  // First fish a real account id from the mybank UI — we know one exists
  // from the previous probe but ids may differ for new sessions.
  await page.goto("https://www.tbank.ru/mybank/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  // Pull session_status to confirm cookies grant API access
  const sessionStatus = await page.evaluate(async () => {
    const r = await fetch(
      "https://www.tbank.ru/api/common/v1/session_status?appName=supreme&appVersion=0.0.1&origin=web,ib5,platform",
      { credentials: "include" },
    );
    return { status: r.status, head: (await r.text()).slice(0, 600) };
  });
  console.log(`session_status: HTTP ${sessionStatus.status}`);
  console.log(sessionStatus.head);

  // accounts list
  const acctList = await page.evaluate(async () => {
    const r = await fetch(
      "https://www.tbank.ru/api/common/v1/accounts_flat?appName=supreme&appVersion=0.0.1&origin=web,ib5,platform",
      { credentials: "include" },
    );
    return { status: r.status, head: (await r.text()).slice(0, 1500) };
  });
  console.log(`\naccounts_flat: HTTP ${acctList.status}`);
  console.log(acctList.head);

  console.log("\n✓ Probe done. Closing in 10s…");
  await page.waitForTimeout(10_000);
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
