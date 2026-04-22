import { ExpectedIncome } from "@/components/income/expected";
import { IncomeKpiRow } from "@/components/income/kpi-row";
import { IncomeSignals } from "@/components/income/signals";
import { IncomeStatusStrip } from "@/components/income/status-strip";
import { OtherIncome } from "@/components/income/other-income";
import { WorkSourcesSection } from "@/components/income/work-sources";

export default function IncomePage() {
  return (
    <>
      <IncomeStatusStrip />
      <IncomeKpiRow />
      <WorkSourcesSection />
      <ExpectedIncome />
      <OtherIncome />
      <IncomeSignals />
    </>
  );
}
