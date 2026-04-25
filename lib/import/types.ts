export type ImportSource = "tinkoff" | "generic";

export type ImportRow = {
  externalId?: string;           // unique id from bank (if available)
  occurredAt: string;            // ISO
  amount: string;                // positive number as string (decimal)
  currencyCode: string;
  kind: "INCOME" | "EXPENSE" | "TRANSFER";
  direction: "in" | "out";       // preserves original sign even after TRANSFER promotion
  cardLast4?: string;            // 4 digits extracted from card column (no asterisk)
  rawCategory?: string;
  description?: string;
  counterparty?: string;
  raw: Record<string, string>;   // original row
};

export type ImportPreviewRow = ImportRow & {
  accountId: string;             // explicit per-row target account
  sourceFile: string;            // filename for display
  suggestedCategoryId?: string;
  selectedCategoryId?: string | null;
  included: boolean;
  isDuplicate: boolean;
  pairStatus?: "paired-transfer" | "intra-account-skipped" | "unpaired";
  pairId?: string;
  pairWith?: number;             // index of partner row in consolidated array
  cardHint?: {
    last4: string;
    suggestedAccountId?: string; // another user account that has this card
  };
};

export type ImportPreview = {
  rows: ImportPreviewRow[];
  warnings: string[];
  accounts: Array<{
    id: string;
    name: string;
    currencyCode: string;
    cardLast4: string[];
  }>;
  stats: {
    total: number;
    duplicates: number;
    paired: number;       // number of transfer pairs (paired-transfer rows / 2)
    intraSkipped: number; // number of intra-account pairs (intra-account-skipped rows / 2)
    unpaired: number;     // number of unpaired transfer rows
  };
};

export type GenericMapping = {
  date: string;
  amount: string;
  currency?: string;
  category?: string;
  description?: string;
  delimiter?: string;
};
