"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FreelanceOrderForm } from "@/components/forms/freelance-order-form";
import type { CurrencyOption } from "@/components/forms/currency-select";
import type { FreelanceOrderCreateInput } from "@/lib/validation/freelance-order";

interface Props {
  freelanceOrderId: string;
  workSourceId: string;
  workSourceCurrency: string;
  currencies: CurrencyOption[];
  initialValues: Partial<FreelanceOrderCreateInput & { amount?: string; hours?: string; hourlyRate?: string; tipsAmount?: string }>;
  editLabel: string;
  cancelLabel: string;
}

export function OrderDetailEditToggle({
  freelanceOrderId,
  workSourceId,
  workSourceCurrency,
  currencies,
  initialValues,
  editLabel,
  cancelLabel,
}: Props) {
  const router = useRouter();
  const [showEdit, setShowEdit] = useState(false);

  return (
    <>
      <button
        type="button"
        className="btn"
        style={{ fontSize: "var(--text-xs)" }}
        onClick={() => setShowEdit((v) => !v)}
      >
        {showEdit ? cancelLabel : editLabel}
      </button>
      {showEdit && (
        <div
          style={{
            marginTop: "var(--sp-3)",
            padding: "var(--sp-3)",
            background: "var(--panel-2)",
            border: "1px solid var(--border)",
          }}
        >
          <FreelanceOrderForm
            mode="edit"
            freelanceOrderId={freelanceOrderId}
            workSourceId={workSourceId}
            workSourceCurrency={workSourceCurrency}
            currencies={currencies}
            initialValues={initialValues}
            onSuccess={() => {
              setShowEdit(false);
              router.refresh();
            }}
          />
        </div>
      )}
    </>
  );
}
