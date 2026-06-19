import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import type { WorkSource } from "@prisma/client";
import { DetailActions } from "./detail-actions";

interface Props {
  source: WorkSource;
}

const KIND_TAG_CLASS: Record<string, string> = {
  EMPLOYMENT: "ws-tag emp",
  FREELANCE: "ws-tag fl",
  ONE_TIME: "ws-tag other",
};

export async function DetailHeader({ source }: Props) {
  const t = await getT();

  const kindLabelKey =
    source.kind === "EMPLOYMENT"
      ? "income.work.kind_label.employment"
      : source.kind === "FREELANCE"
        ? "income.work.kind_label.freelance"
        : source.kind === "ONE_TIME"
          ? "income.work.kind_label.one_time"
          : "income.work.kind_label.source";

  const kindLabel = t(kindLabelKey as Parameters<typeof t>[0]);

  const startedStr = source.startedAt
    ? t("income.work.detail.lifecycle.started", {
        vars: { date: source.startedAt.toISOString().slice(0, 10) },
      })
    : null;

  const endedStr = source.endedAt
    ? t("income.work.detail.lifecycle.ended", {
        vars: { date: source.endedAt.toISOString().slice(0, 10) },
      })
    : null;

  return (
    <div
      className="section"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <div
        style={{
          padding: "var(--sp-4) var(--sp-3)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--sp-2)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--sp-2)",
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/income"
            className="mono"
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--muted)",
              textDecoration: "none",
            }}
          >
            ← {t("income.work.detail.back")}
          </Link>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "var(--sp-2)",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className={KIND_TAG_CLASS[source.kind ?? ""] ?? "ws-tag other"}>
                {kindLabel}
              </span>
              {!source.isActive && (
                <span
                  className="mono"
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--muted)",
                    border: "1px solid var(--border)",
                    borderRadius: 3,
                    padding: "1px 6px",
                  }}
                >
                  {t("income.work.detail.lifecycle.archived")}
                </span>
              )}
            </div>
            <div
              style={{
                fontSize: "var(--text-lg)",
                fontWeight: 600,
                color: "var(--text)",
              }}
            >
              {source.name}
            </div>
            {(startedStr || endedStr) && (
              <div
                className="mono"
                style={{ fontSize: "var(--text-xs)", color: "var(--muted)" }}
              >
                {startedStr}
                {startedStr && endedStr ? " · " : ""}
                {endedStr}
              </div>
            )}
            <div
              className="mono"
              style={{ fontSize: "var(--text-xs)", color: "var(--muted)" }}
            >
              {source.currencyCode}
            </div>
          </div>

          <div style={{ display: "flex", gap: "var(--sp-2)", flexWrap: "wrap" }}>
            <Link
              href={`/income/work-sources/${source.id}/edit`}
              className="btn btn-sm"
            >
              {t("income.work.detail.edit")}
            </Link>
            <DetailActions
              sourceId={source.id}
              isActive={source.isActive}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
