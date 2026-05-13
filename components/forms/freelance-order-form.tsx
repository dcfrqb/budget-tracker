"use client";

import React, { useState, useTransition } from "react";
import { FreelanceOrderStatus } from "@prisma/client";
import { useServerActionForm } from "./use-server-action-form";
import {
  freelanceOrderCreateSchema,
  freelanceOrderUpdateSchema,
} from "@/lib/validation/freelance-order";
import type { FreelanceOrderCreateInput } from "@/lib/validation/freelance-order";
import {
  createFreelanceOrderAction,
  updateFreelanceOrderAction,
  deleteFreelanceOrderAction,
} from "@/app/(shell)/income/actions";
import { useT } from "@/lib/i18n";
import type { CurrencyOption } from "./currency-select";
import { MoneyInput } from "./primitives/money-input";
import { TextareaField } from "./primitives/textarea-field";
import { SelectField } from "./primitives/select-field";
import { SubmitRow } from "./primitives/submit-row";
import { Field } from "./primitives/field";
import { TextField } from "./primitives/text-field";
import type { ActionResult } from "@/lib/actions/result";
import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function errMsg(e: any): string | undefined {
  if (!e) return undefined;
  if (typeof e === "string") return e;
  if (typeof e?.message === "string") return e.message;
  return undefined;
}

export interface FreelanceOrderFormProps {
  mode: "create" | "edit";
  workSourceId: string;
  workSourceCurrency: string;
  currencies: CurrencyOption[];
  initialValues?: Partial<FreelanceOrderCreateInput & { amount?: string; hours?: string; hourlyRate?: string; tipsAmount?: string }>;
  freelanceOrderId?: string;
  onSuccess?: () => void;
}

