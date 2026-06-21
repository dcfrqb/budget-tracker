import { describe, it, expect } from "vitest";
import {
  subscriptionCreateSchema,
  subscriptionUpdateSchema,
  subscriptionJsonItemSchema,
  subscriptionsBulkReplaceSchema,
  subscriptionPaySchema,
  markSubscriptionPaidSchema,
  confirmSubscriptionMatchSchema,
  unlinkSubscriptionTxnSchema,
  mergeSubscriptionsSchema,
  dismissDuplicatePairSchema,
  confirmReimbursementSchema,
} from "@/lib/validation/subscription";

const BASE_SUBSCRIPTION = {
  name: "Netflix",
  price: "599.00",
  currencyCode: "RUB",
  billingIntervalMonths: 1,
  nextPaymentDate: "2024-07-01T00:00:00.000Z",
  sharingType: "PERSONAL" as const,
};

describe("subscriptionCreateSchema", () => {
  it("accepts valid PERSONAL subscription", () => {
    const result = subscriptionCreateSchema.safeParse(BASE_SUBSCRIPTION);
    expect(result.success).toBe(true);
  });

  it("accepts SPLIT subscription with totalUsers >= 2", () => {
    const result = subscriptionCreateSchema.safeParse({
      ...BASE_SUBSCRIPTION,
      sharingType: "SPLIT",
      totalUsers: 3,
    });
    expect(result.success).toBe(true);
  });

  it("rejects SPLIT subscription without totalUsers", () => {
    const result = subscriptionCreateSchema.safeParse({
      ...BASE_SUBSCRIPTION,
      sharingType: "SPLIT",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("totalUsers"));
      expect(issue).toBeDefined();
    }
  });

  it("rejects SPLIT subscription with totalUsers = 1 (must be >= 2)", () => {
    const result = subscriptionCreateSchema.safeParse({
      ...BASE_SUBSCRIPTION,
      sharingType: "SPLIT",
      totalUsers: 1,
    });
    expect(result.success).toBe(false);
  });

  it("accepts SPLIT with exactly totalUsers = 2", () => {
    const result = subscriptionCreateSchema.safeParse({
      ...BASE_SUBSCRIPTION,
      sharingType: "SPLIT",
      totalUsers: 2,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing name", () => {
    const { name: _omit, ...rest } = BASE_SUBSCRIPTION;
    expect(subscriptionCreateSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects name longer than 200 chars", () => {
    const result = subscriptionCreateSchema.safeParse({
      ...BASE_SUBSCRIPTION,
      name: "x".repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it("rejects billingIntervalMonths = 0", () => {
    const result = subscriptionCreateSchema.safeParse({
      ...BASE_SUBSCRIPTION,
      billingIntervalMonths: 0,
    });
    expect(result.success).toBe(false);
  });

  it("accepts billingIntervalMonths = 120 (max)", () => {
    const result = subscriptionCreateSchema.safeParse({
      ...BASE_SUBSCRIPTION,
      billingIntervalMonths: 120,
    });
    expect(result.success).toBe(true);
  });

  it("rejects billingIntervalMonths = 121", () => {
    const result = subscriptionCreateSchema.safeParse({
      ...BASE_SUBSCRIPTION,
      billingIntervalMonths: 121,
    });
    expect(result.success).toBe(false);
  });

  it("accepts with optional matchKeywords", () => {
    const result = subscriptionCreateSchema.safeParse({
      ...BASE_SUBSCRIPTION,
      matchKeywords: ["netflix", "нетфликс"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts PAID_FOR_OTHERS sharingType without totalUsers restriction", () => {
    const result = subscriptionCreateSchema.safeParse({
      ...BASE_SUBSCRIPTION,
      sharingType: "PAID_FOR_OTHERS",
    });
    expect(result.success).toBe(true);
  });
});

describe("subscriptionUpdateSchema", () => {
  it("accepts empty patch", () => {
    const result = subscriptionUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts partial update with just price", () => {
    const result = subscriptionUpdateSchema.safeParse({ price: "699.00" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid price even in partial update", () => {
    const result = subscriptionUpdateSchema.safeParse({ price: "not-money" });
    expect(result.success).toBe(false);
  });
});

describe("subscriptionJsonItemSchema", () => {
  it("accepts item without id (new)", () => {
    const result = subscriptionJsonItemSchema.safeParse(BASE_SUBSCRIPTION);
    expect(result.success).toBe(true);
  });

  it("accepts item with id (update)", () => {
    const result = subscriptionJsonItemSchema.safeParse({
      ...BASE_SUBSCRIPTION,
      id: "sub123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects SPLIT item without totalUsers", () => {
    const result = subscriptionJsonItemSchema.safeParse({
      ...BASE_SUBSCRIPTION,
      sharingType: "SPLIT",
    });
    expect(result.success).toBe(false);
  });
});

describe("subscriptionsBulkReplaceSchema", () => {
  it("accepts empty array", () => {
    const result = subscriptionsBulkReplaceSchema.safeParse([]);
    expect(result.success).toBe(true);
  });

  it("accepts array with one valid item", () => {
    const result = subscriptionsBulkReplaceSchema.safeParse([BASE_SUBSCRIPTION]);
    expect(result.success).toBe(true);
  });

  it("rejects array with more than 500 items", () => {
    const items = Array.from({ length: 501 }, () => BASE_SUBSCRIPTION);
    expect(subscriptionsBulkReplaceSchema.safeParse(items).success).toBe(false);
  });
});

describe("subscriptionPaySchema", () => {
  it("accepts empty object (all optional)", () => {
    expect(subscriptionPaySchema.safeParse({}).success).toBe(true);
  });

  it("accepts accountId and paidAt", () => {
    const result = subscriptionPaySchema.safeParse({
      accountId: "acc123",
      paidAt: "2024-06-15T10:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });
});

describe("markSubscriptionPaidSchema", () => {
  it("accepts valid subscriptionId only", () => {
    const result = markSubscriptionPaidSchema.safeParse({ subscriptionId: "sub123" });
    expect(result.success).toBe(true);
  });

  it("rejects missing subscriptionId", () => {
    expect(markSubscriptionPaidSchema.safeParse({}).success).toBe(false);
  });
});

describe("confirmSubscriptionMatchSchema", () => {
  it("accepts valid transactionId and subscriptionId", () => {
    const result = confirmSubscriptionMatchSchema.safeParse({
      transactionId: "txn123",
      subscriptionId: "sub123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing transactionId", () => {
    expect(confirmSubscriptionMatchSchema.safeParse({ subscriptionId: "sub123" }).success).toBe(false);
  });
});

describe("unlinkSubscriptionTxnSchema", () => {
  it("accepts transactionId only", () => {
    const result = unlinkSubscriptionTxnSchema.safeParse({ transactionId: "txn123" });
    expect(result.success).toBe(true);
  });

  it("accepts with rollbackNextPaymentDate flag", () => {
    const result = unlinkSubscriptionTxnSchema.safeParse({
      transactionId: "txn123",
      rollbackNextPaymentDate: true,
    });
    expect(result.success).toBe(true);
  });
});

describe("mergeSubscriptionsSchema", () => {
  it("accepts keepId and mergeId", () => {
    const result = mergeSubscriptionsSchema.safeParse({ keepId: "sub1", mergeId: "sub2" });
    expect(result.success).toBe(true);
  });

  it("rejects missing mergeId", () => {
    expect(mergeSubscriptionsSchema.safeParse({ keepId: "sub1" }).success).toBe(false);
  });
});

describe("dismissDuplicatePairSchema", () => {
  it("accepts idA and idB", () => {
    const result = dismissDuplicatePairSchema.safeParse({ idA: "sub1", idB: "sub2" });
    expect(result.success).toBe(true);
  });
});

describe("confirmReimbursementSchema", () => {
  it("accepts valid input", () => {
    const result = confirmReimbursementSchema.safeParse({
      incomeTransactionId: "txn_income",
      spendTransactionId: "txn_spend",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing incomeTransactionId", () => {
    expect(
      confirmReimbursementSchema.safeParse({ spendTransactionId: "txn_spend" }).success,
    ).toBe(false);
  });
});
