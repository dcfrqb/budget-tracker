import { Prisma } from "@prisma/client";
import { formatMoney } from "@/lib/format/money";
import type { HomeDashboard, UpcomingObligation, TopCategoryDelta } from "@/lib/data/dashboard";
import type { TKey } from "@/lib/i18n/t";
import type { TOptions } from "@/lib/i18n/types";

type TFunc = (key: TKey, options?: TOptions) => string;

// ─────────────────────────────────────────────────────────────
// Home view types — приближены к mock-форме для механической
// замены мок-данных в components/home/* (Фаза 9).
// ─────────────────────────────────────────────────────────────

export type HomeStatusView = {
  label: string;       // "СТАБИЛЬНО" | "ВНИМАНИЕ" | "КРИЗИС"
  tone: "pos" | "warn" | "neg";
};

export type HomePlanFactCell = {
  code: string;
  kind: "inc" | "exp" | "net";
  fact: number;        // for CountUp
  plan: number;
  sign: string;        // "" | "+" | "−"
  sub: string;
  color: "pos" | "neg" | "info" | "acc";
  noPlan?: boolean;
};

export type HomeObligationView = {
  id: string;
  tag: "LOAN" | "SUB" | "PLAN" | "DEBT" | "CARD";
  tagClass: "loan" | "sub" | "util" | "info" | "warn";
  name: string;
  sub: string;
  date: string;        // "28.04 · 7д"
  amount: string;      // "₽ 57 400"
  meta: string;
};

export type HomeTopCategoryView = {
  rank: string;        // "01" … "03"
  name: string;
  sub: string;
  amount: string;      // "₽ 32 140"
  delta: string;       // "▲ 18.3%" | "▼ 6.1%"
  deltaDir: "up" | "down" | "same" | "new";
};

export type HomeBalanceView = {
  sym: string;
  display: string;    // "284 120 ₽"
};

export type HomeSafeUntilView = {
  days: number | null;
  label: string;     // "47 дн" | "∞" (если null)
};

export type HomeAvailableView = {
  freeBase: number;
  totalBase: number;
  reservedBase: number;
  /** Sum of spendable money across debit/credit-available/cash/crypto — display value for "Доступно сейчас". */
  liquidBase: number;
};

