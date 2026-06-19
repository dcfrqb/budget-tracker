"use client";

import React, { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RateType } from "@prisma/client";
import { useServerActionForm } from "./use-server-action-form";
import { workSourceCreateSchema, workSourceUpdateSchema } from "@/lib/validation/work-source";
import type { WorkSourceCreateInput } from "@/lib/validation/work-source";
import {
  createWorkSourceAction,
  updateWorkSourceAction,
  deactivateWorkSourceAction,
} from "@/app/(shell)/income/actions";
import { useT } from "@/lib/i18n";
import { CurrencySelect, type CurrencyOption } from "./currency-select";
import { TextField } from "./primitives/text-field";
import { TextareaField } from "./primitives/textarea-field";
import { MoneyInput } from "./primitives/money-input";
import { NumberField } from "./primitives/number-field";
import { SelectField } from "./primitives/select-field";
import { DateField } from "./primitives/date-field";
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
  currencyHasLockedTxns?: boolean;
  defaultCurrencyCode?: string;
  onSuccess?: () => void;
}

// All rate types available when kind is set
const ALL_RATE_TYPES = [RateType.HOURLY, RateType.MONTHLY, RateType.PER_TASK, RateType.DAILY, RateType.COMMISSION_PCT];

export function WorkSourceForm({
  variant = "page",
  mode,
  currencies,
  initialValues,
  workSourceId,
  currencyHasLockedTxns = false,
  defaultCurrencyCode,
  onSuccess,
}: WorkSourceFormProps) {
  const t = useT();
  const router = useRouter();
  const [isDeleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  type UpdateInput = z.infer<typeof workSourceUpdateSchema>;

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
        kind: null,
        isActive: true,
        currencyCode: defaultCurrencyCode ?? null,
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
    setValue,
    getValues,
    formState: { errors },
  } = form;

  const watchedKind = watch("kind") as string | null | undefined;
  const watchedRateType = watch("rateType") as RateType | null | undefined;

  // When kind changes, clear rateType if it's no longer appropriate (allow all when kind set)
  useEffect(() => {
    const current = getValues("rateType") as RateType | null | undefined;
    if (current && watchedKind == null) {
      // Keep rateType even without kind — user can specify it freely
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedKind]);

  // Label for rateAmount changes by rateType
  function rateAmountLabel(): string {
    switch (watchedRateType) {
      case RateType.HOURLY: return t("forms.work.field.rate_hourly");
      case RateType.MONTHLY: return t("forms.work.field.rate_monthly");
      case RateType.PER_TASK: return t("forms.work.field.rate_per_task");
      case RateType.DAILY: return t("forms.work.field.rate_daily");
      case RateType.COMMISSION_PCT: return t("forms.work.field.rate_commission");
      default: return t("forms.work.field.rate_amount");
    }
  }

  // Map validation error codes to i18n
  function mapError(code: string | undefined): string | undefined {
    if (!code) return undefined;
    const key = `forms.work.errors.${code}` as Parameters<typeof t>[0];
    const msg = t(key);
    return msg !== key ? msg : code;
  }

  const rateTypeErr = errMsg(errors.rateType) ? mapError(errMsg(errors.rateType)) : undefined;
  const rateAmountErr = errMsg(errors.rateAmount) ? mapError(errMsg(errors.rateAmount)) : undefined;
  const endedAtErr = errMsg(errors.endedAt) ? mapError(errMsg(errors.endedAt)) : undefined;

  const kindOptions = [
    { value: "", label: t("forms.work.kind.not_set") },
    { value: "EMPLOYMENT", label: t("forms.work.kind.employment") },
    { value: "FREELANCE", label: t("forms.work.kind.freelance") },
    { value: "ONE_TIME", label: t("forms.work.kind.one_time") },
  ];

  const translatedErrorKey =
    formError === "unique_violation"
      ? t("forms.common.form_error.unique_violation")
      : formError === "not_found"
      ? t("forms.common.form_error.not_found")
      : formError === "currency_locked"
      ? t("forms.work.currency_locked")
      : formError
      ? t("forms.common.form_error.internal")
      : null;

  return (
    <>
    <form onSubmit={submit} className="form-grid">
      {variant === "page" && (
        <h1 className="form-title">
          {mode === "create" ? t("forms.work.title_create") : t("forms.work.title_edit")}
        </h1>
      )}
      {variant === "page" && (
        <p className="form-required-hint">{t("forms.common.required_hint")}</p>
      )}

      {/* ── Required ── */}
      <TextField
        register={register("name")}
        label={t("forms.work.field.name")}
        error={errMsg(errors.name)}
        required
        placeholder={t("forms.work.placeholder.name")}
      />

      {/* ── Basics (optional) ── */}
      <div className="form-section-label">{t("forms.work.section.basics")}</div>

      <SelectField
        register={register("kind", {
          setValueAs: (v) => (v === "" || v == null ? null : v),
        })}
        label={t("forms.work.field.kind")}
        options={kindOptions}
        error={errMsg(errors.kind)}
      />

      <CurrencySelect
        register={register("currencyCode", {
          setValueAs: (v) => (v === "" || v == null ? null : v),
        })}
        currencies={currencies}
        label={t("forms.work.field.currency")}
        error={errMsg(errors.currencyCode)}
        disabled={mode === "edit" && currencyHasLockedTxns}
      />
      {mode === "edit" && currencyHasLockedTxns ? (
        <p className="field-hint">{t("forms.work.currency_locked")}</p>
      ) : (
        <p className="field-hint">{t("forms.work.hint.currency_default")}</p>
      )}

      {/* ── Pay details (reference-only, collapsible) ── */}
      <details className="field">
        <summary className="form-section-label" style={{ cursor: "pointer", userSelect: "none" }}>
          {t("forms.work.section.pay_details")}
        </summary>
        <div style={{ paddingTop: "var(--sp-3)", display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
          <p className="field-hint">{t("forms.work.hint.pay_details_reference")}</p>

          {/* Rate type segmented control */}
          <div className="field">
            <div className="form-label">{t("forms.work.field.rate_type")}</div>
            <div role="radiogroup" style={{ display: "flex", gap: "var(--sp-2)", flexWrap: "wrap" }}>
              {ALL_RATE_TYPES.map((rt) => (
                <button
                  key={rt}
                  type="button"
                  role="radio"
                  aria-checked={watchedRateType === rt}
                  className={`seg-btn${watchedRateType === rt ? " active" : ""}`}
                  onClick={() => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (setValue as any)("rateType", watchedRateType === rt ? null : rt);
                  }}
                >
                  {t(`forms.work.rate_type.${rt.toLowerCase()}` as Parameters<typeof t>[0])}
                </button>
              ))}
            </div>
            {rateTypeErr && <div className="field-error">{rateTypeErr}</div>}
          </div>

          {/* Rate amount — label changes by rateType */}
          <MoneyInput
            register={register("rateAmount", { setValueAs: (v) => (v === "" || v == null ? null : v) })}
            label={rateAmountLabel()}
            error={rateAmountErr}
            placeholder="0.00"
          />

          {/* Pay day */}
          <NumberField
            register={register("payDay", { setValueAs: (v) => (v === "" || v == null ? null : Number(v)) })}
            label={t("forms.work.field.pay_day")}
            error={errMsg(errors.payDay)}
            placeholder={t("forms.work.placeholder.pay_day")}
            min={1}
            max={31}
            step={1}
          />

          {/* Hours per month */}
          <NumberField
            register={register("hoursPerMonth", { setValueAs: (v) => (v === "" || v == null ? null : Number(v)) })}
            label={t("forms.work.field.hours_per_month")}
            error={errMsg(errors.hoursPerMonth)}
            placeholder={String(HOURS_PER_MONTH_DEFAULT)}
            hint={t("forms.work.hint.hours_per_month")}
            min={1}
            max={744}
            step={1}
          />

          {/* Premium */}
          <MoneyInput
            register={register("premiumAmount", { setValueAs: (v) => (v === "" || v == null ? null : v) })}
            label={t("forms.work.field.premium_amount")}
            error={errMsg(errors.premiumAmount)}
            placeholder="0.00"
          />
          <TextField
            register={register("premiumNote")}
            label={t("forms.work.field.premium_note")}
            error={errMsg(errors.premiumNote)}
            placeholder=""
          />

          {/* Tax rate */}
          <NumberField
            register={register("taxRatePct", { setValueAs: (v) => (v === "" || v == null ? null : Number(v)) })}
            label={t("forms.work.field.tax_rate")}
            error={errMsg(errors.taxRatePct)}
            placeholder={t("forms.work.placeholder.tax_rate")}
            hint={t("forms.work.hint.tax_rate")}
            min={0}
            max={100}
            step={0.01}
          />
        </div>
      </details>

      {/* ── Period (optional) ── */}
      <div className="form-section-label">{t("forms.work.section.period")}</div>

      <DateField
        register={register("startedAt", { setValueAs: (v) => (v === "" || v == null ? null : v) })}
        label={t("forms.work.field.started_at")}
        error={errMsg(errors.startedAt)}
      />

      <DateField
        register={register("endedAt", { setValueAs: (v) => (v === "" || v == null ? null : v) })}
        label={t("forms.work.field.ended_at")}
        error={endedAtErr}
      />

      <div className="field">
        <label className="form-checkbox-label">
          <input type="checkbox" {...register("isActive")} />
          {t("forms.work.field.is_active")}
        </label>
      </div>

      {/* Notes */}
      <TextareaField
        register={register("note")}
        label={t("forms.work.field.notes")}
        error={errMsg(errors.note)}
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

    {mode === "edit" && workSourceId && (
      <div style={{ marginTop: "var(--sp-4)" }}>
        <button
          type="button"
          className="btn-ghost"
          disabled={isDeleting || isPending}
          onClick={() => {
            if (!confirm(t("forms.work.delete_confirm"))) return;
            setDeleteError(null);
            startDelete(async () => {
              const result = await deactivateWorkSourceAction(workSourceId);
              if (!result.ok) {
                setDeleteError(t("forms.work.delete_failed"));
                return;
              }
              router.push("/income");
            });
          }}
        >
          {t("forms.work.delete")}
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
