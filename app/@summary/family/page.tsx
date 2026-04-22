"use client";

import { useState } from "react";
import { CountUp } from "@/components/count-up";
import {
  SessionStateBlock,
  SummaryShell,
} from "@/components/shell/summary/common";
import { MINI_BALS, SHARED_TOTALS } from "@/lib/mock-family";

function GrpHero() {
  return (
    <div className="sum-block" style={{ padding: "12px 8px" }}>
      <div className="grp-hero">
        <div className="lbl">
          <span>общий баланс</span>
          <span className="tiny">апр 2026</span>
        </div>
        <div className="row">
          <span className="big mono">+₽ <CountUp to={3280} /></span>
        </div>
        <div className="sub mono">тебе должны по сверке</div>
      </div>
    </div>
  );
}

function SpaceSwitch() {
  const [active, setActive] = useState<"shared" | "personal" | "all">("shared");
  return (
    <div className="sum-block">
      <div className="lbl">
        <span>пространство</span>
        <span className="tiny mono">переключить</span>
      </div>
      <div className="space-switch">
        <button type="button" className={active === "shared" ? "on" : undefined} onClick={() => setActive("shared")}>Общее</button>
        <button type="button" className={active === "personal" ? "on" : undefined} onClick={() => setActive("personal")}>Личное</button>
        <button type="button" className={active === "all" ? "on" : undefined} onClick={() => setActive("all")}>Всё</button>
      </div>
      <div className="mono" style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.6 }}>
        Новая транзакция по умолчанию создаётся в <b style={{ color: "var(--accent)" }}>общем</b>. Меняй при добавлении, если нужно.
      </div>
    </div>
  );
}

function WhoOwesBlock() {
  return (
    <div className="sum-block">
      <div className="lbl">
        <span>кто кому должен</span>
        <span className="tiny mono">итоги сверки</span>
      </div>
      <div className="mini-bal">
        {MINI_BALS.map((b, i) => (
          <div key={i} className="r">
            <span className="k">
              {b.av && <span className="ma" style={{ background: b.av.color }}>{b.av.letter}</span>}
              {b.k}
            </span>
            <span className="v pos">{b.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SharedTotalsBlock() {
  return (
    <div className="sum-block">
      <div className="lbl">
        <span>общие итоги апр</span>
        <span className="tiny mono">35 транз.</span>
      </div>
      <div className="mini-bal">
        {SHARED_TOTALS.map((r, i) => (
          <div key={i} className="r">
            <span className="k">{r.k}</span>
            <span className="v">{r.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SafeBlock() {
  return (
    <div className="sum-block">
      <div className="lbl">
        <span>безопасно до</span>
        <span className="tiny mono">личный запас</span>
      </div>
      <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: "var(--accent)" }}>
        <CountUp to={47} format="int" /> <span style={{ color: "var(--muted)", fontSize: 13, fontWeight: 500 }}>дней</span>
      </div>
      <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
        → 2026-06-07 · режим норма
      </div>
    </div>
  );
}

export default function FamilySummary() {
  return (
    <SummaryShell>
      <GrpHero />
      <SpaceSwitch />
      <WhoOwesBlock />
      <SharedTotalsBlock />
      <SafeBlock />
      <SessionStateBlock
        rows={[
          { tone: "pos", k: "режим", v: "норма", vClass: "pos" },
          { tone: "pos", k: "группа", v: "Никитины", vClass: "acc" },
          { tone: "pos", k: "участники", v: "3 онлайн", vClass: "info" },
        ]}
      />
    </SummaryShell>
  );
}
