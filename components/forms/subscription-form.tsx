"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { SharingType } from "@prisma/client";
import { useServerActionForm } from "./use-server-action-form";
import {
  subscriptionCreateSchema,
  subscriptionUpdateSchema,
} from "@/lib/validation/subscription";
import {
  createSubscriptionAction,
  updateSubscriptionAction,
} from "@/app/(shell)/expenses/subscriptions/actions";
import { useT } from "@/lib/i18n";
import { DEFAULT_CURRENCY, DEFAULT_TZ } from "@/lib/constants";
import { todayKeyInTz } from "@/lib/format/date";
import { CurrencySelect, type CurrencyOption } from "./currency-select";
import { TextField } from "./primitives/text-field";
import { TextareaField } from "./primitives/textarea-field";
import { MoneyInput } from "./primitives/money-input";
import { DateField } from "./primitives/date-field";
import { SelectField } from "./primitives/select-field";
import { NumberField } from "./primitives/number-field";
import { SubmitRow } from "./primitives/submit-row";
import type { ActionResult } from "@/lib/actions/result";
import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function errMsg(e: any): string | undefined {
  if (!e) return undefined;
  if (typeof e === "string") return e;
  if (typeof e?.message === "string") return e.message;
  return undefined;
}

function todayIso(tz?: string): string {
  return todayKeyInTz(tz ?? DEFAULT_TZ);
}

