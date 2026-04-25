"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useT } from "@/lib/i18n";
import { Segmented } from "@/components/segmented";

type Sec = "all" | "loans" | "subs" | "projects" | "taxes";
type Period = "30d" | "90d" | "1y" | "all";

export function ExpensesStatusStrip() {
  const t = useT();
  const router = useRouter();
  const sp = useSearchParams();

  const section = (sp.get("section") as Sec) ?? "all";
  const period = (sp.get("period") as Period) ?? "90d";

  const SECTIONS: { id: Sec; label: string }[] = [
    { id: "all",      label: t("expenses.filter.section_all") },
    { id: "loans",    label: t("expenses.filter.section_loans") },
    { id: "subs",     label: t("expenses.filter.section_subs") },
    { id: "projects", label: t("expenses.filter.section_projects") },
    { id: "taxes",    label: t("expenses.filter.section_taxes") },
  ];

  const PERIODS: { id: Period; label: string }[] = [
    { id: "30d", label: t("expenses.filter.period_30d") },
    { id: "90d", label: t("expenses.filter.period_90d") },
    { id: "1y",  label: t("expenses.filter.period_1y") },
    { id: "all", label: t("expenses.filter.period_all") },
  ];

  const push = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(sp.toString());
      params.set(key, value);
      router.push(`?${params.toString()}`, { scroll: false });
    },
    [sp, router],
  );

  const now = new Date();
  const monthDay = now.getDate();
  const monthDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  return (
    <div className="status-strip fade-in" style={{ animationDelay: "0ms" }}>
      <span className="lbl">{t("expenses.filter.label_section")}</span>
      <Segmented
        options={SECTIONS}
        value={section}
        onChange={(v) => push("section", v)}
      />
      <span className="lbl">{t("expenses.filter.label_period")}</span>
      <Segmented
        options={PERIODS}
        value={period}
        onChange={(v) => push("period", v)}
      />
      <div className="clock-right">
        <span>
          {now.getFullYear()} · <b>{t("common.unit.day")}{monthDay}/{monthDays}</b>
        </span>
      </div>
    </div>
  );
}
