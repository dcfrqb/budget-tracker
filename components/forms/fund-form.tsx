"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { FundKind } from "@prisma/client";
import { useServerActionForm } from "./use-server-action-form";
import {
  fundCreateSchema,
  fundUpdateSchema,
} from "@/lib/validation/fund";
import {
  createFundAction,
  updateFundAction,
} from "@/app/(shell)/planning/funds/actions";
import { useT } from "@/lib/i18n";
import { CurrencySelect, type CurrencyOption } from "./currency-select";
import { TextField } from "./primitives/text-field";
import { TextareaField } from "./primitives/textarea-field";
import { MoneyInput } from "./primitives/money-input";
import { DateField } from "./primitives/date-field";
import { SelectField } from "./primitives/select-field";
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

export interface FundFormProps {
  variant?: "page" | "inline";
  mode: "create" | "edit";
  currencies: CurrencyOption[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialValues?: Record<string, any>;
  fundId?: string;
  onSuccess?: () => void;
}

export function FundForm({
  variant = "page",
  mode,
  currencies,
  initialValues,
  fundId,
  onSuccess,
}: FundFormProps) {
  const t = useT();
  const router = useRouter();

  type UpdateInput = z.infer<typeof fundUpdateSchema>;

  const action = React.useMemo(() => {
    if (mode === "edit" && fundId) {
      return (input: UpdateInput): Promise<ActionResult<unknown>> =>
        updateFundAction(fundId, input);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return createFundAction as (input: any) => Promise<ActionResult<unknown>>;
  }, [mode, fundId]);

  const schema = mode === "edit"
    ? (fundUpdateSchema as z.ZodType<UpdateInput>)
    : fundCreateSchema;

  const { form, submit, isPending, formError } = useServerActionForm(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schema as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    action as any,
    {
      defaultValues: {
        kind: FundKind.OTHER,
        ...initialValues,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      onSuccess: () => {
        if (onSuccess) {
          onSuccess();
        } else {
          router.push("/planning");
        }
      },
    },
  );

  const {
    register,
    formState: { errors },
  } = form;

  const kindOptions = [
    { value: FundKind.TRIP, label: t("forms.fund.kind_options.trip") },
    { value: FundKind.BUY, label: t("forms.fund.kind_options.buy") },
    { value: FundKind.VAULT, label: t("forms.fund.kind_options.vault") },
    { value: FundKind.GIFT, label: t("forms.fund.kind_options.gift") },
    { value: FundKind.OTHER, label: t("forms.fund.kind_options.other") },
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
          {mode === "create" ? t("forms.fund.title_create") : t("forms.fund.title_edit")}
        </h1>
      )}

      {/* Kind */}
      <SelectField
        register={register("kind")}
        label={t("forms.fund.field.kind")}
        options={kindOptions}
        error={errMsg(errors.kind)}
        required
      />

      {/* Name */}
      <TextField
        register={register("name")}
        label={t("forms.fund.field.name")}
        error={errMsg(errors.name)}
        required
      />

      {/* Goal amount + Currency */}
      <div className="form-row">
        <MoneyInput
          register={register("goalAmount")}
          label={t("forms.fund.field.goal_amount")}
          error={errMsg(errors.goalAmount)}
          required
        />
        <CurrencySelect
          register={register("currencyCode")}
          currencies={currencies}
          label={t("forms.fund.field.currency")}
          error={errMsg(errors.currencyCode)}
          required
        />
      </div>

      {/* Current amount */}
      <MoneyInput
        register={register("currentAmount")}
        label={t("forms.fund.field.current_amount")}
        error={errMsg(errors.currentAmount)}
      />

      {/* Target date */}
      <DateField
        register={register("targetDate")}
        label={t("forms.fund.field.target_date")}
        error={errMsg(errors.targetDate)}
      />

      {/* Monthly contribution */}
      <MoneyInput
        register={register("monthlyContribution")}
        label={t("forms.fund.field.monthly_contribution")}
        error={errMsg(errors.monthlyContribution)}
      />

      {/* Note */}
      <TextareaField
        register={register("note")}
        label={t("forms.fund.field.note")}
        error={errMsg(errors.note)}
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
