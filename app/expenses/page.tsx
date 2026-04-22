import { ExpenseCategories } from "@/components/expenses/categories";
import { ExpensesKpiRow } from "@/components/expenses/kpi-row";
import { ExpensesStatusStrip } from "@/components/expenses/status-strip";
import { LongProjects } from "@/components/expenses/long-projects";
import { Loans } from "@/components/expenses/loans";
import { Subscriptions } from "@/components/expenses/subscriptions";
import { Taxes } from "@/components/expenses/taxes";

export default function ExpensesPage() {
  return (
    <>
      <ExpensesStatusStrip />
      <ExpensesKpiRow />
      <Loans />
      <Subscriptions />
      <LongProjects />
      <ExpenseCategories />
      <Taxes />
    </>
  );
}
