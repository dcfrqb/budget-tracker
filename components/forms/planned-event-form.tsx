"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { PlannedEventKind } from "@prisma/client";
import { useServerActionForm } from "./use-server-action-form";
import {
  plannedEventCreateSchema,
  plannedEventUpdateSchema,
} from "@/lib/validation/planned-event";
import {
  createPlannedEventAction,
  updatePlannedEventAction,
} from "@/app/(shell)/planning/events/actions";
import { useT } from "@/lib/i18n";
import { DEFAULT_CURRENCY } from "@/lib/constants";
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

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface FundOption {
  id: string;
  name: string;
}

export interface PlannedEventFormProps {
  variant?: "page" | "inline";
  mode: "create" | "edit";
  currencies: CurrencyOption[];
  funds?: FundOption[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialValues?: Record<string, any>;
  eventId?: string;
  onSuccess?: () => void;
}

export function PlannedEventForm({
  variant = "page",
  mode,
  currencies,
  funds = [],
  initialValues,
  eventId,
  onSuccess,
}: PlannedEventFormProps) {
  const t = useT();
  const router = useRouter();

  type UpdateInput = z.infer<typeof plannedEventUpdateSchema>;

  const action = React.useMemo(() => {
    if (mode === "edit" && eventId) {
      return (input: UpdateInput): Promise<ActionResult<unknown>> =>
        updatePlannedEventAction(eventId, input);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return createPlannedEventAction as (input: any) => Promise<ActionResult<unknown>>;
  }, [mode, eventId]);

  const schema = mode === "edit"
    ? (plannedEventUpdateSchema as z.ZodType<UpdateInput>)
    : plannedEventCreateSchema;

  const { form, submit, isPending, formError } = useServerActionForm(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schema as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    action as any,
    {
      defaultValues: {
        kind: PlannedEventKind.OTHER,
        eventDate: todayIso(),
        repeatsYearly: false,
        currencyCode: DEFAULT_CURRENCY,
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
    watch,
    formState: { errors },
  } = form;

  const watchedExpectedAmount = watch("expectedAmount");
  const showCurrency = !!watchedExpectedAmount;

  const kindOptions = [
    { value: PlannedEventKind.BIRTHDAY, label: t("forms.event.kind_options.birthday") },
    { value: PlannedEventKind.HOLIDAY, label: t("forms.event.kind_options.holiday") },
    { value: PlannedEventKind.TRIP, label: t("forms.event.kind_options.trip") },
    { value: PlannedEventKind.PURCHASE, label: t("forms.event.kind_options.purchase") },
    { value: PlannedEventKind.OTHER, label: t("forms.event.kind_options.other") },
  ];

  const fundOptions = [
    { value: "", label: "—" },
    ...funds.map((f) => ({ value: f.id, label: f.name })),
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
          {mode === "create" ? t("forms.event.title_create") : t("forms.event.title_edit")}
        </h1>
      )}
      {variant === "page" && (
        <p className="form-required-hint">{t("forms.common.required_hint")}</p>
      )}

      {/* Kind */}
      <SelectField
        register={register("kind")}
        label={t("forms.event.field.kind")}
        options={kindOptions}
        error={errMsg(errors.kind)}
        required
      />

      {/* Name */}
      <TextField
        register={register("name")}
        label={t("forms.event.field.title")}
        error={errMsg(errors.name)}
        required
      />

      {/* Event date */}
      <DateField
        register={register("eventDate")}
        label={t("forms.event.field.event_date")}
        error={errMsg(errors.eventDate)}
        required
      />

      {/* Repeats yearly */}
      <div className="field">
        <label className="form-checkbox-label">
          <input type="checkbox" {...register("repeatsYearly")} />
          {t("forms.event.field.repeats_yearly")}
        </label>
      </div>

      {/* Fund */}
      {funds.length > 0 && (
        <SelectField
          register={register("fundId")}
          label={t("forms.event.field.fund")}
          options={fundOptions}
          error={errMsg(errors.fundId)}
        />
      )}

      {/* Expected amount + currency */}
      <MoneyInput
        register={register("expectedAmount")}
        label={t("forms.event.field.expected_amount")}
        error={errMsg(errors.expectedAmount)}
      />

      {showCurrency && (
        <CurrencySelect
          register={register("currencyCode")}
          currencies={currencies}
          label={t("forms.event.field.currency")}
          error={errMsg(errors.currencyCode)}
        />
      )}

      {/* Note */}
      <TextareaField
        register={register("note")}
        label={t("forms.event.field.note")}
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
