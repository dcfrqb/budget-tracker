import { getT } from "@/lib/i18n/server";
import { SignalDismiss } from "./signal-dismiss";

export type SignalView = {
  id: string;
  key: string;
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
            <div key={s.id} className={`signal ${s.kind === "acc" ? "" : s.kind}`} style={{ position: "relative" }}>
              <SignalDismiss signalKey={s.key} dismissLabel={t("signals.dismiss")} />
              <div className="hd">{s.title}</div>
              <div className="body mono">{s.body}</div>
            </div>
          ))}
          {signals.length === 0 && (
            <div className="info-callout" data-compact>
              <span className="info-callout__icon" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <line x1="12" y1="11" x2="12" y2="16" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </span>
              <span className="info-callout__body">
                <b>{t("signals.empty")}</b>
                <br />
                {t("signals.empty_hint")}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
