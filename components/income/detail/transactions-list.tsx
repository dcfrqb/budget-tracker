import { getT } from "@/lib/i18n/server";
import { formatMoney } from "@/lib/format/money";
import { Prisma, TransactionStatus } from "@prisma/client";
import type { WorkSourceTransaction } from "@/lib/data/work-sources";
import { TransactionStatusFilter } from "./transaction-status-filter";

const MAX_VISIBLE = 100;

const STATUS_COLOR: Record<string, string> = {
  DONE: "var(--pos)",
  PLANNED: "var(--muted)",
  PARTIAL: "var(--warn)",
  MISSED: "var(--neg)",
  CANCELLED: "var(--muted)",
};

interface Props {
  txns: WorkSourceTransaction[];
  statusFilter: string | undefined;
  basePath: string;
}

export async function TransactionsList({ txns, statusFilter, basePath }: Props) {
  const t = await getT();

  const visible = txns.slice(0, MAX_VISIBLE);
  const overflow = txns.length - MAX_VISIBLE;

  function fmtDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  function effectiveAmount(txn: WorkSourceTransaction): Prisma.Decimal {
    if (txn.status === TransactionStatus.DONE) {
      return new Prisma.Decimal(txn.amount);
    }
    if (txn.facts && txn.facts.length > 0) {
      return (txn.facts as { amount: Prisma.Decimal | string }[]).reduce(
        (s, f) => s.plus(f.amount),
        new Prisma.Decimal(0),
      );
    }
    return new Prisma.Decimal(txn.amount);
  }

  return (
    <div className="section" style={{ borderBottom: "1px solid var(--border)" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>{t("income.work.detail.txns.title")}</b>
        </div>
      </div>

      <TransactionStatusFilter active={statusFilter} basePath={basePath} />

      <div className="section-body flush">
        {visible.length === 0 ? (
          <div
            className="mono"
            style={{
              padding: "var(--sp-4) var(--sp-3)",
              fontSize: "var(--text-sm)",
              color: "var(--muted)",
              textAlign: "center",
            }}
          >
            {t("income.work.detail.txns.empty")}
          </div>
        ) : (
          <>
            {visible.map((txn) => {
              const amount = effectiveAmount(txn);
              const statusColor = STATUS_COLOR[txn.status] ?? "var(--muted)";

              return (
                <div
                  key={txn.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px var(--sp-3)",
                    borderBottom: "1px solid var(--border)",
                    gap: "var(--sp-2)",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: "var(--text-sm)",
                        color: "var(--text)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {txn.name}
                    </div>
                    <div
                      className="mono"
                      style={{ fontSize: "var(--text-xs)", color: "var(--muted)" }}
                    >
                      {fmtDate(txn.occurredAt)}
                      {txn.category && ` · ${txn.category.name}`}
                      {` · ${txn.account.name}`}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
                    <div
                      className="mono"
                      style={{ fontWeight: 700, color: "var(--pos)", fontSize: "var(--text-sm)" }}
                    >
                      +{formatMoney(amount, txn.currencyCode)}
                    </div>
                    <div
                      className="mono"
                      style={{ fontSize: "var(--text-xs)", color: statusColor }}
                    >
                      {t(`income.work.detail.status.${txn.status.toLowerCase()}` as Parameters<typeof t>[0])}
                    </div>
                  </div>
                </div>
              );
            })}
            {overflow > 0 && (
              <div
                className="mono"
                style={{
                  padding: "var(--sp-3)",
                  fontSize: "var(--text-xs)",
                  color: "var(--muted)",
                  textAlign: "center",
                }}
              >
                {t("income.work.detail.txns.more", { vars: { count: String(overflow) } })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
