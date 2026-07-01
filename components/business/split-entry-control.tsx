"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";

export function SplitEntryControl() {
  const t = useT();
  const router = useRouter();
  const [txnId, setTxnId] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const id = txnId.trim();
    if (!id) return;
    router.replace(`?split=${encodeURIComponent(id)}`, { scroll: false });
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: "var(--sp-1)" }}>
      <input
        type="text"
        value={txnId}
        onChange={(e) => setTxnId(e.target.value)}
        placeholder={t("business.allocation.split.entry_placeholder")}
        className="mono"
        style={{ fontSize: "var(--text-xs)", width: "18ch" }}
        aria-label={t("business.allocation.split.entry_cta")}
      />
      <button type="submit" className="btn btn-xs">
        {t("business.allocation.split.entry_cta")}
      </button>
    </form>
  );
}
