import { LiveClock } from "./live-clock";
import { TopBarCrumbs } from "./top-bar-crumbs";
import { RATES, STATUS } from "@/lib/mock";

export function TopBar() {
  return (
    <div className="topbar">
      <span className="brand mono">БДЖ://</span>
      <TopBarCrumbs />
      <span className="pill">
        <span className="pulse" aria-hidden />
        {STATUS.label}
      </span>
      <div className="right">
        <span className="mono">
          USD/RUB <b style={{ color: "var(--muted)" }}>{RATES.USD_RUB.toFixed(2)}</b> · EUR/RUB{" "}
          <b style={{ color: "var(--muted)" }}>{RATES.EUR_RUB.toFixed(2)}</b>
        </span>
        <LiveClock />
        <span className="kbd">⌘K</span>
      </div>
    </div>
  );
}
