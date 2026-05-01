/**
 * Budget Tracker — reference seed.
 *
 * Заливает только справочники (Currency + ExchangeRate). Никаких пользователей,
 * счетов, транзакций, подписок, кредитов и т.п. — всё это живёт в prisma/seed-demo.ts
 * и запускается отдельно через `npm run seed:demo`.
 *
 * Этот скрипт:
 *   - запускается через `npm run seed`
 *   - автоматически вызывается `prisma migrate reset` (через prisma.config.ts → migrations.seed)
 *   - идемпотентен: повторный прогон на уже засеянной БД не ломается и не плодит дубликаты
 *   - не трогает user-data — только reference-справочники
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

import { SUPPORTED_CURRENCIES } from "../lib/constants";
import { fetchCbrRates } from "../lib/fx/cbr-fetcher";
import { persistRates } from "../lib/fx/persist";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

// Свежее время для recordedAt — чтобы курс считался «актуальным» после каждого прогона.
const NOW = new Date();

async function seedCurrencies() {
  for (const c of SUPPORTED_CURRENCIES) {
    await db.currency.upsert({
      where: { code: c.code },
      create: c,
      update: c,
    });
  }
}

async function seedExchangeRates() {
  // Fetch live rates from CBR (Russian Central Bank).
  // Only RUB pairs are supported; cryptoassets and stablecoins are dropped entirely.
  try {
    const cbrRates = await fetchCbrRates();
    // Convert CBR shape { "USD": { rate: 92.10, nominal: 1 } } → { "USD": 92.10 }
    const ratesMap: Record<string, number> = {};
    for (const [code, entry] of Object.entries(cbrRates)) {
      ratesMap[code] = entry.rate;
    }
    // Stablecoin peg: USDT/USDC ≈ 1 USD. Mirror USD-RUB.
    if (ratesMap.USD !== undefined) {
      ratesMap.USDT = ratesMap.USD;
      ratesMap.USDC = ratesMap.USD;
    }
    await persistRates(ratesMap);
    console.log("[seed] CBR rates persisted successfully");
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    console.warn("[seed] CBR fetch failed, skipping FX rate seeding:", err);
    // Do NOT throw — seed must work offline; app will populate rates on first server render.
  }
}

async function main() {
  console.log("→ currencies");
  await seedCurrencies();

  console.log("→ exchange rates");
  await seedExchangeRates();

  console.log("✓ reference seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
