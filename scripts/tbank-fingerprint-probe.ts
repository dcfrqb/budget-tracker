/**
 * Fingerprint probe — Phase 0 of Tinkoff anti-bot strategy.
 *
 * Run:  npx tsx scripts/tbank-fingerprint-probe.ts
 *
 * Visits three fingerprint test sites using the EXACT same browser setup
 * as the Tinkoff adapter (withTbankBrowser), captures screenshots + HTML,
 * and dumps all detection-relevant signals to stdout.
 *
 * Artifacts land in /tmp/probe-<sitename>.{png,html}.
 * Profile dir is NOT deleted so you can inspect it.
 */
import { writeFile } from "node:fs/promises";
import { withTbankBrowser } from "../lib/integrations/playwright/browser";

const log = (...args: unknown[]) => console.log("[probe]", ...args);

type SiteResult = {
  site: string;
  url: string;
  signals: Record<string, unknown>;
  error?: string;
};

const SITES = [
  { name: "sannysoft", url: "https://bot.sannysoft.com/" },
  { name: "creepjs", url: "https://abrahamjuliot.github.io/creepjs/" },
  { name: "browserleaks-js", url: "https://browserleaks.com/javascript" },
];

async function main() {
  log("Starting fingerprint probe — inheriting stealth setup from withTbankBrowser");

  const results: SiteResult[] = [];

  await withTbankBrowser(
    { credentialId: "fingerprint-probe", headless: true },
    async ({ page }) => {
      for (const site of SITES) {
        log(`--- ${site.name} (${site.url}) ---`);
        const result: SiteResult = { site: site.name, url: site.url, signals: {} };

        try {
          await page.goto(site.url, { waitUntil: "networkidle", timeout: 60_000 });
          await page.waitForTimeout(4_000);

          // Screenshot
          const screenshotPath = `/tmp/probe-${site.name}.png`;
          await page.screenshot({ path: screenshotPath, fullPage: true });
          log(`Screenshot saved: ${screenshotPath}`);

          // HTML
          const html = await page.evaluate(() => document.documentElement.outerHTML);
          const htmlPath = `/tmp/probe-${site.name}.html`;
          await writeFile(htmlPath, html, "utf8");
          log(`HTML saved: ${htmlPath}`);

          // Extract signals
          const signals = await page.evaluate(() => {
            // WebGL renderer/vendor
            let webglRenderer: string | null = null;
            let webglVendor: string | null = null;
            try {
              const canvas = document.createElement("canvas");
              const gl =
                canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
              if (gl) {
                const ext = (gl as WebGLRenderingContext).getExtension(
                  "WEBGL_debug_renderer_info",
                );
                if (ext) {
                  webglVendor = (gl as WebGLRenderingContext).getParameter(
                    ext.UNMASKED_VENDOR_WEBGL,
                  ) as string;
                  webglRenderer = (gl as WebGLRenderingContext).getParameter(
                    ext.UNMASKED_RENDERER_WEBGL,
                  ) as string;
                }
              }
            } catch {
              webglVendor = "error";
              webglRenderer = "error";
            }

            // Permissions / notification tell
            let permNotificationState: string | null = null;
            let headlessTell = false;
            // We resolve this async; we'll do it separately below and merge
            // For the sync portion, just grab Notification.permission
            const notificationPerm =
              typeof Notification !== "undefined" ? Notification.permission : "unsupported";

            return {
              navigatorWebdriver: navigator.webdriver,
              pluginsLength: navigator.plugins.length,
              languages: Array.from(navigator.languages),
              userAgent: navigator.userAgent,
              platform: navigator.platform,
              hardwareConcurrency: navigator.hardwareConcurrency,
              deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null,
              webglVendor,
              webglRenderer,
              screenWidth: screen.width,
              screenHeight: screen.height,
              colorDepth: screen.colorDepth,
              windowChromePresent: typeof (window as Window & { chrome?: unknown }).chrome !== "undefined",
              windowChromeRuntimePresent:
                typeof (window as Window & { chrome?: { runtime?: unknown } }).chrome?.runtime !==
                "undefined",
              notificationPermission: notificationPerm,
            };
          });

          // Async permissions check (must be done separately)
          const permState = await page.evaluate(async () => {
            try {
              const result = await navigator.permissions.query({
                name: "notifications" as PermissionName,
              });
              const notifPerm =
                typeof Notification !== "undefined" ? Notification.permission : "unsupported";
              return {
                permissionsState: result.state,
                headlessTell: notifPerm === "denied" && result.state === "prompt",
              };
            } catch {
              return { permissionsState: "error", headlessTell: false };
            }
          });

          result.signals = { ...signals, ...permState };

          log("Signals extracted:");
          for (const [k, v] of Object.entries(result.signals)) {
            log(`  ${k}: ${JSON.stringify(v)}`);
          }
        } catch (err) {
          result.error = String(err);
          log(`ERROR on ${site.name}: ${result.error}`);
        }

        results.push(result);

        // Reset to blank between sites
        try {
          await page.goto("about:blank");
        } catch {
          // ignore
        }
      }
    },
  );

  // Summary block
  console.log("\n[probe] ============================================================");
  console.log("[probe] FINGERPRINT PROBE SUMMARY");
  console.log("[probe] ============================================================");
  for (const r of results) {
    console.log(`\n[probe] SITE: ${r.site} (${r.url})`);
    if (r.error) {
      console.log(`[probe]   ERROR: ${r.error}`);
      continue;
    }
    for (const [k, v] of Object.entries(r.signals)) {
      console.log(`[probe]   ${k.padEnd(32)} = ${JSON.stringify(v)}`);
    }
    console.log(`[probe]   artifacts: /tmp/probe-${r.site}.png  /tmp/probe-${r.site}.html`);
  }
  console.log("\n[probe] ============================================================");
  console.log("[probe] Done. Profile dir preserved for inspection.");
}

main().catch((err) => {
  console.error("[probe] Fatal:", err);
  process.exit(1);
});
