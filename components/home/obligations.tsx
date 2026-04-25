import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import type { HomeObligationView } from "@/lib/view/home";

export async function Obligations({ obligations }: { obligations: HomeObligationView[] }) {
  const t = await getT();

  return (
    <div className="section fade-in" style={{ animationDelay: "180ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>{t("home.obligations.title")}</b>{" "}
          <span className="dim">· {t("home.obligations.period_30d")}</span>
        </div>
        <div className="meta mono">
          {obligations.length} {t("home.obligations.count_suffix")}
        </div>
      </div>
      <div className="section-body flush">
        <div className="ob-grid">
          {obligations.map((ob) => (
            <div key={ob.id} className={`ob-card ${ob.tagClass}`} tabIndex={0}>
              <div className="ob-top">
                <span className={`code-tag ${ob.tagClass}`}>{ob.tag}</span>
                <span className="date">{ob.date}</span>
              </div>
              <div>
                <div className="ob-name">{ob.name}</div>
                <div className="ob-sub">{ob.sub}</div>
              </div>
              <div className="ob-bot">
                <span className="ob-amt">{ob.amount}</span>
                <span className="mono dim" style={{ fontSize: 10 }}>
                  {ob.meta}
                </span>
              </div>
            </div>
          ))}
          {obligations.length === 0 && (
            <div
              className="mono"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--sp-2)",
                fontSize: 12,
                color: "var(--muted)",
                padding: "12px 20px",
              }}
            >
              <span>{t("home.obligations.empty.text")}</span>
              <Link href="/expenses" className="btn">
                {t("home.obligations.empty.cta")}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
