import type { ImportRow } from "./types";

/**
 * Raw bank category names that indicate an internal transfer.
 * Used by parsers to set kind = "TRANSFER" before categorisation.
 */
const TRANSFER_CATEGORIES = new Set([
  "переводы",
  "перевод",
  "пополнение",
  "перевод между счетами",
  "внутренний перевод",
]);

/**
 * Returns true when the raw CSV category string represents an inter-account
 * transfer that should be excluded from income/expense totals.
 */
export function isTransferCategory(raw: string | undefined): boolean {
  if (!raw) return false;
  return TRANSFER_CATEGORIES.has(raw.toLowerCase().trim());
}

export type CategoryLike = {
  id: string;
  name: string;
  kind: string;
};

/**
 * Maps bank category names (from CSV) to user category names.
 * Keys are lowercase bank category names; values are lowercase user category name substrings to match.
 */
const CATEGORY_ALIASES: Record<string, string> = {
  // Tinkoff categories
  "супермаркеты": "еда",
  "продукты": "еда",
  "рестораны": "рестораны",
  "кафе и рестораны": "рестораны",
  "кофе": "рестораны",
  "топливо": "авто",
  "автозаправки": "авто",
  "заправки": "авто",
  "авто": "авто",
  "такси": "транспорт",
  "транспорт": "транспорт",
  "метро": "транспорт",
  "подписки": "подписки",
  "онлайн-сервисы": "подписки",
  "связь": "связь",
  "мобильная связь": "связь",
  "аптеки": "здоровье",
  "здоровье": "здоровье",
  "медицина": "здоровье",
  "одежда и обувь": "одежда",
  "одежда": "одежда",
  "электроника": "техника",
  "техника": "техника",
  "развлечения": "развлечения",
  "спорт": "спорт",
  "фитнес": "спорт",
  "образование": "образование",
  "путешествия": "путешествия",
  "отели": "путешествия",
  "авиабилеты": "путешествия",
  "коммунальные услуги": "жкх",
  "жкх": "жкх",
  "ремонт": "дом",
  "дом": "дом",
  // Skip transfers — don't map to any category
  "переводы": "",
  "перевод": "",
  "пополнение": "",
};

/**
 * Suggests a user category for an import row based on the raw bank category.
 *
 * Rules:
 * 1. Exact case-insensitive match between rawCategory and category.name.
 * 2. Lookup in CATEGORY_ALIASES (rawCategory → partial name to match).
 * 3. If no match — returns undefined.
 */
export function suggestCategory(
  row: ImportRow,
  categories: CategoryLike[],
): string | undefined {
  if (!row.rawCategory) return undefined;
  // Transfers have no category
  if (row.kind === "TRANSFER") return undefined;

  const rawLower = row.rawCategory.toLowerCase().trim();

  // Filter categories by kind matching row.kind
  const kindFilter = row.kind === "INCOME" ? "INCOME" : "EXPENSE";
  const filtered = categories.filter((c) => c.kind === kindFilter);

  // 1. Exact match
  const exactMatch = filtered.find(
    (c) => c.name.toLowerCase() === rawLower,
  );
  if (exactMatch) return exactMatch.id;

  // 2. Alias lookup
  const aliasTarget = CATEGORY_ALIASES[rawLower];
  if (aliasTarget === "") return undefined; // explicitly skip (transfers)
  if (aliasTarget) {
    const aliasMatch = filtered.find((c) =>
      c.name.toLowerCase().includes(aliasTarget),
    );
    if (aliasMatch) return aliasMatch.id;
  }

  // 3. Partial name match (rawCategory contains category name or vice versa)
  const partialMatch = filtered.find(
    (c) =>
      rawLower.includes(c.name.toLowerCase()) ||
      c.name.toLowerCase().includes(rawLower),
  );
  if (partialMatch) return partialMatch.id;

  return undefined;
}
