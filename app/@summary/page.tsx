import {
  AvailableBlock,
  BalancesBlock,
  QuickButtons,
  SafeUntilBlock,
  SessionStateBlock,
  SummaryShell,
} from "@/components/shell/summary/common";
import { CashflowBlock } from "@/components/shell/summary/cashflow-block";

export default function HomeSummary() {
  return (
    <SummaryShell>
      <SafeUntilBlock />
      <AvailableBlock />
      <BalancesBlock />
      <CashflowBlock />
      <SessionStateBlock
        rows={[
          { tone: "pos", k: "режим", v: "норма" },
          { tone: "muted", k: "период", v: "30д" },
          { tone: "warn", k: "ближ. событие", v: "28 апр · 7д", vClass: "warn" },
        ]}
      />
      <QuickButtons />
    </SummaryShell>
  );
}
