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
  // Актуальные курсы (ручные, как и раньше). Для reference-семантики:
  // на каждую пару держим одну свежую запись — старые удаляем, новую создаём.
  // User-data это не трогает: ExchangeRate — справочник, не привязан к User.
  const rates: Array<[string, string, string]> = [
    ["USD", "RUB", "92.10"],
    ["EUR", "RUB", "98.40"],
    ["GEL", "RUB", "34.20"],
    ["BTC", "USD", "69420"],
    ["USDT", "RUB", "92.10"],
  ];

  for (const [from, to, rate] of rates) {
    await db.exchangeRate.deleteMany({ where: { fromCcy: from, toCcy: to } });
    await db.exchangeRate.create({
      data: { fromCcy: from, toCcy: to, rate, recordedAt: NOW },
    });
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
