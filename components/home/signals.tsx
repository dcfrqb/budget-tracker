import { getT } from "@/lib/i18n/server";

export type SignalView = {
  id: string;
  kind: "acc" | "warn" | "info";
  title: string;
  body: string;
};

export async function Signals({ signals }: { signals: SignalView[] }) {
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
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {signals.map((s) => (
            <div key={s.id} className={`signal ${s.kind === "acc" ? "" : s.kind}`}>
              <div className="hd">{s.title}</div>
              <div className="body mono">{s.body}</div>
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
