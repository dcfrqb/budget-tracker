"use client";

import React from "react";
import { BusinessEntryType } from "@prisma/client";
import { useServerActionForm } from "@/components/forms/use-server-action-form";
import { businessAllocationCreateSchema } from "@/lib/validation/business";
import { createBusinessAllocationAction } from "@/app/(shell)/business/actions";
import { useT } from "@/lib/i18n";
import { TextField } from "@/components/forms/primitives/text-field";
import { TextareaField } from "@/components/forms/primitives/textarea-field";
import { MoneyInput } from "@/components/forms/primitives/money-input";
import { DateField } from "@/components/forms/primitives/date-field";
import { SelectField } from "@/components/forms/primitives/select-field";
import { CurrencySelect, type CurrencyOption } from "@/components/forms/currency-select";
import { SubmitRow } from "@/components/forms/primitives/submit-row";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function errMsg(e: any): string | undefined {
  if (!e) return undefined;
  if (typeof e === "string") return e;
  if (typeof e?.message === "string") return e.message;
  return undefined;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface OffAppRevenueFormProps {
  businessId: string;
  currencyCode: string;
  currencies: CurrencyOption[];
  onSuccess?: () => void;
}

export function OffAppRevenueForm({
  businessId,
  currencyCode,
  currencies,
  onSuccess,
}: OffAppRevenueFormProps) {
  const t = useT();

  const { form, submit, isPending, formError } = useServerActionForm(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    businessAllocationCreateSchema as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createBusinessAllocationAction as (input: any) => ReturnType<typeof createBusinessAllocationAction>,
    {
      defaultValues: {
        businessId,
        transactionId: undefined,
        currencyCode,
        entryType: BusinessEntryType.REVENUE,
        streamKey: "bot",
        occurredAt: todayKey(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      onSuccess: () => onSuccess?.(),
    },
  );

  const {
    register,
    formState: { errors },
  } = form;

  const entryTypeOptions = [
    { value: BusinessEntryType.REVENUE, label: t("business.allocation.entry_type.revenue") },
    { value: BusinessEntryType.EXPENSE, label: t("business.allocation.entry_type.expense") },
  ];

  const translatedErrorKey =
    formError === "over_allocated"
      ? t("business.allocation.error.over_allocated")
      : formError === "not_found"
      ? t("forms.common.form_error.not_found")
      : formError
      ? t("forms.common.form_error.internal")
      : null;

  return (
    <form onSubmit={submit} className="form-grid">
      <p className="field-hint">{t("business.allocation.offapp.hint")}</p>

      <SelectField
        register={register("entryType")}
        label={t("business.allocation.field.entry_type")}
        options={entryTypeOptions}
        error={errMsg(errors.entryType)}
        required
      />

      <div className="form-row">
        <MoneyInput
          register={register("amount")}
          label={t("business.allocation.field.amount")}
          error={errMsg(errors.amount)}
          required
        />
        <CurrencySelect
          register={register("currencyCode")}
          currencies={currencies}
          label={t("business.allocation.field.currency")}
          error={errMsg(errors.currencyCode)}
          required
        />
      </div>

      <DateField
        register={register("occurredAt")}
        label={t("business.allocation.field.occurred_at")}
        error={errMsg(errors.occurredAt)}
        required
      />

      <TextField
        register={register("streamKey")}
        label={t("business.allocation.field.stream_key")}
        error={errMsg(errors.streamKey)}
        hint={t("business.allocation.stream_key_hint")}
      />

      <TextField
        register={register("tariff")}
        label={t("business.allocation.field.tariff")}
        error={errMsg(errors.tariff)}
      />

      <TextareaField
        register={register("note")}
        label={t("business.allocation.field.note")}
        error={errMsg(errors.note)}
      />

      <SubmitRow
        isSubmitting={isPending}
        submitLabel={t("forms.common.save")}
        cancelLabel={t("forms.common.cancel")}
        onCancel={onSuccess}
        formError={translatedErrorKey}
      />
    </form>
  );
}
