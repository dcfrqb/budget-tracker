"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n";
import { deleteLongProjectAction } from "@/app/(shell)/expenses/long-projects/actions";

export type LongProjectView = {
  id: string;
  name: string;
  sub: string;
  pct: number;
  amountSpent: string;
  amountTotal: string;
  dates: string;
  pctTone?: "warn" | "dim";
};

export function LongProjects({ projects }: { projects: LongProjectView[] }) {
  const t = useT();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setDeletingId(id);
    setError(null);
    const result = await deleteLongProjectAction(id);
    setDeletingId(null);
    setConfirmId(null);
    if (!result.ok) {
      if (result.formError === "conflict") {
        setError(t("forms.long_project.has_transactions_hint"));
      } else {
        setError(t("forms.common.form_error.internal"));
      }
    }
  }

  return (
    <div className="section fade-in" style={{ animationDelay: "240ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>{t("expenses.kpi.projects")}</b>
        </div>
        <div className="meta mono">
          <Link href="/expenses/long-projects/new" className="btn primary" style={{ padding: "3px 9px", fontSize: 10 }}>
            {t("buttons.add_project")}
          </Link>
        </div>
      </div>
      {error && (
        <div className="mono" style={{ fontSize: 11, color: "var(--neg)", padding: "4px 20px" }}>
          {error}
        </div>
      )}
      <div className="section-body flush">
        <div className="proj-list">
          {projects.map((p) => (
            <div key={p.id} className="proj-row" tabIndex={0}>
              <div className="proj-main">
                <div className="proj-name">{p.name}</div>
                <div className="proj-sub">{p.sub}</div>
              </div>
              <div className="proj-bar">
                <div className="fill" style={{ width: `${p.pct}%` }} />
              </div>
              <div className="proj-amt">
                {p.amountSpent}{" "}
                <span className="mono" style={{ color: "var(--muted)", fontWeight: 400 }}>
                  / {p.amountTotal}
                </span>
              </div>
              <div className="proj-dates">{p.dates}</div>
              <div
                className="proj-pct"
                style={{
                  color:
                    p.pctTone === "warn" ? "var(--warn)" :
                    p.pctTone === "dim" ? "var(--dim)" :
                    undefined,
                }}
              >
                {p.pct}%
              </div>
              <div className="proj-actions" style={{ display: "flex", gap: 4, marginLeft: 8 }}>
                <Link
                  href={`/expenses/long-projects/${p.id}/edit`}
                  className="btn-ghost"
                  style={{ fontSize: 10, padding: "2px 6px" }}
                >
                  {t("buttons.edit")}
                </Link>
                {confirmId === p.id ? (
                  <>
                    <button
                      type="button"
                      className="btn-ghost"
                      style={{ fontSize: 10, padding: "2px 6px", color: "var(--neg)" }}
                      disabled={deletingId === p.id}
                      onClick={() => handleDelete(p.id)}
                    >
                      {deletingId === p.id ? "..." : t("buttons.confirm_delete")}
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      style={{ fontSize: 10, padding: "2px 6px" }}
                      onClick={() => setConfirmId(null)}
                    >
                      {t("forms.common.cancel")}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ fontSize: 10, padding: "2px 6px" }}
                    onClick={() => setConfirmId(p.id)}
                  >
                    {t("buttons.delete")}
                  </button>
                )}
              </div>
            </div>
          ))}
          {projects.length === 0 && (
            <div className="mono" style={{ fontSize: 12, color: "var(--muted)", padding: "12px 20px" }}>
              {t("common.no_data")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
