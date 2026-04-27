import type { BankAdapter } from "@/lib/integrations/types";
import { tinkoffCsvAdapter } from "./adapters/tinkoff-csv";
import { genericCsvAdapter } from "./adapters/generic-csv";
import { tinkoffEmailAdapter } from "./adapters/tinkoff-email";
import { tinkoffRetailAdapter } from "./adapters/tinkoff-retail-playwright";

const ADAPTERS: BankAdapter[] = [
  tinkoffCsvAdapter,
  genericCsvAdapter,
  tinkoffEmailAdapter,
  tinkoffRetailAdapter,
];

const ADAPTER_MAP = new Map<string, BankAdapter>(
  ADAPTERS.map((a) => [a.id, a]),
);

export function getAdapters(): BankAdapter[] {
  return ADAPTERS;
}

export function getAdapter(id: string): BankAdapter | null {
  return ADAPTER_MAP.get(id) ?? null;
}
