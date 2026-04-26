import Link from "next/link";
import { getT } from "@/lib/i18n/server";

export interface WorkSourceCardView {
  id: string;
  kind: "EMPLOYMENT" | "FREELANCE" | "ONE_TIME";
  kindLabel: string;
  name: string;
  sub?: string;
  currencyCode: string;
  baseAmount?: string;
  hourlyRate?: string;
  payDay?: number | null;
  taxLabel?: string;
  isActive: boolean;
}

const KIND_TAG_CLASS: Record<WorkSourceCardView["kind"], string> = {
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
              className="btn primary"
              style={{ padding: "3px 9px", fontSize: 10 }}
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
                <div className="mono" style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
                  {t("income.work_sources.empty")}
                </div>
                <Link
                  href="/income/work-sources/new"
                  className="btn primary"
                  style={{ fontSize: 11, padding: "5px 14px" }}
                >
                  {t("income.work_sources.add")}
                </Link>
              </div>
            </article>
          </div>
        ) : (
          <div className="ws-grid">
            {items.map((src) => (
              <Link
                key={src.id}
                href={`/income/work-sources/${src.id}/edit`}
                className="ws-card"
                tabIndex={0}
                style={{ display: "flex", flexDirection: "column", gap: 10, textDecoration: "none" }}
              >
                <div className="ws-top" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className={KIND_TAG_CLASS[src.kind]}>{src.kindLabel}</span>
                  {src.payDay != null && (
                    <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>
                      {src.payDay}
                    </span>
                  )}
                </div>
                <div className="ws-title">
                  {src.name}
                  {src.sub && <div className="sub">{src.sub}</div>}
                </div>
                <div className="ws-meta">
                  {src.baseAmount && (
                    <div>
                      <div className="k">{src.currencyCode}</div>
                      <div className="v pos">{src.baseAmount}</div>
                    </div>
                  )}
                  {src.hourlyRate && (
                    <div>
                      <div className="k">/h</div>
                      <div className="v acc">{src.hourlyRate}</div>
                    </div>
                  )}
                  {src.taxLabel && (
                    <div>
                      <div className="k">tax</div>
                      <div className="v">{src.taxLabel}</div>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
