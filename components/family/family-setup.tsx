"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n";
import { FamilyForm } from "@/components/forms/family-form";

export function FamilySetup() {
  const t = useT();
  const [showForm, setShowForm] = useState(false);

  if (!showForm) {
    return (
      <div className="section fade-in">
        <div className="section-hd">
          <div className="ttl mono">
            <b>{t("forms.family.title_create")}</b>
          </div>
        </div>
        <div className="section-body" style={{ padding: "16px 20px" }}>
          <div className="mono" style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12, lineHeight: 1.6 }}>
            {t("forms.family_member.guest_hint")}
          </div>
          <button
            type="button"
            className="btn primary"
            style={{ fontSize: 12, padding: "6px 16px" }}
            onClick={() => setShowForm(true)}
          >
            {t("forms.family.title_create")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="section fade-in">
      <div className="section-body" style={{ padding: "16px 20px" }}>
        <FamilyForm
          variant="inline"
          mode="create"
          onSuccess={() => setShowForm(false)}
        />
      </div>
    </div>
  );
}
