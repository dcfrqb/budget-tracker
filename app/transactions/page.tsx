import { ImportBar } from "@/components/transactions/import-bar";
import { PeriodSummary } from "@/components/transactions/period-summary";
import { PersonalDebts } from "@/components/transactions/personal-debts";
import { TxnFeed } from "@/components/transactions/txn-feed";
import { TxnStatusStrip } from "@/components/transactions/status-strip";
import { TxnToolbar } from "@/components/transactions/toolbar";

export default function TransactionsPage() {
  return (
    <>
      <TxnStatusStrip />
      <TxnToolbar />
      <PeriodSummary />
      <TxnFeed />
      <PersonalDebts />
      <ImportBar />
    </>
  );
}
