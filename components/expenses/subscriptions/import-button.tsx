"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import { SubscriptionImportDialog } from "./import-dialog";

export function SubscriptionImportButton() {
  const t = useT();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="btn"
        style={{ padding: "3px 9px", fontSize: 10 }}
        onClick={() => setOpen(true)}
      >
        {t("expenses.subscriptions.import.button")}
      </button>
      <SubscriptionImportDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