export type HomeView = {
  status: HomeStatusView;
  safeUntil: HomeSafeUntilView;
  available: HomeAvailableView;
  planFact: HomePlanFactCell[];
  obligations: HomeObligationView[];
  topCategories: HomeTopCategoryView[];
  balances: HomeBalanceView[];
  budgetMode: "ECONOMY" | "NORMAL" | "FREE";
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<HomeDashboard["status"], string> = {
  stable: "СТАБИЛЬНО",
  warning: "ВНИМАНИЕ",
  crisis: "КРИЗИС",
};

const STATUS_TONE: Record<HomeDashboard["status"], "pos" | "warn" | "neg"> = {
  stable: "pos",
  warning: "warn",
  crisis: "neg",
};

const OBLIGATION_TAG: Record<UpcomingObligation["kind"], "LOAN" | "SUB" | "PLAN" | "DEBT" | "CARD"> = {
  loan: "LOAN",
  subscription: "SUB",
  planned: "PLAN",
  debt: "DEBT",
  credit_card: "CARD",
};

const OBLIGATION_CLASS: Record<UpcomingObligation["kind"], "loan" | "sub" | "util" | "info" | "warn"> = {
  loan: "loan",
  subscription: "sub",
  planned: "util",
  debt: "info",
  credit_card: "warn",
};

function formatDueAt(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
  const day = date.getUTCDate().toString().padStart(2, "0");
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  return `${day}.${month} · ${diffDays}д`;
}

function formatBaseAmount(amountBaseStr: string): string {
  return formatMoney(new Prisma.Decimal(amountBaseStr), "RUB");
}

function toObligationView(ob: UpcomingObligation): HomeObligationView {
  return {
    id: ob.id,
    tag: OBLIGATION_TAG[ob.kind],
    tagClass: OBLIGATION_CLASS[ob.kind],
    name: ob.label,
    sub: `${ob.currencyCode} · ${ob.kind}`,
    date: formatDueAt(ob.dueAt),
    amount: formatBaseAmount(ob.amountBase),
    meta: ob.kind,
  };
}

function toTopCategoryView(cat: TopCategoryDelta, rank: number): HomeTopCategoryView {
  const current = new Prisma.Decimal(cat.currentMonthBase);
  const pct = cat.deltaPct;
  let delta = "—";
  let deltaDir: "up" | "down" | "same" | "new" = "same";

  if (pct !== null) {
    if (pct > 0) {
      delta = `▲ ${Math.abs(pct).toFixed(1)}%`;
      deltaDir = "up";
    } else if (pct < 0) {
      delta = `▼ ${Math.abs(pct).toFixed(1)}%`;
      deltaDir = "down";
    } else {
      delta = "0.0%";
    }
  } else if (current.gt(0)) {
    // Category appeared this month (no prior data) — signal via deltaDir
    delta = "";
    deltaDir = "new";
  }

  return {
    rank: String(rank).padStart(2, "0"),
    name: cat.categoryName,
    sub: cat.icon ? cat.icon : "",
    amount: formatMoney(current, "RUB"),
    delta,
    deltaDir,
  };
}

// ─────────────────────────────────────────────────────────────
// Main mapper
// ─────────────────────────────────────────────────────────────

export function toHomeView(dashboard: HomeDashboard, t?: TFunc): HomeView {
  const totalBase = Number(new Prisma.Decimal(dashboard.totalBalanceBase).toFixed(0));
  const reservedBase = Number(new Prisma.Decimal(dashboard.reservedBase).toFixed(0));
  const freeBase = Number(new Prisma.Decimal(dashboard.freeBase).toFixed(0));
  const liquidBase = Number(new Prisma.Decimal(dashboard.liquidBase).toFixed(0));

  const inflowFact = Number(new Prisma.Decimal(dashboard.planFactMonth.inflowFactBase).toFixed(0));
  const inflowPlan = Number(new Prisma.Decimal(dashboard.planFactMonth.inflowPlanBase).toFixed(0));
  const outflowFact = Number(new Prisma.Decimal(dashboard.planFactMonth.outflowFactBase).toFixed(0));
  const outflowPlan = Number(new Prisma.Decimal(dashboard.planFactMonth.outflowPlanBase).toFixed(0));
  const netFact = inflowFact - outflowFact;
  const netPlan = inflowPlan - outflowPlan;

  const hasInflowPlan = dashboard.planFactMonth.hasInflowPlan;
  const hasOutflowPlan = dashboard.planFactMonth.hasOutflowPlan;

  // TODO Фаза 9: сверить с компонентом plan-fact.tsx — он ожидает пары code/kind/fact/plan/currency/sub/color
  const planFact: HomePlanFactCell[] = [
    {
      code: "ДОХОД",
      kind: "inc",
      fact: inflowFact,
      plan: inflowPlan,
      sign: "",
      sub: hasInflowPlan
        ? `из ${formatMoney(new Prisma.Decimal(inflowPlan), "RUB")} · ${Math.round((inflowFact / inflowPlan) * 100)}%`
        : "",
      noPlan: !hasInflowPlan,
      color: "pos",
    },
    {
      code: "РАСХОД",
      kind: "exp",
      fact: outflowFact,
      plan: outflowPlan,
      sign: "",
      sub: hasOutflowPlan
        ? `из ${formatMoney(new Prisma.Decimal(outflowPlan), "RUB")} · ${Math.round((outflowFact / outflowPlan) * 100)}%`
        : "",
      noPlan: !hasOutflowPlan,
      color: "info",
    },
    {
      code: "НЕТТО",
      kind: "net",
      fact: Math.abs(netFact),
      plan: Math.abs(netPlan),
      sign: netFact > 0 ? "+" : netFact < 0 ? "−" : "",
      sub: netPlan !== 0
        ? (() => {
            const amount = `${netPlan >= 0 ? "+" : "−"}${formatMoney(new Prisma.Decimal(Math.abs(netPlan)), "RUB")}`;
            return t
              ? t("home.plan_fact.net_eom_sub", { vars: { amount } })
              : `кон. мес ≈ ${amount}`;
          })()
        : "",
      noPlan: !hasInflowPlan && !hasOutflowPlan,
      color: netFact > 0 ? "pos" : netFact < 0 ? "neg" : "acc",
    },
  ];

  return {
    status: {
      label: STATUS_LABEL[dashboard.status],
      tone: STATUS_TONE[dashboard.status],
    },
    safeUntil: {
      days: dashboard.safeUntilDays,
      label: dashboard.safeUntilDays !== null ? `${dashboard.safeUntilDays} дн` : "∞",
    },
    available: {
      freeBase,
      totalBase,
      reservedBase,
      liquidBase,
    },
    planFact,
    obligations: dashboard.upcomingObligations30d.map(toObligationView),
    topCategories: dashboard.topCategoriesDelta.map((c, i) => toTopCategoryView(c, i + 1)),
    // TODO Фаза 9: компонент summary-rail читает BALANCES из mock — передавай этот массив туда
    balances: dashboard.balances.map((b) => ({
      sym: b.currencyCode,
      display: (() => {
        // Примитивный форматированный вывод суммы со символом — для MVP
        // TODO Фаза 9: заменить на formatAmount с правильным Currency объектом
        const dec = new Prisma.Decimal(b.amount);
        const formatted = dec.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
        return formatted;
      })(),
    })),
    budgetMode: dashboard.budgetMode,
  };
}
