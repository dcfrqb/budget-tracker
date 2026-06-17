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

/**
 * Renders the "Add order" toggle button. When clicked, a full-width form
 * renders below the section header (not inside it) by receiving an
 * `onToggle` callback from FreelanceOrdersPanel.
 */
export function FreelanceOrdersPanelAddButton({
  showForm,
  onToggle,
}: {
  showForm: boolean;
  onToggle: () => void;
}) {
  const t = useT();
  return (
    <button
      type="button"
      className="btn primary"
      style={{ padding: "var(--sp-1) var(--sp-3)", fontSize: "var(--text-xs)" }}
      onClick={onToggle}
    >
      {showForm ? t("forms.common.cancel") : t("income.work.detail.orders.add")}
    </button>
  );
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
