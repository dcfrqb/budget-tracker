import { getT } from "@/lib/i18n/server";

export type IncomeSignalView = {
  id: string;
  kind: "acc" | "warn" | "info";
  k: string;
  m: string;
};

export async function IncomeSignals({ signals }: { signals: IncomeSignalView[] }) {
  const t = await getT();

  return (
    <div className="section fade-in" style={{ animationDelay: "300ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>{t("signals.section_title")}</b>{" "}
          <span className="dim">· {t("signals.subtitle")}</span>
        </div>
        <div className="meta mono">
          {t("signals.active_count", { vars: { n: String(signals.length) } })}
        </div>
      </div>
      <div className="section-body">
        <div className="signals-col">
          {signals.map((s) => (
            <div key={s.id} className={`sig ${s.kind}`}>
              <div className="k">{s.k}</div>
              <div className="m">{s.m}</div>
            </div>
          ))}
          {signals.length === 0 && (
            <div className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
              {t("signals.empty")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