export function FreelanceOrderForm({
  mode,
  workSourceId,
  workSourceCurrency,
  currencies: _currencies,
  initialValues,
  freelanceOrderId,
  onSuccess,
}: FreelanceOrderFormProps) {
  const t = useT();
  const [isDeleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  type UpdateInput = z.infer<typeof freelanceOrderUpdateSchema>;

  const action = React.useMemo(() => {
    if (mode === "edit" && freelanceOrderId) {
      return (input: UpdateInput): Promise<ActionResult<unknown>> =>
        updateFreelanceOrderAction(freelanceOrderId, input);
    }
    return createFreelanceOrderAction as (input: FreelanceOrderCreateInput) => Promise<ActionResult<unknown>>;
  }, [mode, freelanceOrderId]);

  const schema = mode === "edit"
    ? (freelanceOrderUpdateSchema as z.ZodType<UpdateInput>)
    : freelanceOrderCreateSchema;

  const { form, submit: rawSubmit, isPending, formError } = useServerActionForm<FreelanceOrderCreateInput, unknown>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schema as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    action as any,
    {
      defaultValues: {
        workSourceId,
        currencyCode: workSourceCurrency,
        status: FreelanceOrderStatus.ACTIVE,
        ...initialValues,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      onSuccess: () => {
        form.reset({
          workSourceId,
          currencyCode: workSourceCurrency,
          status: FreelanceOrderStatus.ACTIVE,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
        onSuccess?.();
      },
    },
  );

  const {
    register,
    formState: { errors },
  } = form;

  const statusOptions = [
    { value: FreelanceOrderStatus.PLANNED, label: t("forms.freelance_order.status.planned") },
    { value: FreelanceOrderStatus.ACTIVE, label: t("forms.freelance_order.status.active") },
    { value: FreelanceOrderStatus.AWAITING_PAYMENT, label: t("forms.freelance_order.status.awaiting_payment") },
    { value: FreelanceOrderStatus.COMPLETED, label: t("forms.freelance_order.status.completed") },
    { value: FreelanceOrderStatus.CANCELLED, label: t("forms.freelance_order.status.cancelled") },
  ];

  const translatedErrorKey =
    formError === "not_found"
      ? t("forms.common.form_error.not_found")
      : formError
      ? t("forms.common.form_error.internal")
      : null;

  return (
    <>
      <form onSubmit={rawSubmit} className="form-grid">
        <input type="hidden" {...register("workSourceId" as never)} />
        <input type="hidden" {...register("currencyCode" as never)} />

        {/* Amount */}
        <MoneyInput
          register={register("amount" as never, {
            setValueAs: (v) => (v === "" || v == null ? null : String(Number(v))),
          })}
          label={t("forms.freelance_order.field.amount")}
          error={errMsg(errors["amount" as keyof typeof errors])}
          currencyCode={workSourceCurrency}
        />

        {/* Hours — informational */}
        <MoneyInput
          register={register("hours" as never, {
            setValueAs: (v) => (v === "" || v == null ? null : String(Number(v))),
          })}
          label={t("forms.freelance_order.field.hours")}
          error={errMsg(errors["hours" as keyof typeof errors])}
          hint={t("forms.freelance_order.hint.hours_info")}
          currencyCode="h"
        />

        {/* Hourly rate — informational */}
        <MoneyInput
          register={register("hourlyRate" as never, {
            setValueAs: (v) => (v === "" || v == null ? null : String(Number(v))),
          })}
          label={t("forms.freelance_order.field.hourly_rate")}
          error={errMsg(errors["hourlyRate" as keyof typeof errors])}
          hint={t("forms.freelance_order.hint.rate_info")}
          currencyCode={workSourceCurrency}
        />

        {/* Client */}
        <TextField
          register={register("client" as never)}
          label={t("forms.freelance_order.field.client")}
          error={errMsg(errors["client" as keyof typeof errors])}
          placeholder={t("forms.freelance_order.placeholder.client")}
        />

        {/* Tips */}
        <MoneyInput
          register={register("tipsAmount" as never, {
            setValueAs: (v) => (v === "" || v == null ? null : String(Number(v))),
          })}
          label={t("forms.freelance_order.field.tips")}
          error={errMsg(errors["tipsAmount" as keyof typeof errors])}
          currencyCode={workSourceCurrency}
        />

        {/* Status */}
        <SelectField
          register={register("status" as never)}
          label={t("forms.freelance_order.field.status")}
          options={statusOptions}
          error={errMsg(errors["status" as keyof typeof errors])}
        />

        {/* Performed at */}
        <Field
          label={t("forms.freelance_order.field.performed_at")}
          name="performedAt"
          error={errMsg(errors["performedAt" as keyof typeof errors])}
        >
          <input
            {...register("performedAt" as never, {
              setValueAs: (v) => (v === "" || v == null ? null : v),
            })}
            id="performedAt"
            type="date"
            className="input"
          />
        </Field>

        {/* Paid at */}
        <Field
          label={t("forms.freelance_order.field.paid_at")}
          name="paidAt"
          error={errMsg(errors["paidAt" as keyof typeof errors])}
        >
          <input
            {...register("paidAt" as never, {
              setValueAs: (v) => (v === "" || v == null ? null : v),
            })}
            id="paidAt"
            type="date"
            className="input"
          />
        </Field>

        {/* Note */}
        <TextareaField
          register={register("note" as never)}
          label={t("forms.freelance_order.field.note")}
          error={errMsg(errors["note" as keyof typeof errors])}
          placeholder={t("forms.freelance_order.placeholder.note")}
          rows={2}
        />

        <SubmitRow
          isSubmitting={isPending}
          submitLabel={t("forms.common.save")}
          onCancel={onSuccess}
          formError={translatedErrorKey}
        />
      </form>

      {mode === "edit" && freelanceOrderId && (
        <div style={{ marginTop: "var(--sp-4)" }}>
          <button
            type="button"
            className="btn-ghost"
            disabled={isDeleting || isPending}
            onClick={() => {
              if (!confirm(t("forms.freelance_order.delete_confirm"))) return;
              setDeleteError(null);
              startDelete(async () => {
                const result = await deleteFreelanceOrderAction(freelanceOrderId);
                if (!result.ok) {
                  setDeleteError(t("forms.freelance_order.delete_failed"));
                  return;
                }
                onSuccess?.();
              });
            }}
          >
            {t("forms.freelance_order.delete")}
          </button>
          {deleteError && (
            <div className="field-error" role="alert" style={{ marginTop: "var(--sp-2)" }}>
              {deleteError}
            </div>
          )}
        </div>
      )}
    </>
  );
}
