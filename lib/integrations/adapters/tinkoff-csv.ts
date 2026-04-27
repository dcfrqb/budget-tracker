import type { BankAdapter } from "@/lib/integrations/types";
import { parseTinkoff } from "@/lib/import/parsers/tinkoff";
import type { ImportRow } from "@/lib/import/types";

/**
 * Tinkoff CSV adapter — wraps the existing parseTinkoff parser
 * under the BankAdapter.parseFile interface.
 *
 * No login or fetchTransactions — user exports CSV from Tinkoff app/web
 * and uploads it. Works fully offline, no credentials required.
 */
export const tinkoffCsvAdapter: BankAdapter = {
  id: "tinkoff-csv",
  displayName: "settings.integrations.adapter.tinkoff_csv",
  category: "csv",
  supports: {
    login: false,
    otp: false,
    fetchTransactions: false,
    parseFile: true,
    listExternalAccounts: false,
  },

  async parseFile(input: ArrayBuffer | string): Promise<ImportRow[]> {
    let text: string;
    if (typeof input === "string") {
      text = input;
    } else {
      // Try UTF-8 first; Tinkoff sometimes exports windows-1251 but modern exports are UTF-8.
      text = new TextDecoder("utf-8").decode(input);
    }

    const { rows } = parseTinkoff(text, { delimiter: ";" });
    return rows;
  },
};
