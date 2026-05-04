import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { formatMoney } from "@/lib/format/money";
import type { CreditCardObligationView } from "@/lib/data/credit-cards";

type Props = {
  cards: CreditCardObligationView[];
};

export async function CreditCards({ cards }: Props) {
  if (cards.length === 0) return null;

  const t = await getT();

  function dueLabel(card: CreditCardObligationView): string | null {
    if (card.daysUntilDue === null) return null;
    if (card.daysUntilDue === 0) return t("expenses.credit_cards.due_today");
    if (card.daysUntilDue < 0) return t("expenses.credit_cards.overdue");
    return t("expenses.credit_cards.due_in_days", { vars: { days: String(card.daysUntilDue) } });
  }

  return (
    <div className="section fade-in" style={{ animationDelay: "80ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>{t("expenses.credit_cards.title")}</b>
        </div>
      </div>
      <div className="ob-grid" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(220px, 1fr))` }}>
        {cards.map((card) => {
          const due = dueLabel(card);
          const isOverdue = card.daysUntilDue !== null && card.daysUntilDue < 0;
          const isSoon = card.daysUntilDue !== null && card.daysUntilDue <= 7 && card.daysUntilDue >= 0;

          return (
            <div key={card.id} className={`ob-card warn`}>
              <div className="ob-top">
                <span className="code-tag warn">{t("expenses.credit_cards.tag")}</span>
                {due && (
                  <span
                    className="date mono"
                    style={isOverdue ? { color: "var(--neg)" } : isSoon ? { color: "var(--warn)" } : undefined}
                  >
                    {due}
                  </span>
                )}
              </div>
              <div>
                <div className="ob-name">
                  {card.name}
                  {card.last4 && (
                    <span className="ob-sub" style={{ display: "inline", marginLeft: 6 }}>
                      ···{card.last4}
                    </span>
                  )}
                </div>
                <div className="ob-sub">
                  {t("expenses.credit_cards.debt_label")}:{" "}
                  {formatMoney(card.debtBalance, card.currency)}
                  {card.creditLimit !== null && (
                    <> / {formatMoney(card.creditLimit, card.currency)}</>
                  )}
                </div>
              </div>
              <div className="ob-bot">
                <div>
                  <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--mono-font), monospace", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 2 }}>
                    {t("expenses.credit_cards.min_payment")}
                  </div>
                  <div className="ob-amt">{formatMoney(card.minPayment, card.currency)}</div>
                </div>
                <Link
                  href={`/transactions/new?accountId=${card.id}&amount=${card.minPayment}&type=expense`}
                  className="btn primary"
                  style={{ padding: "3px 9px", fontSize: 10 }}
                >
                  {t("expenses.credit_cards.pay_button")}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
