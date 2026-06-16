import { getT } from "@/lib/i18n/server";

export type BalanceFlowPerson = { letter: string; color: string };

export type BalanceFlow = {
  fromName: string;
  from?: BalanceFlowPerson;
  toName: string;
  to?: BalanceFlowPerson;
  label: string;
  amount: string;
  muted?: boolean;
};

function Arrow() {
  return (
    <svg width="18" height="10" viewBox="0 0 18 10" fill="none" stroke="currentColor" strokeWidth="1.6">
      <line x1="1" y1="5" x2="16" y2="5" />
      <path d="M12 1l4 4-4 4" />
    </svg>
  );
}

function InfoIcon({ title }: { title: string }) {
  return (
    <span
      title={title}
      style={{ cursor: "help", color: "var(--dim)", fontSize: "var(--text-xs)", marginLeft: 4 }}
      aria-label={title}
    >
      ⓘ
    </span>
  );
}

export async function FamilyBalances({ flows }: { flows: BalanceFlow[] }) {
  const t = await getT();
  return (
    <div className="section fade-in" style={{ animationDelay: "240ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>{t("family.balances.title")}</b>{" "}
          <span className="dim">· {t("family.balances.subtitle")}</span>
        </div>
        <div className="meta mono">
          <button type="button" className="btn primary btn-xs">
            {t("family.balances.settle_btn")}
          </button>
        </div>
      </div>
      <div className="bal-chord">
        {flows.map((f, i) => (
          <div key={i} className="bal-flow" style={f.muted ? { opacity: .6 } : undefined}>
            <div className="who" style={f.muted ? { color: "var(--muted)" } : undefined}>
              {f.from && <span className="ma" style={{ background: f.from.color }}>{f.from.letter}</span>}
              {f.fromName}
            </div>
            <div className="arrow mono">
              {f.label}
              {!f.muted && <Arrow />}
            </div>
            {f.to ? (
              <div className="who">
                <span className="ma" style={{ background: f.to.color }}>{f.to.letter}</span>
                {f.toName}
              </div>
            ) : (
              <div className="who" style={{ color: "var(--muted)", justifyContent: "flex-end" }}>{f.toName}</div>
            )}
            <div className="amt" style={f.muted ? { color: "var(--dim)" } : undefined}>{f.amount}</div>
          </div>
        ))}
        {flows.length === 0 && (
          <div className="mono" style={{ fontSize: "var(--text-sm)", color: "var(--muted)", padding: "12px 20px" }}>
            {t("family.balances.empty")}
          </div>
        )}
        <div className="mono" style={{ fontSize: "var(--text-xs)", color: "var(--muted)", paddingTop: 6 }}>
          <InfoIcon title={t("family.balances.algo_hint")} />
        </div>
      </div>
    </div>
  );
}
