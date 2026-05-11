import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { listAllCurrencies } from "@/lib/data/currencies";
import { getFundsWithProgress } from "@/lib/data/funds";
import { getCurrentUserId } from "@/lib/api/auth";
import { TripCreateForm } from "@/components/planning/trips/trip-create-form";

export const dynamic = "force-dynamic";

export default async function TripNewPage() {
  const [userId, t] = await Promise.all([getCurrentUserId(), getT()]);
  const [currencies, funds] = await Promise.all([
    listAllCurrencies(),
    getFundsWithProgress(userId),
  ]);

  const currencyCodes = currencies.map((c) => c.code);
  const fundList = funds.map((f) => ({
    id: f.id,
    name: f.name,
    currencyCode: f.currencyCode,
  }));

  const labels = {
    title:              t("planning.trips.create.title"),
    name_label:         t("planning.trips.create.name_label"),
    destination_label:  t("planning.trips.create.destination_label"),
    start_label:        t("planning.trips.create.start_label"),
    end_label:          t("planning.trips.create.end_label"),
    currency_label:     t("planning.trips.create.currency_label"),
    budget_label:       t("planning.trips.create.budget_label"),
    fund_section_title: t("planning.trips.create.fund_section_title"),
    fund_none:          t("planning.trips.create.fund_none"),
    fund_existing:      t("planning.trips.create.fund_existing"),
    fund_required_monthly: t("planning.trips.create.fund_required_monthly"),
    submit:             t("planning.trips.create.submit"),
    cancel:             t("planning.trips.create.cancel"),
    validation: {
      dates_inverted:  t("planning.trips.create.validation.dates_inverted"),
      budget_positive: t("planning.trips.create.validation.budget_positive"),
    },
  };

  return (
    <>
      <div className="section fade-in" style={{ marginBottom: 0 }}>
        <nav className="cal-breadcrumb" aria-label="breadcrumb">
          <Link href="/planning">{t("planning.calendar_page.breadcrumb_planning")}</Link>
          <span className="cal-breadcrumb-sep">/</span>
          <Link href="/planning/trips">{t("planning.trips.detail.breadcrumb")}</Link>
          <span className="cal-breadcrumb-sep">/</span>
          <span className="cal-breadcrumb-cur">{labels.title}</span>
        </nav>
      </div>
      <TripCreateForm currencies={currencyCodes} funds={fundList} labels={labels} />
    </>
  );
}
