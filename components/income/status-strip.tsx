"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useT } from "@/lib/i18n";
import { Segmented } from "@/components/segmented";

type View = "sources" | "expected" | "other";
type Period = "30d" | "90d" | "1y" | "all";

export function IncomeStatusStrip() {
  const t = useT();
  const router = useRouter();
  const sp = useSearchParams();

  const view = (sp.get("tab") as View) ?? "sources";
  const period = (sp.get("period") as Period) ?? "90d";

  const VIEWS: { id: View; label: string }[] = [
    { id: "sources",  label: t("income.filter.view_sources") },
    { id: "expected", label: t("income.filter.view_expected") },
    { id: "other",    label: t("income.filter.view_other") },
  ];

  const PERIODS: { id: Period; label: string }[] = [
    { id: "30d", label: t("income.filter.period_30d") },
    { id: "90d", label: t("income.filter.period_90d") },
    { id: "1y",  label: t("income.filter.period_1y") },
    { id: "all", label: t("income.filter.period_all") },
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
      <span className="lbl">{t("income.filter.label_view")}</span>
      <Segmented
        options={VIEWS}
        value={view}
        onChange={(v) => push("tab", v)}
      />
      <span className="lbl">{t("income.filter.label_period")}</span>
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
