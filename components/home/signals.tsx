import { HOME_SIGNALS } from "@/lib/mock";

export function Signals() {
  return (
    <div className="section fade-in" style={{ animationDelay: "300ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>сигналы</b> <span className="dim">· подсказки, не действия</span>
        </div>
        <div className="meta mono">{HOME_SIGNALS.length} активно</div>
      </div>
      <div className="section-body">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {HOME_SIGNALS.map((s) => (
            <div key={s.id} className={`signal ${s.kind === "acc" ? "" : s.kind}`}>
              <div className="hd">{s.title}</div>
              <div
                className="body mono"
                dangerouslySetInnerHTML={{ __html: s.bodyHtml }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
