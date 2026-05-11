export const dynamic = "force-dynamic";

import {
  AvailableBlock,
  BalancesBlock,
  SafeUntilBlock,
  SessionStateBlock,
  SummaryShell,
} from "@/components/shell/summary/common";
import { SpaceSwitch, NoGroupBlock } from "@/components/shell/summary/family-client";
import { getCurrentUserId } from "@/lib/api/auth";
import { getUserFamily } from "@/lib/data/families";
import { getT } from "@/lib/i18n/server";

export default async function FamilySummary() {
  const [userId, t] = await Promise.all([getCurrentUserId(), getT()]);
  const family = await getUserFamily(userId);
  return (
    <SummaryShell>
      <SafeUntilBlock />
      <AvailableBlock />
      {family ? <SpaceSwitch /> : <NoGroupBlock />}
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
