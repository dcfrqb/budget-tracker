"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Segmented } from "@/components/segmented";
import { useT } from "@/lib/i18n";

export type WalletGroup = "all" | "banks" | "crypto" | "cash" | "arch";

export type WalletStripProps = {
  /** Unique currency codes present across all user accounts (sorted). */
  currencies: string[];
  /** Month label e.g. "апр 2026" — computed server-side so it doesn't freeze on build. */
  monthLabel: string;
  /** Day-of-month progress string e.g. "д14/30" — pre-formatted server-side. */
  dayProgress: string;
};

export function WalletStatusStrip({ currencies, monthLabel, dayProgress }: WalletStripProps) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentGroup = (searchParams.get("group") ?? "all") as WalletGroup;
  const currentCcy = searchParams.get("ccy") ?? "all";

  function setGroup(value: WalletGroup) {
    const next = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      next.delete("group");
    } else {
      next.set("group", value);
    }
    const qs = next.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ""}`);
  }

  function setCcy(value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      next.delete("ccy");
    } else {
      next.set("ccy", value);
    }
    const qs = next.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ""}`);
  }

  const groupOptions = [
    { id: "all" as const, label: t("wallet.strip.group_all") },
    { id: "banks" as const, label: t("wallet.strip.group_banks") },
    { id: "crypto" as const, label: t("wallet.strip.group_crypto") },
    { id: "cash" as const, label: t("wallet.strip.group_cash") },
    { id: "arch" as const, label: t("wallet.strip.group_arch") },
  ];

  const ccyOptions = [
    { id: "all", label: t("wallet.strip.currency_all") },
    ...currencies.map((code) => ({ id: code, label: code })),
  ];

  return (
    <div className="status-strip fade-in" style={{ animationDelay: "0ms" }}>
      <span className="lbl">{t("wallet.strip.group")}</span>
      <Segmented options={groupOptions} value={currentGroup} onChange={setGroup} />
      <span className="lbl">{t("wallet.strip.currency")}</span>
      <Segmented options={ccyOptions} value={currentCcy} onChange={setCcy} />
      <div className="clock-right">
        <span>{monthLabel} · <b>{dayProgress}</b></span>
      </div>
    </div>
  );
}
