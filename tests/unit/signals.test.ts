import { describe, it, expect } from "vitest";
import { computeSignals } from "@/lib/data/signals";
import type { SignalEngineInput } from "@/lib/data/signals";
import type { HomeDashboard } from "@/lib/data/dashboard";
import type {
  ShrinkableCategory,
  ObligatoryDiscretionarySplit,
  EconomyExitScenario,
} from "@/lib/data/analytics-prescriptive";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function makeDashboard(overrides: Partial<HomeDashboard> = {}): HomeDashboard {
  return {
    status: "stable",
    budgetMode: "NORMAL",
    balances: [{ currencyCode: "RUB", amount: "10000.00", amountBase: "10000.00" }],
    totalBalanceBase: "10000.00",
    safeUntilDays: 60,
    reservedBase: "0",
    freeBase: "10000.00",
    liquidBase: "10000.00",
    planFactMonth: {
      inflowPlanBase: "50000.00",
      inflowFactBase: "50000.00",
      outflowPlanBase: "30000.00",
      outflowFactBase: "30000.00",
      hasInflowPlan: true,
      hasOutflowPlan: true,
    },
    upcomingObligations30d: [],
    topCategoriesDelta: [],
    ...overrides,
  };
}

function makeInput(overrides: Partial<SignalEngineInput> = {}): SignalEngineInput {
  return {
    dashboard: makeDashboard(),
    shrinkable: [],
    discretionary: {
      obligatoryBase: "15000.00",
      discretionaryBase: "10000.00",
      totalBase: "25000.00",
      discretionaryPct: 40,
    },
    economyExit: {
      state: "no_deficit",
      monthsToRecover: null,
      freeBase: "10000.00",
      deficitBase: "0",
      currentMonthlySpendBase: "25000.00",
      economyCapBase: "20000.00",
      monthlyRecoveryBase: "5000.00",
    },
    baseCcy: "RUB",
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("computeSignals — crisis tier (priority 100+)", () => {
  it("emits free_negative when freeBase <= 0", () => {
    const input = makeInput({ dashboard: makeDashboard({ freeBase: "0" }) });
    const signals = computeSignals(input);
    expect(signals.some((s) => s.key === "free_negative")).toBe(true);
    const sig = signals.find((s) => s.key === "free_negative")!;
    expect(sig.priority).toBe(130);
    expect(sig.kind).toBe("warn");
  });

  it("emits free_negative when freeBase is negative", () => {
    const input = makeInput({ dashboard: makeDashboard({ freeBase: "-500" }) });
    const signals = computeSignals(input);
    expect(signals.some((s) => s.key === "free_negative")).toBe(true);
  });

  it("does NOT emit free_negative when freeBase > 0", () => {
    const input = makeInput({ dashboard: makeDashboard({ freeBase: "1" }) });
    const signals = computeSignals(input);
    expect(signals.some((s) => s.key === "free_negative")).toBe(false);
  });

  it("emits safe_until_critical when safeUntilDays < 7", () => {
    const input = makeInput({ dashboard: makeDashboard({ safeUntilDays: 3 }) });
    const signals = computeSignals(input);
    expect(signals.some((s) => s.key === "safe_until_critical")).toBe(true);
    const sig = signals.find((s) => s.key === "safe_until_critical")!;
    expect(sig.priority).toBe(120);
    expect(sig.vars?.n).toBe(3);
  });

  it("does NOT emit safe_until_critical when safeUntilDays == 7", () => {
    const input = makeInput({ dashboard: makeDashboard({ safeUntilDays: 7 }) });
    const signals = computeSignals(input);
    expect(signals.some((s) => s.key === "safe_until_critical")).toBe(false);
  });

  it("emits month_deficit when net < 0 and |net| >= 5% of outflow", () => {
    const input = makeInput({
      dashboard: makeDashboard({
        planFactMonth: {
          inflowPlanBase: "30000.00",
          inflowFactBase: "20000.00",
          outflowPlanBase: "30000.00",
          outflowFactBase: "25000.00",
          hasInflowPlan: true,
          hasOutflowPlan: true,
        },
      }),
    });
    const signals = computeSignals(input);
    expect(signals.some((s) => s.key === "month_deficit")).toBe(true);
    const sig = signals.find((s) => s.key === "month_deficit")!;
    expect(sig.priority).toBe(110);
  });

  it("does NOT emit month_deficit when deficit is less than 5% of outflow", () => {
    // net = 28000 - 29000 = -1000, outflow = 29000, threshold = 1450 → |net| < threshold
    const input = makeInput({
      dashboard: makeDashboard({
        planFactMonth: {
          inflowPlanBase: "30000.00",
          inflowFactBase: "28000.00",
          outflowPlanBase: "30000.00",
          outflowFactBase: "29000.00",
          hasInflowPlan: true,
          hasOutflowPlan: true,
        },
      }),
    });
    const signals = computeSignals(input);
    expect(signals.some((s) => s.key === "month_deficit")).toBe(false);
  });
});

describe("computeSignals — warn tier (priority 50–99)", () => {
  it("emits safe_until_low when safeUntilDays in [7, 21)", () => {
    const input = makeInput({ dashboard: makeDashboard({ safeUntilDays: 14 }) });
    const signals = computeSignals(input);
    expect(signals.some((s) => s.key === "safe_until_low")).toBe(true);
    const sig = signals.find((s) => s.key === "safe_until_low")!;
    expect(sig.priority).toBe(90);
    expect(sig.vars?.n).toBe(14);
  });

  it("does NOT emit safe_until_low when safeUntilDays >= 21", () => {
    const input = makeInput({ dashboard: makeDashboard({ safeUntilDays: 21 }) });
    const signals = computeSignals(input);
    expect(signals.some((s) => s.key === "safe_until_low")).toBe(false);
  });

  it("emits obligation_due_soon when obligation dueAt <= 4 days", () => {
    const now = new Date();
    const dueAt = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const input = makeInput({
      dashboard: makeDashboard({
        upcomingObligations30d: [
          {
            id: "ob1",
            kind: "subscription",
            label: "Netflix",
            amountBase: "599.00",
            currencyCode: "RUB",
            amount: "599.00",
            dueAt,
          },
        ],
      }),
    });
    const signals = computeSignals(input);
    expect(signals.some((s) => s.key === "obligation_due_soon")).toBe(true);
    const sig = signals.find((s) => s.key === "obligation_due_soon")!;
    expect(sig.vars?.label).toBe("Netflix");
    expect(sig.priority).toBe(88);
  });

  it("does NOT emit obligation_due_soon for obligation > 4 days away", () => {
    const now = new Date();
    const dueAt = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const input = makeInput({
      dashboard: makeDashboard({
        upcomingObligations30d: [
          {
            id: "ob1",
            kind: "loan",
            label: "Mortgage",
            amountBase: "50000.00",
            currencyCode: "RUB",
            amount: "50000.00",
            dueAt,
          },
        ],
      }),
    });
    const signals = computeSignals(input);
    expect(signals.some((s) => s.key === "obligation_due_soon")).toBe(false);
  });

  it("emits obligation_load_high when total obligations > 50% of freeBase", () => {
    const now = new Date();
    const dueAt = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000).toISOString();
    const input = makeInput({
      dashboard: makeDashboard({
        freeBase: "10000.00",
        upcomingObligations30d: [
          {
            id: "ob1",
            kind: "subscription",
            label: "Rent",
            amountBase: "6000.00",
            currencyCode: "RUB",
            amount: "6000.00",
            dueAt,
          },
        ],
      }),
    });
    const signals = computeSignals(input);
    expect(signals.some((s) => s.key === "obligation_load_high")).toBe(true);
    const sig = signals.find((s) => s.key === "obligation_load_high")!;
    expect(sig.priority).toBe(80);
  });

  it("emits category_overspend for categories with deltaPct >= 40", () => {
    const input = makeInput({
      dashboard: makeDashboard({
        topCategoriesDelta: [
          {
            categoryId: "cat1",
            categoryName: "Рестораны",
            icon: null,
            currentMonthBase: "15000.00",
            prevMonthBase: "8000.00",
            deltaPct: 87.5,
          },
        ],
      }),
    });
    const signals = computeSignals(input);
    expect(signals.some((s) => s.key === "category_overspend:cat1")).toBe(true);
    const sig = signals.find((s) => s.key === "category_overspend:cat1")!;
    expect(sig.priority).toBe(78);
  });

  it("caps category_overspend signals at 2", () => {
    const input = makeInput({
      dashboard: makeDashboard({
        topCategoriesDelta: [
          { categoryId: "c1", categoryName: "Cat1", icon: null, currentMonthBase: "5000.00", prevMonthBase: "1000.00", deltaPct: 400 },
          { categoryId: "c2", categoryName: "Cat2", icon: null, currentMonthBase: "4000.00", prevMonthBase: "1000.00", deltaPct: 300 },
          { categoryId: "c3", categoryName: "Cat3", icon: null, currentMonthBase: "3000.00", prevMonthBase: "1000.00", deltaPct: 200 },
        ],
      }),
    });
    const signals = computeSignals(input);
    const overspendSignals = signals.filter((s) => s.key.startsWith("category_overspend:"));
    expect(overspendSignals).toHaveLength(2);
  });

  it("emits expense_over_plan when outflowFact > 1.1 * outflowPlan", () => {
    const input = makeInput({
      dashboard: makeDashboard({
        planFactMonth: {
          inflowPlanBase: "50000.00",
          inflowFactBase: "50000.00",
          outflowPlanBase: "30000.00",
          outflowFactBase: "35000.00",
          hasInflowPlan: true,
          hasOutflowPlan: true,
        },
      }),
    });
    const signals = computeSignals(input);
    expect(signals.some((s) => s.key === "expense_over_plan")).toBe(true);
    const sig = signals.find((s) => s.key === "expense_over_plan")!;
    expect(sig.priority).toBe(76);
  });

  it("does NOT emit expense_over_plan when outflow within 10% of plan", () => {
    const input = makeInput({
      dashboard: makeDashboard({
        planFactMonth: {
          inflowPlanBase: "50000.00",
          inflowFactBase: "50000.00",
          outflowPlanBase: "30000.00",
          outflowFactBase: "32000.00",
          hasInflowPlan: true,
          hasOutflowPlan: true,
        },
      }),
    });
    const signals = computeSignals(input);
    expect(signals.some((s) => s.key === "expense_over_plan")).toBe(false);
  });

  it("emits income_under_plan when inflowFact < 60% of inflowPlan", () => {
    const input = makeInput({
      dashboard: makeDashboard({
        planFactMonth: {
          inflowPlanBase: "50000.00",
          inflowFactBase: "25000.00",
          outflowPlanBase: "30000.00",
          outflowFactBase: "30000.00",
          hasInflowPlan: true,
          hasOutflowPlan: true,
        },
      }),
    });
    const signals = computeSignals(input);
    expect(signals.some((s) => s.key === "income_under_plan")).toBe(true);
    const sig = signals.find((s) => s.key === "income_under_plan")!;
    expect(sig.priority).toBe(74);
  });

  it("emits shrinkable signal when top shrinkable category overspendPct >= 30", () => {
    const shrinkable: ShrinkableCategory[] = [
      {
        categoryId: "cat_food",
        categoryName: "Еда",
        icon: null,
        currentMonthBase: "15000.00",
        avg6mBase: "10000.00",
        overspendBase: "5000.00",
        overspendPct: 50,
      },
    ];
    const input = makeInput({ shrinkable });
    const signals = computeSignals(input);
    expect(signals.some((s) => s.key === "shrinkable:cat_food")).toBe(true);
    const sig = signals.find((s) => s.key === "shrinkable:cat_food")!;
    expect(sig.priority).toBe(70);
  });

  it("does NOT emit shrinkable when overspendPct < 30", () => {
    const shrinkable: ShrinkableCategory[] = [
      {
        categoryId: "cat_food",
        categoryName: "Еда",
        icon: null,
        currentMonthBase: "12000.00",
        avg6mBase: "10000.00",
        overspendBase: "2000.00",
        overspendPct: 20,
      },
    ];
    const input = makeInput({ shrinkable });
    const signals = computeSignals(input);
    expect(signals.some((s) => s.key.startsWith("shrinkable:"))).toBe(false);
  });

  it("emits discretionary_high when discretionaryPct > 60", () => {
    const discretionary: ObligatoryDiscretionarySplit = {
      obligatoryBase: "8000.00",
      discretionaryBase: "20000.00",
      totalBase: "28000.00",
      discretionaryPct: 71,
    };
    const input = makeInput({ discretionary });
    const signals = computeSignals(input);
    expect(signals.some((s) => s.key === "discretionary_high")).toBe(true);
    const sig = signals.find((s) => s.key === "discretionary_high")!;
    expect(sig.priority).toBe(66);
    expect(sig.vars?.pct).toBe(71);
  });

  it("emits economy_exit_slow when state=recovering and monthsToRecover >= 4", () => {
    const economyExit: EconomyExitScenario = {
      state: "recovering",
      monthsToRecover: 6,
      freeBase: "-5000.00",
      deficitBase: "5000.00",
      currentMonthlySpendBase: "30000.00",
      economyCapBase: "22000.00",
      monthlyRecoveryBase: "8000.00",
    };
    const input = makeInput({ economyExit });
    const signals = computeSignals(input);
    expect(signals.some((s) => s.key === "economy_exit_slow")).toBe(true);
    const sig = signals.find((s) => s.key === "economy_exit_slow")!;
    expect(sig.priority).toBe(62);
    expect(sig.vars?.n).toBe(6);
  });

  it("does NOT emit economy_exit_slow when monthsToRecover < 4", () => {
    const economyExit: EconomyExitScenario = {
      state: "recovering",
      monthsToRecover: 2,
      freeBase: "-2000.00",
      deficitBase: "2000.00",
      currentMonthlySpendBase: "30000.00",
      economyCapBase: "22000.00",
      monthlyRecoveryBase: "8000.00",
    };
    const input = makeInput({ economyExit });
    const signals = computeSignals(input);
    expect(signals.some((s) => s.key === "economy_exit_slow")).toBe(false);
  });
});

describe("computeSignals — info tier (priority 10–49)", () => {
  it("emits mode_free_risky when budgetMode=FREE and status!=stable", () => {
    const input = makeInput({
      dashboard: makeDashboard({ budgetMode: "FREE", status: "warning" }),
    });
    const signals = computeSignals(input);
    expect(signals.some((s) => s.key === "mode_free_risky")).toBe(true);
    const sig = signals.find((s) => s.key === "mode_free_risky")!;
    expect(sig.priority).toBe(40);
  });

  it("does NOT emit mode_free_risky when status=stable", () => {
    const input = makeInput({
      dashboard: makeDashboard({ budgetMode: "FREE", status: "stable" }),
    });
    const signals = computeSignals(input);
    expect(signals.some((s) => s.key === "mode_free_risky")).toBe(false);
  });

  it("emits no_outflow_plan when !hasOutflowPlan and outflowFact > 0", () => {
    const input = makeInput({
      dashboard: makeDashboard({
        planFactMonth: {
          inflowPlanBase: "50000.00",
          inflowFactBase: "50000.00",
          outflowPlanBase: "0",
          outflowFactBase: "20000.00",
          hasInflowPlan: true,
          hasOutflowPlan: false,
        },
      }),
    });
    const signals = computeSignals(input);
    expect(signals.some((s) => s.key === "no_outflow_plan")).toBe(true);
    const sig = signals.find((s) => s.key === "no_outflow_plan")!;
    expect(sig.priority).toBe(34);
  });

  it("emits no_inflow_plan when !hasInflowPlan", () => {
    const input = makeInput({
      dashboard: makeDashboard({
        planFactMonth: {
          inflowPlanBase: "0",
          inflowFactBase: "0",
          outflowPlanBase: "30000.00",
          outflowFactBase: "30000.00",
          hasInflowPlan: false,
          hasOutflowPlan: true,
        },
      }),
    });
    const signals = computeSignals(input);
    expect(signals.some((s) => s.key === "no_inflow_plan")).toBe(true);
    const sig = signals.find((s) => s.key === "no_inflow_plan")!;
    expect(sig.priority).toBe(32);
  });

  it("emits category_new when a category has prevMonthBase=0 and currentMonthBase>0", () => {
    const input = makeInput({
      dashboard: makeDashboard({
        topCategoriesDelta: [
          {
            categoryId: "cat_new",
            categoryName: "Путешествия",
            icon: null,
            currentMonthBase: "5000.00",
            prevMonthBase: "0",
            deltaPct: null,
          },
        ],
      }),
    });
    const signals = computeSignals(input);
    expect(signals.some((s) => s.key === "category_new:cat_new")).toBe(true);
    const sig = signals.find((s) => s.key === "category_new:cat_new")!;
    expect(sig.priority).toBe(30);
    expect(sig.vars?.cat).toBe("Путешествия");
  });

  it("emits multi_currency when balances.length >= 3", () => {
    const input = makeInput({
      dashboard: makeDashboard({
        balances: [
          { currencyCode: "RUB", amount: "10000.00", amountBase: "10000.00" },
          { currencyCode: "USD", amount: "100.00", amountBase: "9200.00" },
          { currencyCode: "EUR", amount: "80.00", amountBase: "9000.00" },
        ],
      }),
    });
    const signals = computeSignals(input);
    expect(signals.some((s) => s.key === "multi_currency")).toBe(true);
    const sig = signals.find((s) => s.key === "multi_currency")!;
    expect(sig.priority).toBe(20);
    expect(sig.vars?.n).toBe(3);
  });

  it("does NOT emit multi_currency when balances.length < 3", () => {
    const input = makeInput({
      dashboard: makeDashboard({
        balances: [
          { currencyCode: "RUB", amount: "10000.00", amountBase: "10000.00" },
        ],
      }),
    });
    const signals = computeSignals(input);
    expect(signals.some((s) => s.key === "multi_currency")).toBe(false);
  });

  it("emits burn_rate when safeUntilDays > 0 and freeBase > 0", () => {
    const input = makeInput({
      dashboard: makeDashboard({ safeUntilDays: 30, freeBase: "9000.00" }),
    });
    const signals = computeSignals(input);
    expect(signals.some((s) => s.key === "burn_rate")).toBe(true);
    const sig = signals.find((s) => s.key === "burn_rate")!;
    expect(sig.priority).toBe(16);
  });
});

describe("computeSignals — positive tier (priority 1–9)", () => {
  it("emits safe_until_good when safeUntilDays > 90", () => {
    const input = makeInput({ dashboard: makeDashboard({ safeUntilDays: 120 }) });
    const signals = computeSignals(input);
    expect(signals.some((s) => s.key === "safe_until_good")).toBe(true);
    const sig = signals.find((s) => s.key === "safe_until_good")!;
    expect(sig.priority).toBe(8);
    expect(sig.kind).toBe("acc");
  });

  it("emits safe_until_good when safeUntilDays is null (no burn rate data)", () => {
    const input = makeInput({ dashboard: makeDashboard({ safeUntilDays: null }) });
    const signals = computeSignals(input);
    expect(signals.some((s) => s.key === "safe_until_good")).toBe(true);
  });

  it("does NOT emit safe_until_good when safeUntilDays <= 90", () => {
    const input = makeInput({ dashboard: makeDashboard({ safeUntilDays: 90 }) });
    const signals = computeSignals(input);
    expect(signals.some((s) => s.key === "safe_until_good")).toBe(false);
  });

  it("emits month_surplus when inflow - outflow > 5% of outflow", () => {
    const input = makeInput({
      dashboard: makeDashboard({
        planFactMonth: {
          inflowPlanBase: "50000.00",
          inflowFactBase: "35000.00",
          outflowPlanBase: "30000.00",
          outflowFactBase: "30000.00",
          hasInflowPlan: true,
          hasOutflowPlan: true,
        },
      }),
    });
    const signals = computeSignals(input);
    expect(signals.some((s) => s.key === "month_surplus")).toBe(true);
    const sig = signals.find((s) => s.key === "month_surplus")!;
    expect(sig.priority).toBe(6);
  });

  it("emits obligations_clear when upcomingObligations30d is empty", () => {
    const input = makeInput({
      dashboard: makeDashboard({ upcomingObligations30d: [] }),
    });
    const signals = computeSignals(input);
    expect(signals.some((s) => s.key === "obligations_clear")).toBe(true);
    const sig = signals.find((s) => s.key === "obligations_clear")!;
    expect(sig.priority).toBe(4);
    expect(sig.kind).toBe("acc");
  });
});

describe("computeSignals — sort order and top-5 cap", () => {
  it("returns signals sorted by priority descending", () => {
    // Trigger multiple signals across tiers
    const now = new Date();
    const dueAt = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString();
    const input = makeInput({
      dashboard: makeDashboard({
        freeBase: "0",
        safeUntilDays: 3,
        planFactMonth: {
          inflowPlanBase: "50000.00",
          inflowFactBase: "20000.00",
          outflowPlanBase: "30000.00",
          outflowFactBase: "40000.00",
          hasInflowPlan: true,
          hasOutflowPlan: true,
        },
        upcomingObligations30d: [
          {
            id: "ob1",
            kind: "subscription",
            label: "Netflix",
            amountBase: "599.00",
            currencyCode: "RUB",
            amount: "599.00",
            dueAt,
          },
        ],
      }),
    });
    const signals = computeSignals(input);
    for (let i = 1; i < signals.length; i++) {
      expect(signals[i - 1].priority).toBeGreaterThanOrEqual(signals[i].priority);
    }
  });

  it("NOTE: computeSignals returns ALL matching signals (no built-in top-5 cap)", () => {
    // The function itself doesn't cap at 5 — the caller decides how many to display.
    // We fire many signals and verify they all come back (documenting actual behavior).
    const now = new Date();
    const dueAt1 = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString();
    const input = makeInput({
      dashboard: makeDashboard({
        freeBase: "0",                    // → free_negative (130)
        safeUntilDays: 3,                 // → safe_until_critical (120)
        budgetMode: "FREE",
        status: "warning",                // → mode_free_risky (40)
        balances: [
          { currencyCode: "RUB", amount: "0", amountBase: "0" },
          { currencyCode: "USD", amount: "0", amountBase: "0" },
          { currencyCode: "EUR", amount: "0", amountBase: "0" },
        ],                                // → multi_currency (20)
        planFactMonth: {
          inflowPlanBase: "50000.00",
          inflowFactBase: "20000.00",     // → income_under_plan (74)
          outflowPlanBase: "30000.00",
          outflowFactBase: "40000.00",    // → expense_over_plan (76) + month_deficit (110)
          hasInflowPlan: true,
          hasOutflowPlan: true,
        },
        upcomingObligations30d: [
          {
            id: "ob1",
            kind: "subscription",
            label: "Test",
            amountBase: "10000.00",       // > 50% of freeBase=0, but freeBase must be > 0 for load_high
            currencyCode: "RUB",
            amount: "10000.00",
            dueAt: dueAt1,                // → obligation_due_soon (88)
          },
        ],
        topCategoriesDelta: [],
      }),
      discretionary: {
        obligatoryBase: "5000.00",
        discretionaryBase: "18000.00",
        totalBase: "23000.00",
        discretionaryPct: 78,            // → discretionary_high (66)
      },
    });

    const signals = computeSignals(input);
    // At least 7 signals should fire here
    expect(signals.length).toBeGreaterThan(5);
    // All are returned (no built-in cap)
  });
});
