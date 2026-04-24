import {
  AvailableBlock,
  BalancesBlock,
  SafeUntilBlock,
  SummaryShell,
} from "@/components/shell/summary/common";
import { SettingsSummarySession } from "@/components/settings/settings-summary-session";

export default function SettingsSummary() {
  return (
    <SummaryShell>
      <SafeUntilBlock />
      <AvailableBlock />
      <BalancesBlock />
      <SettingsSummarySession />
    </SummaryShell>
  );
}
