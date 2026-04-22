import { Obligations } from "@/components/home/obligations";
import { PlanFact } from "@/components/home/plan-fact";
import { QuickActions } from "@/components/home/quick-actions";
import { Signals } from "@/components/home/signals";
import { StatusStrip } from "@/components/home/status-strip";
import { TopCategories } from "@/components/home/top-categories";

export default function HomePage() {
  return (
    <>
      <StatusStrip />
      <QuickActions />
      <PlanFact />
      <Obligations />
      <TopCategories />
      <Signals />
    </>
  );
}
