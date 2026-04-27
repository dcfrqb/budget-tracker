// TypeScript-only types for the Tinkoff Retail Playwright adapter. No runtime code.

export type TinkoffPlaywrightSecrets = {
  phone: string;
  pin: string;
  password?: string;
  storageState?: string;
  lastFastLoginAt?: number;
  lastFullLoginAt?: number;
};

export type TinkoffCurrency = {
  code: number;
  name: string;
};

export type TinkoffAmount = {
  value: number;
  currency: TinkoffCurrency;
};

export type TinkoffSpendingCategory = {
  id?: string;
  name: string;
  icon?: string;
};

export type TinkoffOperation = {
  id: string;
  account: string;
  operationTime: { milliseconds: number };
  type: "Credit" | "Debit";
  status: string;
  amount: TinkoffAmount;
  accountAmount?: TinkoffAmount;
  description: string;
  spendingCategory?: TinkoffSpendingCategory;
  mccString?: string;
  cardNumber?: string;
  // Fields we don't consume are omitted
};

export type TinkoffAccountSummary = {
  id: string;
  name: string;
  accountType: string;
  currency: {
    code: number;
    name: string;
  };
  moneyAmount: {
    value: number;
  };
};
