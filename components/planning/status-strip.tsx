"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Segmented } from "@/components/segmented";
import { useT } from "@/lib/i18n";

type View = "all" | "calendar" | "funds" | "buys" | "trips";
type Horizon = "30d" | "90d" | "1y" | "all";

const VALID_VIEWS: View[] = ["all", "calendar", "funds", "buys", "trips"];
const VALID_HORIZONS: Horizon[] = ["30d", "90d", "1y", "all"];

export function PlanningStatusStrip({
  monthLabel,
  dayLabel,
}: {
  monthLabel: string;
  dayLabel: string;
}) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const rawView = searchParams.get("view") ?? "all";
  const rawHorizon = searchParams.get("horizon") ?? "90d";
  const view: View = VALID_VIEWS.includes(rawView as View) ? (rawView as View) : "all";
  const horizon: Horizon = VALID_HORIZONS.includes(rawHorizon as Horizon) ? (rawHorizon as Horizon) : "90d";

  const isCalendarPage = pathname === "/planning/calendar";

  function handleViewChange(v: View) {
    if (v === "calendar") {
      router.replace(`/planning/calendar?horizon=${horizon}`, { scroll: false });
    } else if (isCalendarPage) {
      router.replace(`/planning?view=${v}&horizon=${horizon}`, { scroll: false });
    } else {
      const params = new URLSearchParams(searchParams.toString());
      params.set("view", v);
      router.replace(`/planning?${params.toString()}`, { scroll: false });
    }
  }

  function handleHorizonChange(h: Horizon) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("horizon", h);
    if (isCalendarPage) {
      router.replace(`/planning/calendar?${params.toString()}`, { scroll: false });
    } else {
      router.replace(`/planning?${params.toString()}`, { scroll: false });
    }
  }

  const currentView: View = isCalendarPage ? "calendar" : view;

  const VIEWS: { id: View; label: string }[] = [
    { id: "all",      label: t("planning.status_strip.view_all") },
    { id: "calendar", label: t("planning.status_strip.view_calendar") },
    { id: "funds",    label: t("planning.status_strip.view_funds") },
    { id: "buys",     label: t("planning.status_strip.view_buys") },
    { id: "trips",    label: t("planning.status_strip.view_trips") },
  ];

  const HORIZONS: { id: Horizon; label: string }[] = [
    { id: "30d", label: t("planning.status_strip.horizon_30d") },
    { id: "90d", label: t("planning.status_strip.horizon_90d") },
    { id: "1y",  label: t("planning.status_strip.horizon_1y") },
    { id: "all", label: t("planning.status_strip.horizon_all") },
  ];

  return (
    <div className="status-strip fade-in" style={{ animationDelay: "0ms" }}>
      <span className="lbl">{t("planning.status_strip.view_label")}</span>
      <Segmented options={VIEWS} value={currentView} onChange={handleViewChange} />
      <span className="lbl">{t("planning.status_strip.horizon_label")}</span>
      <Segmented options={HORIZONS} value={horizon} onChange={handleHorizonChange} />
      <div className="clock-right">
        <span>
          {monthLabel} · <b title={t("planning.status_strip.day_hint")}>{dayLabel}</b>
        </span>
      </div>
    </div>
  );
}
