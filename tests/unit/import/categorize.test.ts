import { describe, it, expect } from "vitest";
import { isTransferCategory, suggestCategory } from "@/lib/import/categorize";
import type { CategoryLike } from "@/lib/import/categorize";
import type { ImportRow } from "@/lib/import/types";

// ─────────────────────────────────────────────────────────────
// isTransferCategory
// ─────────────────────────────────────────────────────────────

describe("isTransferCategory", () => {
  it("returns true for 'переводы'", () => {
    expect(isTransferCategory("переводы")).toBe(true);
  });

  it("returns true for 'Переводы' (case-insensitive)", () => {
    expect(isTransferCategory("Переводы")).toBe(true);
  });

  it("returns true for 'перевод'", () => {
    expect(isTransferCategory("перевод")).toBe(true);
  });

  it("returns true for 'пополнение'", () => {
    expect(isTransferCategory("пополнение")).toBe(true);
  });

  it("returns true for 'перевод между счетами'", () => {
    expect(isTransferCategory("перевод между счетами")).toBe(true);
  });

  it("returns true for 'внутренний перевод'", () => {
    expect(isTransferCategory("внутренний перевод")).toBe(true);
  });

  it("returns false for 'Супермаркеты'", () => {
    expect(isTransferCategory("Супермаркеты")).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isTransferCategory(undefined)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isTransferCategory("")).toBe(false);
  });

  it("handles leading/trailing whitespace", () => {
    expect(isTransferCategory("  переводы  ")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// suggestCategory
// ─────────────────────────────────────────────────────────────

const CATEGORIES: CategoryLike[] = [
  { id: "cat_food", name: "Еда", kind: "EXPENSE" },
  { id: "cat_restaurant", name: "Рестораны", kind: "EXPENSE" },
  { id: "cat_auto", name: "Авто", kind: "EXPENSE" },
  { id: "cat_transport", name: "Транспорт", kind: "EXPENSE" },
  { id: "cat_health", name: "Здоровье", kind: "EXPENSE" },
  { id: "cat_sub", name: "Подписки", kind: "EXPENSE" },
  { id: "cat_income", name: "Зарплата", kind: "INCOME" },
];

function makeRow(overrides: Partial<ImportRow>): ImportRow {
  return {
    occurredAt: "2024-06-15T12:00:00.000Z",
    amount: "100.00",
    currencyCode: "RUB",
    kind: "EXPENSE",
    direction: "out",
    raw: {},
    ...overrides,
  };
}

describe("suggestCategory", () => {
  it("returns undefined when row has no rawCategory", () => {
    const row = makeRow({ rawCategory: undefined });
    expect(suggestCategory(row, CATEGORIES)).toBeUndefined();
  });

  it("returns undefined for TRANSFER rows (no category)", () => {
    const row = makeRow({ kind: "TRANSFER", rawCategory: "Переводы" });
    expect(suggestCategory(row, CATEGORIES)).toBeUndefined();
  });

  it("matches exact category name (case-insensitive)", () => {
    const row = makeRow({ rawCategory: "рестораны" });
    expect(suggestCategory(row, CATEGORIES)).toBe("cat_restaurant");
  });

  it("matches via alias 'супермаркеты' → 'еда'", () => {
    const row = makeRow({ rawCategory: "Супермаркеты" });
    expect(suggestCategory(row, CATEGORIES)).toBe("cat_food");
  });

  it("matches via alias 'топливо' → 'авто'", () => {
    const row = makeRow({ rawCategory: "топливо" });
    expect(suggestCategory(row, CATEGORIES)).toBe("cat_auto");
  });

  it("matches via alias 'такси' → 'транспорт'", () => {
    const row = makeRow({ rawCategory: "такси" });
    expect(suggestCategory(row, CATEGORIES)).toBe("cat_transport");
  });

  it("matches via alias 'аптеки' → 'здоровье'", () => {
    const row = makeRow({ rawCategory: "аптеки" });
    expect(suggestCategory(row, CATEGORIES)).toBe("cat_health");
  });

  it("matches via alias 'подписки' → 'подписки'", () => {
    const row = makeRow({ rawCategory: "подписки" });
    expect(suggestCategory(row, CATEGORIES)).toBe("cat_sub");
  });

  it("returns undefined for transfer alias categories ('переводы' → empty alias)", () => {
    const row = makeRow({ rawCategory: "переводы" });
    expect(suggestCategory(row, CATEGORIES)).toBeUndefined();
  });

  it("filters by kind — INCOME row only matches INCOME categories", () => {
    const row = makeRow({ kind: "INCOME", rawCategory: "зарплата" });
    const result = suggestCategory(row, CATEGORIES);
    expect(result).toBe("cat_income");
  });

  it("does not match EXPENSE category for INCOME row", () => {
    const row = makeRow({ kind: "INCOME", rawCategory: "Рестораны" });
    // No INCOME category named "рестораны" exists
    expect(suggestCategory(row, CATEGORIES)).toBeUndefined();
  });

  it("returns undefined for completely unknown category with no alias or partial match", () => {
    const row = makeRow({ rawCategory: "ВегоСтатусНеизвестен" });
    expect(suggestCategory(row, CATEGORIES)).toBeUndefined();
  });

  it("falls back to partial name match if no exact/alias match", () => {
    // "Еда в магазине" — contains "еда" which is a category name substring
    const row = makeRow({ rawCategory: "еда в магазине" });
    expect(suggestCategory(row, CATEGORIES)).toBe("cat_food");
  });
});
