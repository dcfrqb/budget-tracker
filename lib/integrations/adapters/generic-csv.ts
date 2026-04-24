import type { BankAdapter } from "@/lib/integrations/types";
import { parseGeneric } from "@/lib/import/parsers/generic";
import type { ImportRow } from "@/lib/import/types";
import type { GenericMapping } from "@/lib/import/types";

/**
 * Generic CSV adapter — wraps the existing parseGeneric parser
 * under the BankAdapter.parseFile interface.
 *
 * Requires a column mapping to be passed as the second argument to parseGeneric.
 * Since BankAdapter.parseFile only receives the file buffer, a default
 * minimal mapping (date, amount) is applied. For full control the caller
 * should use parseGeneric directly with a custom mapping.
 *
 * No login or fetchTransactions — file-only adapter.
 */

const DEFAULT_MAPPING: GenericMapping = {
  date: "date",
  amount: "amount",
  currency: "currency",
  category: "category",
  description: "description",
  delimiter: ",",
};

export const genericCsvAdapter: BankAdapter = {
  id: "generic-csv",
  displayName: "settings.integrations.adapter.generic_csv",
  category: "csv",
  supports: {
    login: false,
    otp: false,
    fetchTransactions: false,
    parseFile: true,
  },

  async parseFile(input: ArrayBuffer | string): Promise<ImportRow[]> {
    let text: string;
    if (typeof input === "string") {
      text = input;
    } else {
      text = new TextDecoder("utf-8").decode(input);
    }

    const { rows } = parseGeneric(text, { mapping: DEFAULT_MAPPING });
    return rows;
  },
};
