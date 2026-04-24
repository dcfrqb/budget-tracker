import { FamilyBalances } from "@/components/family/balances";
import { FamilyStatusStrip } from "@/components/family/status-strip";
import { GroupHeader } from "@/components/family/group-header";
import { InviteBanner } from "@/components/family/invite-banner";
import { MembersManager } from "@/components/family/members-manager";
import { FamilySetup } from "@/components/family/family-setup";
import { SharedFunds } from "@/components/family/shared-funds";
import { SharedLedger } from "@/components/family/shared-ledger";
import { SharedSubs } from "@/components/family/shared-subs";
import { SpaceTabs } from "@/components/family/space-tabs";
import { getCurrentUserId } from "@/lib/api/auth";
import { getUserFamily, getFamilyWithMembers } from "@/lib/data/families";
import { getFundsWithProgress } from "@/lib/data/funds";
import { getSubscriptionsGrouped } from "@/lib/data/subscriptions";
import { getT } from "@/lib/i18n/server";
import Link from "next/link";
import type { GroupHeaderData } from "@/components/family/group-header";
import type { MemberCardView } from "@/components/family/members";
import type { SpaceTab } from "@/components/family/space-tabs";

export const dynamic = "force-dynamic";

const MONTH_KEYS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"] as const;

const MEMBER_COLORS = [
  "var(--accent)", "var(--info)", "var(--warn)", "var(--pos)",
  "var(--chart-5)", "var(--chart-6)", "var(--chart-7)",
];

export default async function FamilyPage() {
  const [userId, t] = await Promise.all([getCurrentUserId(), getT()]);

  const monthShort = MONTH_KEYS.map(k => t(`common.month.short.${k}` as Parameters<typeof t>[0]));

  function fmtDate(d: Date): string {
    return `${d.getUTCDate()} ${monthShort[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }

  const family = await getUserFamily(userId);

  // Static spaces (personal + shared)
  const spaces: SpaceTab[] = [
    {
      id: "personal",
      tag: t("family.space.personal_tag"),
      n: t("family.space.personal_name"),
      s: t("family.space.personal_sub"),
      amount: "—",
      amountLabel: t("family.space.personal_balance"),
    },
    {
      id: "shared",
      tag: t("family.space.shared_tag"),
      n: family?.name
        ? t("family.space.shared_name", { vars: { name: family.name } })
        : t("family.space.shared_name_default"),
      s: t("family.space.shared_sub"),
      amount: "—",
      amountLabel: t("family.space.shared_balance"),
    },
  ];

  // No family case — show setup component
  if (!family) {
    return (
      <>
        <FamilyStatusStrip />
        <GroupHeader group={undefined} />
        <FamilySetup />
        <SpaceTabs spaces={spaces} />
        <FamilyBalances flows={[]} />
        <SharedLedger rows={[]} />
        <SharedFunds funds={[]} />
        <SharedSubs rows={[]} />
      </>
    );
  }

  const familyWithMembers = await getFamilyWithMembers(family.id);
  const members = familyWithMembers?.members ?? [];

  // ── Group header ─────────────────────────────────────────────
  const groupData: GroupHeaderData = {
    name: family.name,
    sub: family.note ?? "",
    createdAt: fmtDate(family.createdAt),
    members: members.map((m, i) => ({
      letter: m.letter ?? m.displayName.charAt(0).toUpperCase(),
      color: m.color ?? MEMBER_COLORS[i % MEMBER_COLORS.length],
    })),
    stats: [],
  };

  // ── Members cards (for manager) ──────────────────────────────
  const memberViews: MemberCardView[] = members.map((m, i) => ({
    id: m.id,
    letter: m.letter ?? m.displayName.charAt(0).toUpperCase(),
    color: m.color ?? MEMBER_COLORS[i % MEMBER_COLORS.length],
    name: m.displayName,
    role: m.role.toLowerCase(),
    roleLabel: m.role === "OWNER" ? t("family.role.owner") : t("family.role.member"),
    since: fmtDate(m.joinedAt),
    stats: [],
    balK: t("family.member.balance_key"),
    balV: "—",
    balTone: "muted",
  }));

  // ── Shared funds (SHARED scope) ──────────────────────────────
  const allFunds = await getFundsWithProgress(userId);
  const sharedFundsRaw = allFunds.filter((f) => f.scope === "SHARED" && (!f.familyId || f.familyId === family.id));

  const sharedFundCards = sharedFundsRaw.map((f) => {
    const pct = Math.min(100, Math.round(f.progressPct));
    const dueLabel = f.targetDate
      ? `${monthShort[f.targetDate.getUTCMonth()]} ${f.targetDate.getUTCFullYear()}`
      : t("family.fund.no_deadline");
    return {
      id: f.id,
      kindLabel: t(`planning.fund_kind.${f.kind}` as Parameters<typeof t>[0]),
      due: dueLabel,
      name: f.name,
      sub: f.note ?? "",
      contrib: [{
        who: t("family.fund.contrib_total"),
        amount: `₽ ${Number(f.currentAmount.toFixed(0)).toLocaleString("ru-RU")}`,
        tone: "acc",
      }],
      pct,
      footV: t("family.fund.progress_label", { vars: { pct: String(pct), total: Number(f.goalAmount.toFixed(0)).toLocaleString("ru-RU") } }),
    };
  });

  // ── Shared subs ──────────────────────────────────────────────
  const subsGrouped = await getSubscriptionsGrouped(userId);
  const splitSubs = [...subsGrouped.split, ...subsGrouped.paidForOthers];

  const sharedSubRows = splitSubs.slice(0, 10).map((s) => {
    const sym = s.currencyCode === "RUB" ? "₽" : s.currencyCode === "USD" ? "$" : s.currencyCode === "EUR" ? "€" : s.currencyCode;
    return {
      id: s.id,
      icon: s.icon ?? s.name.charAt(0).toUpperCase(),
      iconBg: s.iconBg ?? "var(--panel)",
      iconColor: s.iconColor ?? "var(--text)",
      name: s.name,
      sub: "",
      badge: s.sharingType === "SPLIT" ? "split" : "pays",
      badgeLabel: s.sharingType === "SPLIT" ? t("family.sub.sharing") : t("family.sub.paid_for_others"),
      segments: [{ pct: 100, color: "var(--info)" }],
      members: members.slice(0, 3).map((m, i) => ({
        letter: m.letter ?? m.displayName.charAt(0).toUpperCase(),
        color: m.color ?? MEMBER_COLORS[i % MEMBER_COLORS.length],
      })),
      amount: `${sym} ${Number(s.price).toLocaleString("ru-RU")}`,
      your: t("family.your_share"),
    };
  });

  return (
    <>
      <FamilyStatusStrip />
      <GroupHeader group={groupData} />
      <div className="section-hd" style={{ padding: "8px 20px" }}>
        <Link
          href={`/family/${family.id}/edit`}
          className="btn-ghost"
          style={{ fontSize: 11, padding: "3px 8px" }}
        >
          {t("buttons.edit")}
        </Link>
      </div>
      <InviteBanner invite={undefined} />
      <SpaceTabs spaces={spaces} />
      <MembersManager familyId={family.id} members={memberViews} />
      <FamilyBalances flows={[]} />
      <SharedLedger rows={[]} />
      <SharedFunds funds={sharedFundCards} />
      <SharedSubs rows={sharedSubRows} />
    </>
  );
}
