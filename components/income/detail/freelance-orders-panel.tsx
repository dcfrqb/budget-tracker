import { getT } from "@/lib/i18n/server";
import { formatMoney } from "@/lib/format/money";
import { Prisma } from "@prisma/client";
import type { WorkSourceFreelanceOrder } from "@/lib/data/work-sources";
import { FreelanceOrdersPanelAdd } from "./freelance-orders-panel-add";
import type { CurrencyOption } from "@/components/forms/currency-select";
import { STATUS_COLOR } from "./order-status-colors";
import { FreelanceOrdersPanelRows } from "./freelance-orders-panel-rows";
import type { AccountOption } from "./freelance-order-stages";

interface Props {
  orders: WorkSourceFreelanceOrder[];
  workSourceId?: string;
  workSourceCurrency?: string;
  currencies?: CurrencyOption[];
  accounts?: AccountOption[];
  userId?: string;
}

export async function FreelanceOrdersPanel({
  orders,
  workSourceId,
  workSourceCurrency,
  currencies,
  accounts,
}: Props) {
  const t = await getT();

  const canAdd = !!(workSourceId && workSourceCurrency && currencies);

  return (
    <div className="section" style={{ borderBottom: "1px solid var(--border)" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>{t("income.work.detail.orders.title")}</b>
          <span className="dim"> · {orders.length}</span>
        </div>
        {canAdd && (
          <FreelanceOrdersPanelAdd
            workSourceId={workSourceId!}
            workSourceCurrency={workSourceCurrency!}
            currencies={currencies!}
          />
        )}
      </div>
      <div className="section-body flush">
        {orders.length === 0 ? (
          <div
            className="mono"
            style={{
              padding: "var(--sp-4) var(--sp-3)",
              fontSize: "var(--text-sm)",
              color: "var(--muted)",
              textAlign: "center",
            }}
          >
            {t("income.work.detail.orders.empty")}
          </div>
        ) : (
          <FreelanceOrdersPanelRows
            orders={orders}
            workSourceId={workSourceId ?? ""}
            workSourceCurrency={workSourceCurrency ?? ""}
            currencies={currencies ?? []}
            accounts={accounts ?? []}
          />
        )}
      </div>
    </div>
  );
}
