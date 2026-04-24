"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n";
import { FamilyMemberForm } from "@/components/forms/family-member-form";
import { removeFamilyMemberAction } from "@/app/(shell)/family/actions";
import type { MemberCardView } from "@/components/family/members";

interface MembersManagerProps {
  familyId: string;
  members: MemberCardView[];
}

export function MembersManager({ familyId, members }: MembersManagerProps) {
  const t = useT();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRemove(memberId: string) {
    setRemovingId(memberId);
    setError(null);
    const result = await removeFamilyMemberAction(memberId);
    setRemovingId(null);
    setConfirmRemoveId(null);
    if (!result.ok) {
      if (result.formError === "conflict") {
        setError(t("forms.family_member.owner_remove_hint"));
      } else {
        setError(t("forms.common.form_error.internal"));
      }
    }
  }

  return (
    <div className="section fade-in" style={{ animationDelay: "200ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>{t("family.members.section_title")}</b>
          <span className="dim"> · {members.length}</span>
        </div>
        <div className="meta mono">
          <button
            type="button"
            className="btn primary"
            style={{ padding: "3px 9px", fontSize: 10 }}
            onClick={() => { setShowAddForm(true); setEditingMemberId(null); }}
          >
            {t("buttons.add_member")}
          </button>
        </div>
      </div>

      {error && (
        <div className="mono" style={{ fontSize: 11, color: "var(--neg)", padding: "4px 20px" }}>
          {error}
        </div>
      )}

      {showAddForm && (
        <div className="section-body" style={{ padding: "12px 20px", borderBottom: "1px solid var(--border)" }}>
          <FamilyMemberForm
            mode="create"
            familyId={familyId}
            onSuccess={() => setShowAddForm(false)}
            onCancel={() => setShowAddForm(false)}
          />
          <div className="mono" style={{ fontSize: 10, color: "var(--muted)", marginTop: 8 }}>
            {t("forms.family_member.guest_hint")}
          </div>
        </div>
      )}

      <div className="section-body flush">
        <div className="mem-grid">
          {members.map((m) => (
            <div key={m.id} className="mem-card">
              {editingMemberId === m.id ? (
                <div style={{ padding: "8px" }}>
                  <FamilyMemberForm
                    mode="edit"
                    memberId={m.id}
                    initialValues={{
                      displayName: m.name,
                      letter: m.letter,
                      color: m.color,
                      role: m.role.toUpperCase(),
                    }}
                    onSuccess={() => setEditingMemberId(null)}
                    onCancel={() => setEditingMemberId(null)}
                  />
                </div>
              ) : (
                <>
                  <div className="mem-top">
                    <div className="mem-av" style={{ background: m.color }}>{m.letter}</div>
                    <div className="mem-info">
                      <div className="n">{m.name}</div>
                      <div className="m">
                        <span className={`mem-role ${m.role}`}>{m.roleLabel}</span>
                        <span>{m.since}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mem-balance">
                    <span className="k">{m.balK}</span>
                    <span className={`v ${m.balTone}`}>{m.balV}</span>
                  </div>
                  {/* Actions */}
                  <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                    <button
                      type="button"
                      className="btn-ghost"
                      style={{ fontSize: 10, padding: "2px 6px" }}
                      onClick={() => { setEditingMemberId(m.id); setShowAddForm(false); }}
                    >
                      {t("buttons.edit")}
                    </button>
                    {m.role !== "owner" && (
                      confirmRemoveId === m.id ? (
                        <>
                          <button
                            type="button"
                            className="btn-ghost"
                            style={{ fontSize: 10, padding: "2px 6px", color: "var(--neg)" }}
                            disabled={removingId === m.id}
                            onClick={() => handleRemove(m.id)}
                          >
                            {removingId === m.id ? "..." : t("buttons.confirm_delete")}
                          </button>
                          <button
                            type="button"
                            className="btn-ghost"
                            style={{ fontSize: 10, padding: "2px 6px" }}
                            onClick={() => setConfirmRemoveId(null)}
                          >
                            {t("forms.common.cancel")}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="btn-ghost"
                          style={{ fontSize: 10, padding: "2px 6px" }}
                          onClick={() => setConfirmRemoveId(m.id)}
                        >
                          {t("buttons.remove_member")}
                        </button>
                      )
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
          {members.length === 0 && (
            <div className="mono" style={{ fontSize: 12, color: "var(--muted)", padding: "12px 20px" }}>
              {t("common.no_data")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
