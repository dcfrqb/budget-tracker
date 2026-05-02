# FX Rate Pipeline — Single-Source Contract

All exchange rate data flows through one pipeline. Violating this contract is a bug.

## Source of truth

`ExchangeRate` table in Postgres. Populated by CBR daily fixings fetched via `cbr-fetcher.ts` and persisted by `persist.ts`.

## Canonical API

- `getLatestRatesMap()` — returns `Map<"FROM-TO", Decimal>` with the most recent rate per pair. Use this for all cross-currency arithmetic.
- `getLatestRatesWithMeta()` — same but also includes `recordedAt`. Use only where freshness display is needed (top-bar, fx-rates panel).
- `convertToBase(amount, fromCcy, baseCcy, rates)` — the only function allowed to convert between currencies. Supports direct, inverse, and USD-pivot paths.
- `ensureFreshRates()` — React `cache()`-wrapped guard called from `top-bar.tsx` on every render. Triggers a CBR fetch+persist if the DB snapshot is older than 6 hours.
- `getFxRates(pairs)` — fetches CBR + persists + returns rows with 24h delta. Used by the wallet FX-rates panel.

## Refresh schedule

12-hour cron (`/api/fx/sync`) on the production VPS + `ensureFreshRates()` (6-hour window) as a render-path safety net.

## Rules

- Hardcoded rate numbers anywhere outside `prisma/seed*.ts` examples = **bug**.
- Never call `db.exchangeRate` directly outside `lib/data/wallet.ts` and `lib/fx/`.
- All balance rollups (`getWalletTotals`, `getHomeDashboard`, analytics aggregators) must call `getLatestRatesMap()` and pass the result to `convertToBase()`.
