"use client";

import { useState } from "react";
import {
  SessionStateBlock,
  SummaryShell,
} from "@/components/shell/summary/common";
import { useT } from "@/lib/i18n";

function SpaceSwitch() {
  const t = useT();
  const [active, setActive] = useState<"shared" | "personal" | "all">("shared");
  return (
    <div className="sum-block">
      <div className="lbl">
        <span>{t("summary.family.space_label")}</span>
        <span className="tiny mono">{t("summary.family.space_meta")}</span>
      </div>
      <div className="space-switch">
        <button type="button" className={active === "shared" ? "on" : undefined} onClick={() => setActive("shared")}>{t("summary.family.space_shared")}</button>
        <button type="button" className={active === "personal" ? "on" : undefined} onClick={() => setActive("personal")}>{t("summary.family.space_personal")}</button>
        <button type="button" className={active === "all" ? "on" : undefined} onClick={() => setActive("all")}>{t("summary.family.space_all")}</button>
      </div>
      <div className="mono" style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.6 }}>
        {t("summary.family.space_hint")}
      </div>
    </div>
  );
}

function NoGroupBlock() {
  const t = useT();
  return (
    <div className="sum-block">
      <div className="lbl">
        <span>{t("summary.family.no_group_label")}</span>
        <span className="tiny mono">{t("summary.family.no_group_meta")}</span>
      </div>
      <div className="mono" style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.6 }}>
        {t("summary.family.no_group_hint")}
      </div>
    </div>
  );
}

export default function FamilySummary() {
  const t = useT();
  return (
    <SummaryShell>
      <NoGroupBlock />
      <SpaceSwitch />
      <SessionStateBlock
        rows={[
          { tone: "pos", k: t("summary.family.mode_key"), v: t("summary.family.mode_val"), vClass: "pos" },
          { tone: "muted", k: t("summary.family.group_key"), v: t("summary.family.group_none"), vClass: "muted" },
        ]}
      />
    </SummaryShell>
  );
}
