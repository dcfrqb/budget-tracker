import { getT } from "@/lib/i18n/server";
import { getLocale } from "@/lib/i18n/server";
import { getFreelanceOrderPayments } from "@/lib/data/freelance-orders";
import { formatMoney } from "@/lib/format/money";
import { formatDate } from "@/lib/format/date";

interface Props {
  orderId: string;
  userId: string;
}

export async function FreelanceOrderPayments({ orderId, userId }: Props) {
  const [t, locale, payments] = await Promise.all([
    getT(),
    getLocale(),
    getFreelanceOrderPayments(userId, orderId),
  ]);

  if (payments.length === 0) {
    return (
      <div
        className="mono"
        style={{ fontSize: "var(--text-xs)", color: "var(--muted)", padding: "var(--sp-2) 0" }}
      >
        {t("income.work.detail.orders.payments_empty")}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-1)" }}>
      {payments.map((p) => (
        <div
          key={p.id}
          className="mono"
          style={{
            display: "flex",
            gap: "var(--sp-2)",
            fontSize: "var(--text-xs)",
            color: "var(--muted)",
          }}
        >
          <span style={{ flexShrink: 0 }}>{formatDate(p.occurredAt, locale)}</span>
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {p.name}
          </span>
          <span style={{ color: "var(--pos)", flexShrink: 0 }}>
            {formatMoney(p.amount, p.currencyCode)}
          </span>
        </div>
      ))}
    </div>
  );
}
