export type ImportSource = "tinkoff" | "generic";

export type ImportRow = {
  externalId?: string;           // unique id from bank (if available)
  occurredAt: string;            // ISO
  amount: string;                // positive number as string (decimal)
  currencyCode: string;
  kind: "INCOME" | "EXPENSE" | "TRANSFER";
  rawCategory?: string;
  description?: string;
  counterparty?: string;
  raw: Record<string, string>;   // original row
};

export type ImportPreviewRow = ImportRow & {
  suggestedCategoryId?: string;
  selectedCategoryId?: string | null;
  included: boolean;
  isDuplicate: boolean;
};

export type ImportPreview = {
  rows: ImportPreviewRow[];
  warnings: string[];
  stats: { total: number; duplicates: number };
};

export type GenericMapping = {
  date: string;
  amount: string;
  currency?: string;
  category?: string;
  description?: string;
  delimiter?: string;
};
