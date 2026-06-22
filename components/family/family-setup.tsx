"use client";

import React from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n";

export function FamilySetup() {
  const t = useT();

  return (
    <div className="section fade-in">
      <div className="section-hd">
        <div className="ttl mono">
          <b>{t("forms.family.title_create")}</b>
        </div>
      </div>
      <div className="section-body" style={{ padding: "16px 20px" }}>
        <div className="mono" style={{ fontSize: "var(--text-sm)", color: "var(--muted)", marginBottom: 12, lineHeight: 1.6 }}>
          {t("forms.family_member.guest_hint")}
        </div>
        <Link
          href="?new=family"
          scroll={false}
          className="btn primary"
          style={{ fontSize: "var(--text-sm)", padding: "6px 16px" }}
        >
          {t("forms.family.title_create")}
        </Link>
      </div>
    </div>
  );
}
