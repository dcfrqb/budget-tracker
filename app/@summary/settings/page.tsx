import {
  AvailableBlock,
  BalancesBlock,
  SafeUntilBlock,
  SessionStateBlock,
  SummaryShell,
} from "@/components/shell/summary/common";

export default function SettingsSummary() {
  return (
    <SummaryShell>
      <SafeUntilBlock />
      <AvailableBlock />
      <BalancesBlock />
      <SessionStateBlock
        rows={[
          { tone: "pos", k: "режим", v: "норма", vClass: "pos" },
          { tone: "muted", k: "вид", v: "настройки" },
        ]}
      />
    </SummaryShell>
  );
}
