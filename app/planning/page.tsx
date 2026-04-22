import { BigPurchases } from "@/components/planning/big-purchases";
import { FundsSection } from "@/components/planning/funds";
import { HoursCalculator } from "@/components/planning/hours-calc";
import { PlanningCalendar } from "@/components/planning/calendar";
import { PlanningKpiRow } from "@/components/planning/kpi-row";
import { PlanningStatusStrip } from "@/components/planning/status-strip";
import { UpcomingDates } from "@/components/planning/upcoming-dates";

export default function PlanningPage() {
  return (
    <>
      <PlanningStatusStrip />
      <PlanningKpiRow />
      <HoursCalculator />
      <PlanningCalendar />
      <FundsSection />
      <BigPurchases />
      <UpcomingDates />
    </>
  );
}
