import type { InstitutionView } from "@/lib/view/wallet";

type Props = { institutions: InstitutionView[] };

export function Institutions({ institutions }: Props) {
  return (
    <>
      {institutions.map((inst, idx) => (
        <div key={inst.id} className="fade-in" style={{ animationDelay: `${180 + idx * 40}ms` }}>
          <div className="inst">
            <div className="inst-hd">
              <div className="inst-hd-l">
                <div className={`inst-logo ${inst.logo} mono`}>{inst.letter}</div>
                <div>
                  <div className="inst-name">{inst.name}</div>
                  <div className="inst-sub">{inst.sub}</div>
                </div>
              </div>
              <div>
                <div className="inst-total mono">
                  {inst.total}
                  <span className="rub mono">{inst.share}</span>
                </div>
              </div>
            </div>
            {inst.accounts.map((a) => (
              <div key={a.id} className="acc-row" tabIndex={0}>
                <div className={`acc-ico ${a.kind} mono`}>{a.icon}</div>
                <div className="acc-main">
                  <div className="n">{a.name}</div>
                  <div className="m">
                    <span className="acc-kind">{a.kindLabel}</span>
                    <span>{a.sub}</span>
                  </div>
                </div>
                <span className="acc-ccy mono">{a.ccy}</span>
                <span className="acc-kind">{a.colPill}</span>
                <div className="acc-val-wrap">
                  <span className="acc-val">{a.value}</span>
                  <span className="acc-updated">{a.updated}</span>
                </div>
                <div className="acc-actions">
                  <button type="button" title="Пополнить">+</button>
                  <button type="button" title="Перевод">↔</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
