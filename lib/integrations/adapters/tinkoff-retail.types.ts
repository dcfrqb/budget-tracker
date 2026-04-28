// TypeScript-only types for the Tinkoff Retail Playwright adapter. No runtime code.

export type TinkoffPlaywrightSecrets = {
  phone: string;
  pin: string;
  password?: string;
  storageState?: string;
  sessionid?: string;
  wuid?: string;
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

export type TinkoffCard = {
  number?: string; // masked card number, e.g. "553691******2919"
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
  cardNumber?: string; // top-level masked card number (some account types)
  cards?: TinkoffCard[]; // nested card list (some account types)
  creditLimit?: TinkoffAmount; // credit limit for credit accounts
  debtBalance?: TinkoffAmount; // current debt balance for credit accounts
  currentMinimalPayment?: TinkoffAmount; // current minimal payment for credit accounts
};
