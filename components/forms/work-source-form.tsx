"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { WorkKind } from "@prisma/client";
import { useServerActionForm } from "./use-server-action-form";
import { workSourceCreateSchema, workSourceUpdateSchema } from "@/lib/validation/work-source";
import type { WorkSourceCreateInput } from "@/lib/validation/work-source";
import {
  createWorkSourceAction,
  updateWorkSourceAction,
} from "@/app/(shell)/income/actions";
import { useT } from "@/lib/i18n";
import { CurrencySelect, type CurrencyOption } from "./currency-select";
import { TextField } from "./primitives/text-field";
import { TextareaField } from "./primitives/textarea-field";
import { MoneyInput } from "./primitives/money-input";
import { NumberField } from "./primitives/number-field";
import { SelectField } from "./primitives/select-field";
import { SubmitRow } from "./primitives/submit-row";
import { HOURS_PER_MONTH_DEFAULT } from "@/lib/constants";
import type { ActionResult } from "@/lib/actions/result";
import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function errMsg(e: any): string | undefined {
  if (!e) return undefined;
  if (typeof e === "string") return e;
  if (typeof e?.message === "string") return e.message;
  return undefined;
}

export interface WorkSourceFormProps {
  variant?: "page" | "inline";
  mode: "create" | "edit";
  currencies: CurrencyOption[];
  initialValues?: Partial<WorkSourceCreateInput>;
  workSourceId?: string;
  onSuccess?: () => void;
}

export function WorkSourceForm({
  variant = "page",
  mode,
  currencies,
  initialValues,
  workSourceId,
  onSuccess,
}: WorkSourceFormProps) {
  const t = useT();
  const router = useRouter();

  type UpdateInput = z.infer<typeof workSourceUpdateSchema>;

  // Build action based on mode
  const action = React.useMemo(() => {
    if (mode === "edit" && workSourceId) {
      return (input: UpdateInput): Promise<ActionResult<unknown>> =>
        updateWorkSourceAction(workSourceId, input);
    }
    return createWorkSourceAction as (input: WorkSourceCreateInput) => Promise<ActionResult<unknown>>;
  }, [mode, workSourceId]);

  const schema = mode === "edit"
    ? (workSourceUpdateSchema as z.ZodType<UpdateInput>)
    : workSourceCreateSchema;

  const { form, submit, isPending, formError } = useServerActionForm(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schema as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    action as any,
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      defaultValues: {
        kind: WorkKind.EMPLOYMENT,
        isActive: true,
        ...initialValues,
      } as any,
      onSuccess: () => {
        if (onSuccess) {
          onSuccess();
        } else {
          router.push("/income");
        }
      },
    },
  );

  const {
    register,
    watch,
    formState: { errors },
  } = form;

  const watchedKind = watch("kind") as WorkKind;

  const isEmployment = watchedKind === WorkKind.EMPLOYMENT;
  const isFreelance = watchedKind === WorkKind.FREELANCE;

  const kindOptions = [
    { value: WorkKind.EMPLOYMENT, label: t("forms.work.kind.employment") },
    { value: WorkKind.FREELANCE, label: t("forms.work.kind.freelance") },
    { value: WorkKind.ONE_TIME, label: t("forms.work.kind.one_time") },
  ];

  const translatedErrorKey =
    formError === "unique_violation"
      ? t("forms.common.form_error.unique_violation")
      : formError === "not_found"
      ? t("forms.common.form_error.not_found")
      : formError
      ? t("forms.common.form_error.internal")
      : null;

  return (
    <form onSubmit={submit} className="form-grid">
      {variant === "page" && (
        <h1 className="form-title">
          {mode === "create" ? t("forms.work.title_create") : t("forms.work.title_edit")}
        </h1>
      )}

      {/* Kind */}
      <SelectField
        register={register("kind")}
        label={t("forms.work.field.kind")}
        options={kindOptions}
        error={errMsg(errors.kind)}
        required
      />

      {/* Name / Employer */}
      <TextField
        register={register("name")}
        label={t("forms.work.field.name")}
        error={errMsg(errors.name)}
        required
        placeholder={t("forms.work.placeholder.name")}
      />

      {/* Currency */}
      <CurrencySelect
        register={register("currencyCode")}
        currencies={currencies}
        label={t("forms.work.field.currency")}
        error={errMsg(errors.currencyCode)}
        required
      />

      {/* Base amount — employment / one-time required, freelance optional */}
      {(isEmployment || watchedKind === WorkKind.ONE_TIME) && (
        <MoneyInput
          register={register("baseAmount")}
          label={t("forms.work.field.base_amount")}
          error={errMsg(errors.baseAmount)}
          required={isEmployment}
          placeholder={t("forms.work.placeholder.base_amount")}
          hint={isEmployment ? t("forms.work.hint.base_amount_employment") : undefined}
        />
      )}

      {/* Hourly rate — freelance required */}
      {isFreelance && (
        <MoneyInput
          register={register("hourlyRate")}
          label={t("forms.work.field.hourly_rate")}
          error={errMsg(errors.hourlyRate)}
          required={isFreelance}
          placeholder={t("forms.work.placeholder.hourly_rate")}
          hint={t("forms.work.hint.hourly_rate_freelance")}
        />
      )}

      {/* Pay day — employment only */}
      {isEmployment && (
        <NumberField
          register={register("payDay", { valueAsNumber: true })}
          label={t("forms.work.field.pay_day")}
          error={errMsg(errors.payDay)}
          required={isEmployment}
          placeholder={t("forms.work.placeholder.pay_day")}
          min={1}
          max={31}
          step={1}
        />
      )}

      {/* Tax rate */}
      <NumberField
        register={register("taxRatePct", { valueAsNumber: true })}
        label={t("forms.work.field.tax_rate")}
        error={errMsg(errors.taxRatePct)}
        placeholder={t("forms.work.placeholder.tax_rate")}
        hint={t("forms.work.hint.tax_rate")}
        min={0}
        max={100}
        step={0.01}
      />

      {/* Hours per month override */}
      <NumberField
        register={register("hoursPerMonth", { valueAsNumber: true })}
        label={t("forms.work.field.hours_per_month")}
        error={errMsg(errors.hoursPerMonth)}
        placeholder={String(HOURS_PER_MONTH_DEFAULT)}
        hint={t("forms.work.hint.hours_per_month")}
        min={1}
        max={744}
        step={1}
      />

      {/* Active toggle */}
      <div className="field">
        <label className="form-checkbox-label">
          <input type="checkbox" {...register("isActive")} />
          {t("forms.work.field.is_active")}
        </label>
      </div>

      {/* Notes */}
      <TextareaField
        register={register("notes")}
        label={t("forms.work.field.notes")}
        error={errMsg(errors.notes)}
        placeholder={t("forms.work.placeholder.notes")}
      />

      <SubmitRow
        isSubmitting={isPending}
        submitLabel={t("forms.common.save")}
        cancelLabel={t("forms.common.cancel")}
        onCancel={
          variant === "page"
            ? () => router.back()
            : onSuccess
        }
        formError={translatedErrorKey}
      />
    </form>
  );
}
