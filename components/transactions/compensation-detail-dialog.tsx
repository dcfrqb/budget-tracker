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
};

const KIND_LETTER: Record<string, string> = {
  inc: "I",
  exp: "E",
  xfr: "X",
  loan: "L",
};

export function CompensationDetailDialog({ open, onOpenChange, groupId }: Props) {
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
      title={t("transactions.compensation.dialog.title")}
      size="md"
      footer={
        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", flexWrap: "wrap" }}>
          {msgKey && (
            <span
              role={msgKey.kind === "error" ? "alert" : "status"}
              className={msgKey.kind === "error" ? "neg" : "acc"}
              style={{ fontSize: "12px", fontFamily: "var(--mono-font, monospace)" }}
            >
              {t(msgKey.key as TKey)}
            </span>
          )}
          <div style={{ marginLeft: "auto", display: "flex", gap: "var(--sp-2)" }}>
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
              {t("transactions.compensation.dialog.break_button")}
            </button>
          </div>
        </div>
      }
    >
      <div style={{ fontFamily: "var(--mono-font, monospace)", fontSize: "13px" }}>
        {loading && (
          <div style={{ color: "var(--dim)", padding: "var(--sp-3) 0" }}>…</div>
        )}
        {detail && (
          <>
            {/* Netto summary */}
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: "var(--sp-2)",
                marginBottom: "var(--sp-3)",
                paddingBottom: "var(--sp-2)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <span style={{ color: "var(--dim)" }}>{t("transactions.compensation.dialog.netto_label")}</span>
              <span style={{ fontWeight: "600" }}>{detail.nettoAmount}</span>
              {detail.nettoFxEquiv && <span style={{ color: "var(--dim)" }}>{detail.nettoFxEquiv}</span>}
              <span style={{ color: "var(--dim)", marginLeft: "auto" }}>
                {t("transactions.compensation.dialog.members_count", { vars: { n: String(detail.membersCount) } })}
              </span>
            </div>

            {/* Members table */}
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-1)" }}>
              {detail.members.map((m) => (
                <div
                  key={m.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "20px 70px 1fr auto",
                    alignItems: "center",
                    gap: "var(--sp-2)",
                    padding: "var(--sp-1) 0",
                  }}
                >
                  <span
                    className={`txn-ico ${m.kind}`}
                    style={{ fontSize: "10px", width: "20px", height: "20px", display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    {KIND_LETTER[m.kind] ?? "?"}
                  </span>
                  <span style={{ color: "var(--dim)", whiteSpace: "nowrap" }}>{m.date} {m.time}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {m.account}
                      {m.cat && m.cat !== "—" && (
                        <span style={{ color: "var(--dim)" }}> · {m.cat}</span>
                      )}
                    </div>
                    {m.note && (
                      <div style={{ color: "var(--dim)", fontSize: "11px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {m.note}
                      </div>
                    )}
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
