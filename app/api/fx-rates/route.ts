import { db } from "@/lib/db";
import { ok, serverError } from "@/lib/api/response";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

type PairFilter = { fromCcy: string; toCcy: string };

function parsePairs(raw: string | null): PairFilter[] | null {
  if (!raw) return null;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [from, to] = s.split("-");
      return { fromCcy: from, toCcy: to };
    })
    .filter((p) => p.fromCcy && p.toCcy);
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const pairs = parsePairs(url.searchParams.get("pairs"));

    // Берём достаточно большое окно, группируем в JS. На реальных объёмах
    // переписать на DISTINCT ON / window func — сейчас история по 1 записи на пару.
    const rows = await db.exchangeRate.findMany({
      where: pairs
        ? { OR: pairs.map((p) => ({ fromCcy: p.fromCcy, toCcy: p.toCcy })) }
        : undefined,
      orderBy: { recordedAt: "desc" },
    });

    const byPair = new Map<string, typeof rows>();
    for (const r of rows) {
      const key = `${r.fromCcy}-${r.toCcy}`;
      const list = byPair.get(key);
      if (list) list.push(r);
      else byPair.set(key, [r]);
    }

    const DAY_MS = 24 * 60 * 60 * 1000;
    const result = [...byPair.values()].map((list) => {
      const latest = list[0];
      const cutoff = new Date(latest.recordedAt.getTime() - DAY_MS);
      const prev = list.find((r) => r.recordedAt <= cutoff);
      let delta24hPct: string | null = null;
      if (prev) {
        const prevRate = new Prisma.Decimal(prev.rate);
        const latestRate = new Prisma.Decimal(latest.rate);
        if (!prevRate.isZero()) {
          const pct = latestRate.minus(prevRate).div(prevRate).times(100);
          delta24hPct = pct.toFixed(2);
        }
      }
      return {
        fromCcy: latest.fromCcy,
        toCcy: latest.toCcy,
        rate: latest.rate,
        recordedAt: latest.recordedAt,
        delta24hPct,
      };
    });

    return ok(result);
  } catch (e) {
    return serverError(e);
  }
}
