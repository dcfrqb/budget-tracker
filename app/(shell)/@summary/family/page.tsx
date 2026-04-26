import {
  AvailableBlock,
  BalancesBlock,
  SafeUntilBlock,
  SessionStateBlock,
  SummaryShell,
} from "@/components/shell/summary/common";
import { SpaceSwitch, NoGroupBlock } from "@/components/shell/summary/family-client";
import { getT } from "@/lib/i18n/server";

export default async function FamilySummary() {
  const t = await getT();
  return (
    <SummaryShell>
      <SafeUntilBlock />
      <AvailableBlock />
      <NoGroupBlock />
      <SpaceSwitch />
      <BalancesBlock />
      <SessionStateBlock
        rows={[
          { tone: "pos", k: t("summary.family.mode_key"), v: t("summary.family.mode_val"), vClass: "pos" },
          { tone: "muted", k: t("summary.family.group_key"), v: t("summary.family.group_none"), vClass: "muted" },
        ]}
      />
    </SummaryShell>
  );
}
