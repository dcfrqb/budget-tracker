"use client";

import React, { useState, useTransition, useEffect } from "react";
import { useT } from "@/lib/i18n";
import { Dialog } from "@/components/ui/dialog";
import { breakCompensationGroup } from "@/lib/data/_mutations/compensations";
import { getCompensationGroupDetail } from "@/app/(shell)/transactions/compensation-actions";
import type { TKey } from "@/lib/i18n/t";
import type { CompensationGroupDetail } from "@/app/(shell)/transactions/compensation-actions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  kind?: "COMPENSATION" | "MERGE";
};

const KIND_LETTER: Record<string, string> = {
  inc: "I",
  exp: "E",
  xfr: "X",
  loan: "L",
};

export function CompensationDetailDialog({ open, onOpenChange, groupId, kind: kindProp }: Props) {
  const t = useT();
  const [isPending, startTransition] = useTransition();
  const [msgKey, setMsgKey] = useState<{ kind: "success" | "error"; key: string } | null>(null);
  const [detail, setDetail] = useState<CompensationGroupDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !groupId) return;
    setLoading(true);
    setDetail(null);
    setMsgKey(null);
    getCompensationGroupDetail(groupId).then((res) => {
      if (res.ok) setDetail(res.data);
      else setMsgKey({ kind: "error", key: res.error });
      setLoading(false);
    });
  }, [open, groupId]);

  // Derive kind from loaded detail (authoritative) or fall back to prop
  const isMerge = (detail?.kind ?? kindProp) === "MERGE";

  function handleBreak() {
    startTransition(async () => {
      const result = await breakCompensationGroup({ groupId });
      if (result.ok) {
        onOpenChange(false);
      } else {
        setMsgKey({ kind: "error", key: result.error });
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={isMerge ? t("transactions.merge.dialog.title") : t("transactions.compensation.dialog.title")}
      size="lg"
      footer={
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
          {msgKey && (
            <span
              role={msgKey.kind === "error" ? "alert" : "status"}
              className={msgKey.kind === "error" ? "neg" : "acc"}
              style={{ fontSize: "var(--text-xs)", fontFamily: "var(--mono-font, monospace)" }}
            >
              {t(msgKey.key as TKey)}
            </span>
          )}
          <div style={{ marginLeft: "auto", display: "flex", gap: "var(--space-2)" }}>
            <button
              type="button"
              className="btn"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              {t("common.close")}
            </button>
            <button
              type="button"
              className="btn urgent"
              onClick={handleBreak}
              disabled={isPending || loading}
            >
              {isMerge ? t("transactions.merge.dialog.break_button") : t("transactions.compensation.dialog.break_button")}
            </button>
          </div>
        </div>
      }
    >
      <div style={{ fontFamily: "var(--mono-font, monospace)", fontSize: "var(--text-md)" }}>
        {loading && (
          <div style={{ color: "var(--dim)", padding: "var(--space-3) 0" }}>…</div>
        )}
        {detail && (
          <>
            {/* Summary row */}
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: "var(--space-3)",
                marginBottom: "var(--space-4)",
                paddingBottom: "var(--space-3)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <span style={{ color: "var(--dim)" }}>{isMerge ? t("transactions.merge.dialog.sum_label") : t("transactions.compensation.dialog.netto_label")}</span>
              <span style={{ fontWeight: "600" }}>{detail.nettoAmount}</span>
              {detail.nettoFxEquiv && <span style={{ color: "var(--dim)" }}>{detail.nettoFxEquiv}</span>}
              <span style={{ color: "var(--dim)", marginLeft: "auto" }}>
                {t("transactions.compensation.dialog.members_count", { vars: { n: String(detail.membersCount) } })}
              </span>
            </div>

            {/* Members table */}
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {detail.members.map((m) => (
                <div
                  key={m.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "20px 92px 1fr auto",
                    alignItems: "center",
                    columnGap: "var(--space-4)",
                    padding: "var(--space-2) 0",
                  }}
                >
                  <span
                    className={`txn-ico ${m.kind}`}
                    style={{ fontSize: "var(--text-xs)", width: "20px", height: "20px", display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    {KIND_LETTER[m.kind] ?? "?"}
                  </span>
                  <span style={{ color: "var(--dim)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.date} {m.time}</span>
                  <div style={{ minWidth: 0 }}>
                    {m.kind === "xfr" && m.counterAccount ? (
                      <>
                        <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {m.account} {"→"} {m.counterAccount}
                        </div>
                        <div style={{ color: "var(--dim)", fontSize: "var(--text-xs)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {m.note ?? m.name ?? t("transactions.compensation.dialog.transfer_label")}
                        </div>
                      </>
                    ) : (() => {
                      const topText = m.name && m.name.trim() ? m.name : m.account;
                      const catPart = m.cat && m.cat !== "—" ? ` · ${m.cat}` : "";
                      const bottomText = `${m.account}${catPart}`;
                      const showBottom = bottomText !== topText;
                      return (
                        <>
                          <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {topText}
                          </div>
                          {showBottom && (
                            <div style={{ color: "var(--dim)", fontSize: "var(--text-xs)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {bottomText}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                  <span style={{ whiteSpace: "nowrap" }}>{m.amount}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
