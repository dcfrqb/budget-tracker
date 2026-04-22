import { AnalyticsKpiRow } from "@/components/analytics/kpi-row";
import { AnalyticsStatusStrip } from "@/components/analytics/status-strip";
import { CategoryPie } from "@/components/analytics/category-pie";
import { Compare } from "@/components/analytics/compare";
import { Forecast } from "@/components/analytics/forecast";
import { ModesReference } from "@/components/analytics/modes-reference";
import { TrendCharts } from "@/components/analytics/trend";
import { Weather } from "@/components/analytics/weather";

export default function AnalyticsPage() {
  return (
    <>
      <AnalyticsStatusStrip />
      <Weather />
      <AnalyticsKpiRow />
      <TrendCharts />
      <CategoryPie />
      <Compare />
      <Forecast />
      <ModesReference />
    </>
  );
}
