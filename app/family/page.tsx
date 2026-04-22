import { FamilyBalances } from "@/components/family/balances";
import { FamilyStatusStrip } from "@/components/family/status-strip";
import { GroupHeader } from "@/components/family/group-header";
import { InviteBanner } from "@/components/family/invite-banner";
import { Members } from "@/components/family/members";
import { SharedFunds } from "@/components/family/shared-funds";
import { SharedLedger } from "@/components/family/shared-ledger";
import { SharedSubs } from "@/components/family/shared-subs";
import { SpaceTabs } from "@/components/family/space-tabs";

export default function FamilyPage() {
  return (
    <>
      <FamilyStatusStrip />
      <GroupHeader />
      <InviteBanner />
      <SpaceTabs />
      <Members />
      <FamilyBalances />
      <SharedLedger />
      <SharedFunds />
      <SharedSubs />
    </>
  );
}
