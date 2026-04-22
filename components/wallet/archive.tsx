import type { ArchivedView } from "@/lib/view/wallet";

type Props = { items: ArchivedView[] };

export function Archive({ items }: Props) {
  if (items.length === 0) return null;
  return (
    <div className="section fade-in" style={{ animationDelay: "420ms", marginBottom: 0 }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>архив</b> <span className="dim">· закрытые счета</span>
        </div>
        <div className="meta mono">{items.length} {items.length === 1 ? "счёт" : "счёта"} · не участвуют в итогах</div>
      </div>
      <div className="section-body flush">
        {items.map((a) => (
          <div key={a.id} className="arch-row">
            <div className={`acc-ico ${a.iconKind} mono`}>{a.icon}</div>
            <div className="acc-main">
              <div className="n" style={{ color: "var(--muted)" }}>{a.name}</div>
              <div className="m"><span>{a.sub}</span></div>
            </div>
            <span className="acc-ccy mono" style={{ opacity: .6 }}>{a.ccy}</span>
            <span className="acc-kind">Архив</span>
            <div className="acc-val-wrap">
              <span className="acc-val mono" style={{ color: "var(--dim)", textDecoration: "line-through" }}>{a.value}</span>
              <span className="acc-updated">{a.updated}</span>
            </div>
            <div className="acc-actions">
              <button type="button" title="Восстановить">↻</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
