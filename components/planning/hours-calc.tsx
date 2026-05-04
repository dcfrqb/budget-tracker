import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { formatMoney } from "@/lib/format/money";

type Props = {
  hourlyRate: string | null;
  hourlyRateGross?: string | null;
  sourceName: string | null;
  hoursPerMonth: number | null;
  taxLabel: string | null;
};

export async function HoursCalculator({
  hourlyRate,
  sourceName,
  hoursPerMonth,
  taxLabel,
}: Props) {
  const t = await getT();

  if (!hourlyRate) {
    return (
      <div className="section fade-in" style={{ animationDelay: "120ms" }}>
        <div className="section-hd">
          <div className="ttl mono">
            <b>{t("planning.hours_calc.title")}</b>{" "}
            <span className="dim">· {t("planning.hours_calc.subtitle")}</span>
          </div>
        </div>
        <div className="section-body flush">
          <div className="hcalc" style={{ gridTemplateColumns: "1fr" }}>
            <div className="block" style={{ gridColumn: "1 / -1", textAlign: "center", padding: "24px 20px" }}>
              <div className="lbl">{t("planning.hours_calc.empty_title")}</div>
              <div className="sub" style={{ marginBottom: "12px" }}>
                {t("planning.hours_calc.empty_body")}
              </div>
              <Link href="/income/work-sources/new" className="btn primary">
                {t("planning.hours_calc.empty_cta")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const rate = parseFloat(hourlyRate);
  const examplePrice = 120000;
  const hoursNeeded = rate > 0 ? Math.round(examplePrice / rate) : 0;
  const hpm = hoursPerMonth ?? 160;
  const weeksNeeded = hpm > 0 ? (hoursNeeded / (hpm / 4)).toFixed(1) : "—";

  const rateFmt = formatMoney(Math.round(rate), "RUB");
  const priceFmt = formatMoney(examplePrice, "RUB");

  return (
    <div className="section fade-in" style={{ animationDelay: "120ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>{t("planning.hours_calc.title")}</b>{" "}
          <span className="dim">· {t("planning.hours_calc.subtitle")}</span>
        </div>
        {sourceName && (
          <div className="meta mono">
            {t("planning.hours_calc.source_meta", {
              vars: { name: sourceName, rate: rateFmt },
            })}
          </div>
        )}
      </div>
      <div className="hcalc">
        <div className="block">
          <div className="lbl">{t("planning.hours_calc.price_label")}</div>
          <div className="val">{priceFmt}</div>
          <div className="sub">{t("planning.hours_calc.price_hint")}</div>
        </div>
        <div className="sep">÷</div>
        <div className="block">
          <div className="lbl">{t("planning.hours_calc.rate_label")}</div>
          <div className="val">
            {rateFmt}
            <span className="u">{t("common.unit.hour")}</span>
          </div>
          <div className="sub">
            {t("planning.hours_calc.rate_sub", {
              vars: {
                name: sourceName ?? "",
                hpm: String(hpm),
                tax: taxLabel ?? "",
              },
            })}
          </div>
        </div>
        <div className="sep">=</div>
        <div className="block">
          <div className="lbl">{t("planning.hours_calc.hours_label")}</div>
          <div className="val warn">
            {hoursNeeded}
            <span className="u">{t("common.unit.hour")}</span>
          </div>
          <div className="sub">
            {t("planning.hours_calc.hours_sub", {
              vars: { weeks: weeksNeeded },
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
