"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Prisma } from "@prisma/client";
import { FreelanceOrderStatus, FreelanceOrderStageStatus } from "@prisma/client";
import { useT } from "@/lib/i18n";
import { FreelanceOrderForm } from "@/components/forms/freelance-order-form";
import { FreelanceOrderStages } from "./freelance-order-stages";
import type { StageRow, AccountOption } from "./freelance-order-stages";
import type { CurrencyOption } from "@/components/forms/currency-select";
import type { WorkSourceFreelanceOrder } from "@/lib/data/work-sources";

interface Props {
  order: WorkSourceFreelanceOrder;
  workSourceId: string;
  workSourceCurrency: string;
  currencies: CurrencyOption[];
  accounts: AccountOption[];
}

export function FreelanceOrderQuickEdit({
  order,
  workSourceId,
  workSourceCurrency,
  currencies,
  accounts,
}: Props) {
  const t = useT();
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  const stages: StageRow[] = order.stages.map((s) => ({
    id: s.id,
    label: s.label,
    expectedAmount: s.expectedAmount,
    dueDate: s.dueDate,
    sortOrder: s.sortOrder,
    status: s.status,
    paidAt: s.paidAt,
    paidAmount: s.paidAmount,
    currencyCode: s.currencyCode,
  }));

  return (
    <div
      style={{
        padding: "var(--sp-3)",
        background: "var(--panel-2)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {/* Stages section */}
      <div
        className="mono"
        style={{ fontSize: "var(--text-xs)", color: "var(--muted)", marginBottom: "var(--sp-2)", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase" }}
      >
        {t("income.work.detail.orders.stages_title")}
      </div>
      <FreelanceOrderStages
        freelanceOrderId={order.id}
        stages={stages}
        orderAmount={order.amount}
        currencyCode={order.currencyCode}
        accounts={accounts}
        onMutated={() => router.refresh()}
      />

      {/* Edit order */}
      <div style={{ marginTop: "var(--sp-3)", borderTop: "1px solid var(--border)", paddingTop: "var(--sp-3)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: editing ? "var(--sp-2)" : 0 }}>
          <button
            type="button"
            className="btn-ghost"
            style={{ fontSize: "var(--text-xs)" }}
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? t("forms.common.cancel") : t("forms.freelance_order.title_edit")}
          </button>
          <a
            href={`/income/work-sources/${workSourceId}/orders/${order.id}`}
            className="btn-ghost"
            style={{ fontSize: "var(--text-xs)" }}
          >
            {t("income.work.detail.orders.open_full")} →
          </a>
        </div>

        {editing && (
          <FreelanceOrderForm
            mode="edit"
            workSourceId={workSourceId}
            workSourceCurrency={workSourceCurrency}
            currencies={currencies}
            freelanceOrderId={order.id}
            initialValues={{
              title: (order as unknown as { title?: string }).title ?? "",
              description: (order as unknown as { description?: string | null }).description ?? undefined,
              client: order.client ?? undefined,
              amount: new Prisma.Decimal(order.amount).toFixed(2),
              hours: order.hours ? new Prisma.Decimal(order.hours).toFixed(2) : undefined,
              hourlyRate: order.hourlyRate ? new Prisma.Decimal(order.hourlyRate).toFixed(2) : undefined,
              tipsAmount: order.tipsAmount ? new Prisma.Decimal(order.tipsAmount).toFixed(2) : undefined,
              status: order.status as FreelanceOrderStatus,
              performedAt: order.performedAt ?? undefined,
              paidAt: order.paidAt ?? undefined,
              note: order.note ?? undefined,
            }}
            onSuccess={() => {
              setEditing(false);
              router.refresh();
            }}
          />
        )}
      </div>
    </div>
  );
}
