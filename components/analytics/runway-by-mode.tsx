"use client";

import { useState } from "react";
import Link from "next/link";
import type { BudgetMode } from "@prisma/client";
import { Segmented } from "@/components/segmented";
import type { SegmentedOption } from "@/components/segmented";
import { useT, useLocale } from "@/lib/i18n";
import { formatDate } from "@/lib/format/date";
import { formatRubPrefix } from "@/lib/format/money";
import { Prisma } from "@prisma/client";
import type { RunwayDashboard } from "@/lib/data/analytics-runway";

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────

type Props = {
  data: RunwayDashboard;
  defaultMode: BudgetMode;
};

// ─────────────────────────────────────────────────────────────
// Mode segmented options — labels resolved at render time via t()
// ─────────────────────────────────────────────────────────────

const MODE_IDS: BudgetMode[] = ["ECONOMY", "NORMAL", "FREE"];

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function RunwayByMode({ data, defaultMode }: Props) {
  const t = useT();
  const locale = useLocale();

  const [selectedMode, setSelectedMode] = useState<BudgetMode>(defaultMode);

  const modeOptions: readonly SegmentedOption<BudgetMode>[] = [
    { id: "ECONOMY", label: t("home.status_strip.modes.econom") },
    { id: "NORMAL",  label: t("home.status_strip.modes.normal") },
    { id: "FREE",    label: t("home.status_strip.modes.free") },
  ];

  const runway = data.byMode[selectedMode];
  const hasLimits = runway.days !== null;

  // Format the "until" date — guard against invalid dates
  const untilDateObj = runway.untilDate ? new Date(runway.untilDate) : null;
  const untilFormatted =
    untilDateObj && !isNaN(untilDateObj.getTime())
      ? formatDate(untilDateObj, locale)
      : null;

  // Format top-category limits
  const topCats = runway.topCategoriesInMode;

  return (
    <div className="section runway-section fade-in" style={{ animationDelay: "440ms" }}>
      {/* Header */}
      <div className="section-hd">
        <div className="ttl mono">
          <b>{t("analytics.runway.title")}</b>
        </div>
        <div className="meta mono">
          {data.asOf}
        </div>
      </div>

      {/* Mode segmented control */}
      <div className="runway-seg-wrap">
        <Segmented<BudgetMode>
          options={modeOptions}
          value={selectedMode}
          onChange={setSelectedMode}
        />
      </div>

      {/* Body */}
      <div className="runway-body">
        {hasLimits ? (
          <>
            {/* Hero */}
            <div className="runway-hero">
              {untilFormatted && (
                <div className="runway-until mono">
                  {t("analytics.runway.until", { vars: { date: untilFormatted } })}
                </div>
              )}
              <div className="runway-days mono">
                {t("analytics.runway.days_remaining", { vars: { n: String(runway.days ?? 0) } })}
              </div>
            </div>

            {/* Top categories */}
            {topCats.length > 0 && (
              <div className="runway-breakdown">
                <div className="runway-breakdown-ttl mono">
                  {t("analytics.runway.breakdown.top_categories")}
                </div>
                <ul className="runway-breakdown-list">
                  {topCats.map((cat) => (
                    <li key={cat.categoryId} className="runway-breakdown-row mono">
                      <span className="runway-cat-name">{cat.name}</span>
                      <span className="runway-cat-limit num">
                        {formatRubPrefix(new Prisma.Decimal(cat.limitBase))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          /* Empty state */
          <div className="runway-empty">
            <div className="runway-empty-msg mono">
              {t("analytics.runway.empty.no_limits")}
            </div>
            <Link href="/settings/categories" className="runway-empty-cta mono">
              {t("analytics.runway.empty.cta_set_limits")}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
