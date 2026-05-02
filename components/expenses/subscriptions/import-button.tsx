"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import { SubscriptionsJsonDialog } from "./json-dialog";

type Props = {
  initialJson: string;
  existingIds: string[];
};

export function SubscriptionImportButton({ initialJson, existingIds }: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="btn btn-xs"
        onClick={() => setOpen(true)}
      >
        {t("expenses.subscriptions.json.button")}
      </button>
      <SubscriptionsJsonDialog
        open={open}
        onOpenChange={setOpen}
        initialJson={initialJson}
        existingIds={existingIds}
      />
    </>
  );
}
