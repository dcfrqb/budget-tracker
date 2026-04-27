// TypeScript-only types for the Tinkoff Retail adapter. No runtime code.

export type TinkoffSecrets = {
  sessionid?: string;
  wuid?: string;
  phone?: string;
  pendingTicket?: string; // present only between sign_up and confirm
  step?: "idle" | "awaiting_otp" | "ready";
  lastLevelUpAt?: number;
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
