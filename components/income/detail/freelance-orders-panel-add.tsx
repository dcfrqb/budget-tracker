"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FreelanceOrderForm } from "@/components/forms/freelance-order-form";
import type { CurrencyOption } from "@/components/forms/currency-select";
import { useT } from "@/lib/i18n";

interface Props {
  workSourceId: string;
  workSourceCurrency: string;
  currencies: CurrencyOption[];
}

export function FreelanceOrdersPanelAdd({ workSourceId, workSourceCurrency, currencies }: Props) {
  const t = useT();
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);

  if (showForm) {
    return (
      <div className="fo-form-wrap" style={{ margin: "var(--sp-3) 0" }}>
        <FreelanceOrderForm
          mode="create"
          workSourceId={workSourceId}
          workSourceCurrency={workSourceCurrency}
          currencies={currencies}
          onSuccess={() => {
            setShowForm(false);
            router.refresh();
          }}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      className="btn primary"
      style={{ padding: "var(--sp-1) var(--sp-3)", fontSize: "var(--text-xs)" }}
      onClick={() => setShowForm(true)}
    >
      {t("income.work.detail.orders.add")}
    </button>
  );
}
