-- Drop the ReimbursementFact table
DROP TABLE "ReimbursementFact";

-- Remove REIMBURSEMENT from TransactionKind enum
-- In Postgres, we need to create a new enum type and swap it
ALTER TYPE "TransactionKind" RENAME TO "TransactionKind_old";

CREATE TYPE "TransactionKind" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER', 'LOAN_PAYMENT', 'DEBT_OUT', 'DEBT_IN');

ALTER TABLE "Transaction" ALTER COLUMN "kind" TYPE "TransactionKind" USING "kind"::text::"TransactionKind";

DROP TYPE "TransactionKind_old";

-- Remove the reimbursement-related columns from Transaction
ALTER TABLE "Transaction" DROP COLUMN "isReimbursable";
ALTER TABLE "Transaction" DROP COLUMN "reimbursementFromName";
ALTER TABLE "Transaction" DROP COLUMN "expectedReimbursement";
