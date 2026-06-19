import Link from "next/link";
import { getT } from "@/lib/i18n/server";

export interface WorkSourceCardView {
  id: string;
  kind: "EMPLOYMENT" | "FREELANCE" | "ONE_TIME" | null;
  kindLabel: string;
  name: string;
  sub?: string;
  currencyCode: string;
  rateAmount?: string;
  payDay?: number | null;
  taxLabel?: string;
  isActive: boolean;
  // Summary rows (from getWorkSourceCardSummaries)
  lastPaymentLabel?: string;
  mtdTotalLabel?: string;
  typicalMonthlyLabel?: string;
  nextExpectedLabel?: string;
}

const KIND_TAG_CLASS: Record<string, string> = {
  EMPLOYMENT: "ws-tag emp",
  FREELANCE:  "ws-tag fl",
  ONE_TIME:   "ws-tag other",
};

interface WorkSourcesSectionProps {
  items: WorkSourceCardView[];
}

export async function WorkSourcesSection({ items }: WorkSourcesSectionProps) {
  const t = await getT();

  return (
    <div className="section fade-in" style={{ animationDelay: "120ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>{t("settings.work_sources_summary.section_title")}</b>
          <span className="dim"> · {items.length}</span>
        </div>
        {items.length > 0 && (
          <div className="meta mono">
            <Link
              href="/income/work-sources/new"
              className="btn primary btn-xs"
            >
              {t("income.work_sources.add")}
            </Link>
          </div>
        )}
      </div>
      <div className="section-body flush">
        {items.length === 0 ? (
          <div className="ws-grid">
            <article className="ws-card add" tabIndex={0} style={{ gridColumn: "1 / -1" }}>
              <div style={{ textAlign: "center" }}>
                <div className="plus">+</div>
                <div className="mono" style={{ fontSize: "var(--text-sm)", color: "var(--muted)", marginBottom: 8 }}>
                  {t("income.work_sources.empty")}
                </div>
                <Link
                  href="/income/work-sources/new"
                  className="btn primary btn-sm"
                >
                  {t("income.work_sources.add")}
                </Link>
              </div>
            </article>
          </div>
        ) : (
          <div className="ws-grid">
            {items.map((src) => {
              const hasPaymentSummary = src.lastPaymentLabel || src.mtdTotalLabel || src.typicalMonthlyLabel || src.nextExpectedLabel;

              return (
                <Link
                  key={src.id}
                  href={`/income/work-sources/${src.id}`}
                  className="ws-card"
                  tabIndex={0}
                  style={{ display: "flex", flexDirection: "column", gap: 10, textDecoration: "none" }}
                >
                  <div className="ws-top" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className={KIND_TAG_CLASS[src.kind ?? ""] ?? "ws-tag other"}>{src.kindLabel}</span>
                    {src.payDay != null && (
                      <span className="mono" style={{ fontSize: "var(--text-2xs)", color: "var(--muted)" }}>
                        {src.payDay}
                      </span>
                    )}
                  </div>
                  <div className="ws-title">
                    {src.name}
                    {src.sub && <div className="sub">{src.sub}</div>}
                  </div>
                  <div className="ws-meta">
                    {src.rateAmount && (
                      <div>
                        <div className="k">{src.currencyCode}</div>
                        <div className="v pos">{src.rateAmount}</div>
                      </div>
                    )}
                    {src.taxLabel && (
                      <div>
                        <div className="k">{t("income.work.card.tax_label")}</div>
                        <div className="v">{src.taxLabel}</div>
                      </div>
                    )}
                  </div>

                  {/* Payment summary rows */}
                  {!hasPaymentSummary ? (
                    <div className="mono" style={{ fontSize: "var(--text-2xs)", color: "var(--muted)" }}>
                      {t("income.work.card.no_payments")}
                    </div>
                  ) : (
                    <div className="ws-meta" style={{ flexDirection: "column", gap: 4 }}>
                      {src.lastPaymentLabel && (
                        <div>
                          <div className="k">{t("income.work.card.last_payment")}</div>
                          <div className="v">{src.lastPaymentLabel}</div>
                        </div>
                      )}
                      {src.mtdTotalLabel && (
                        <div>
                          <div className="k">{t("income.work.card.mtd_total")}</div>
                          <div className="v pos">{src.mtdTotalLabel}</div>
                        </div>
                      )}
                      {src.typicalMonthlyLabel && (
                        <div>
                          <div className="k">{t("income.work.card.typical_monthly")}</div>
                          <div className="v">{src.typicalMonthlyLabel}</div>
                        </div>
                      )}
                      {src.nextExpectedLabel && (
                        <div>
                          <div className="k">{t("income.work.card.next_expected")}</div>
                          <div className="v">{src.nextExpectedLabel}</div>
                        </div>
                      )}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