export interface SubscriptionFormProps {
  variant?: "page" | "inline";
  mode: "create" | "edit";
  currencies: CurrencyOption[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialValues?: Record<string, any>;
  subscriptionId?: string;
  onSuccess?: () => void;
  tz?: string;
  matchKeywords?: string[];
}

export function SubscriptionForm({
  variant = "page",
  mode,
  currencies,
  initialValues,
  subscriptionId,
  onSuccess,
  tz,
  matchKeywords = [],
}: SubscriptionFormProps) {
  const t = useT();
  const router = useRouter();

  type UpdateInput = z.infer<typeof subscriptionUpdateSchema>;

  const action = React.useMemo(() => {
    if (mode === "edit" && subscriptionId) {
      return (input: UpdateInput): Promise<ActionResult<unknown>> =>
        updateSubscriptionAction(subscriptionId, input);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return createSubscriptionAction as (input: any) => Promise<ActionResult<unknown>>;
  }, [mode, subscriptionId]);

  const schema = mode === "edit"
    ? (subscriptionUpdateSchema as z.ZodType<UpdateInput>)
    : subscriptionCreateSchema;

  const { form, submit, isPending, formError } = useServerActionForm(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schema as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    action as any,
    {
      defaultValues: {
        sharingType: SharingType.PERSONAL,
        billingIntervalMonths: 1,
        nextPaymentDate: todayIso(tz),
        isActive: true,
        currencyCode: DEFAULT_CURRENCY,
        ...initialValues,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      onSuccess: (result) => {
        if (onSuccess) {
          onSuccess();
        } else if (mode === "create") {
          // Redirect to edit page so user can add shares
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const sub = result as any;
          if (sub?.id) {
            router.push(`/expenses/subscriptions/${sub.id}/edit`);
          } else {
            router.push("/expenses/subscriptions");
          }
        } else {
          router.push("/expenses/subscriptions");
        }
      },
    },
  );

  const {
    register,
    watch,
    formState: { errors },
  } = form;

  const watchedSharingType = watch("sharingType") as SharingType;
  const isSplit = watchedSharingType === SharingType.SPLIT;
  const isPaidForOthers = watchedSharingType === SharingType.PAID_FOR_OTHERS;
  const watchedIsVariable = watch("isVariablePrice") as boolean | undefined;

  const intervalOptions = [
    { value: "1", label: t("forms.sub.interval_options.m1") },
    { value: "3", label: t("forms.sub.interval_options.m3") },
    { value: "6", label: t("forms.sub.interval_options.m6") },
    { value: "12", label: t("forms.sub.interval_options.m12") },
  ];

  const sharingTypeOptions = [
    { value: SharingType.PERSONAL, label: t("forms.sub.sharing_types.personal") },
    { value: SharingType.SPLIT, label: t("forms.sub.sharing_types.split") },
    { value: SharingType.PAID_FOR_OTHERS, label: t("forms.sub.sharing_types.paid_for_others") },
  ];

  const translatedErrorKey =
    formError === "unique_violation"
      ? t("forms.common.form_error.unique_violation")
      : formError === "not_found"
      ? t("forms.common.form_error.not_found")
      : formError === "conflict"
      ? t("forms.common.form_error.conflict")
      : formError
      ? t("forms.common.form_error.internal")
      : null;

  return (
    <form onSubmit={submit} className="form-grid">
      {variant === "page" && (
        <h1 className="form-title">
          {mode === "create" ? t("forms.sub.title_create") : t("forms.sub.title_edit")}
        </h1>
      )}
      {variant === "page" && (
        <p className="form-required-hint">{t("forms.common.required_hint")}</p>
      )}

      {/* Name */}
      <TextField
        register={register("name")}
        label={t("forms.sub.field.name")}
        error={errMsg(errors.name)}
        required
      />

      {/* Icon */}
      <TextField
        register={register("icon")}
        label={t("forms.sub.field.icon")}
        error={errMsg(errors.icon)}
      />

      {/* Icon colors row */}
      <div className="form-row">
        <TextField
          register={register("iconColor")}
          label={t("forms.sub.field.icon_color_fg")}
          error={errMsg(errors.iconColor)}
        />
        <TextField
          register={register("iconBg")}
          label={t("forms.sub.field.icon_color_bg")}
          error={errMsg(errors.iconBg)}
        />
      </div>

      {/* isVariablePrice */}
      <label className="form-checkbox-label">
        <input type="checkbox" {...register("isVariablePrice")} />
        <span>{t("forms.sub.field_is_variable")}</span>
        <span className="mono" style={{ color: "var(--muted)", fontSize: "var(--text-xs)", marginLeft: 6 }}>
          {t("forms.sub.field_is_variable_help")}
        </span>
      </label>

      {/* Price + Currency */}
      <div className="form-row">
        <MoneyInput
          register={register("price")}
          label={watchedIsVariable ? t("expenses.subscriptions.variable.price_label_estimate") : t("forms.sub.field.price")}
          error={errMsg(errors.price)}
          required
        />
        <CurrencySelect
          register={register("currencyCode")}
          currencies={currencies}
          label={t("forms.sub.field.currency")}
          error={errMsg(errors.currencyCode)}
          required
        />
      </div>

      {/* Billing interval */}
      <SelectField
        register={register("billingIntervalMonths", { valueAsNumber: true })}
        label={t("forms.sub.field.interval")}
        options={intervalOptions}
        error={errMsg(errors.billingIntervalMonths)}
        required
      />

      {/* Next payment date */}
      <DateField
        register={register("nextPaymentDate")}
        label={t("forms.sub.field.next_payment")}
        error={errMsg(errors.nextPaymentDate)}
        required
      />

      {/* Sharing type */}
      <SelectField
        register={register("sharingType")}
        label={t("forms.sub.field.sharing")}
        options={sharingTypeOptions}
        error={errMsg(errors.sharingType)}
        required
      />

      {/* Total users — only for SPLIT */}
      {isSplit && (
        <NumberField
          register={register("totalUsers", { valueAsNumber: true })}
          label={t("forms.sub.field.total_users")}
          error={errMsg(errors.totalUsers)}
          min={2}
          max={20}
          step={1}
          required
        />
      )}

      {/* Note */}
      <TextareaField
        register={register("note")}
        label={t("forms.sub.field.note")}
        error={errMsg(errors.note)}
      />

      {/* autoMatch */}
      <label className="form-checkbox-label">
        <input type="checkbox" {...register("autoMatch")} />
        <span>{t("forms.sub.field_auto_match")}</span>
        <span className="mono" style={{ color: "var(--muted)", fontSize: "var(--text-xs)", marginLeft: 6 }}>
          {t("forms.sub.field_auto_match_help")}
        </span>
      </label>

      {/* Reimbursement block — only for PAID_FOR_OTHERS */}
      {isPaidForOthers && (
        <div
          style={{
            borderTop: "1px solid var(--border)",
            paddingTop: "var(--space-3)",
            marginTop: "var(--space-1)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-3)",
          }}
        >
          <div
            className="mono"
            style={{ fontSize: "var(--text-xs)", color: "var(--accent)", letterSpacing: "0.06em" }}
          >
            {t("forms.sub.reimbursement.section_title")}
          </div>
          <div className="form-row">
            <MoneyInput
              register={register("reimbursementExpected")}
              label={t("forms.sub.reimbursement.field_expected")}
              error={errMsg(errors.reimbursementExpected)}
            />
            <CurrencySelect
              register={register("reimbursementCurrency")}
              currencies={currencies}
              label={t("forms.sub.reimbursement.field_currency")}
              error={errMsg(errors.reimbursementCurrency)}
            />
          </div>
          <TextField
            register={register("reimbursementFrom")}
            label={t("forms.sub.reimbursement.field_from")}
            error={errMsg(errors.reimbursementFrom)}
            placeholder={t("forms.sub.reimbursement.field_from_placeholder")}
          />
        </div>
      )}

      {/* matchKeywords — read-only alias chips (Phase 1: display only) */}
      {matchKeywords.length > 0 && (
        <div>
          <div className="mono" style={{ fontSize: "var(--text-xs)", color: "var(--muted)", marginBottom: 6 }}>
            {t("expenses.subscriptions.variable.keywords_caption")}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {matchKeywords.map((kw) => (
              <span
                key={kw}
                className="mono"
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--text)",
                  background: "var(--panel-2)",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  padding: "2px 8px",
                }}
              >
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}

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
