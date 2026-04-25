"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useServerActionForm } from "./use-server-action-form";
import {
  longProjectCreateSchema,
  longProjectUpdateSchema,
} from "@/lib/validation/long-project";
import {
  createLongProjectAction,
  updateLongProjectAction,
} from "@/app/(shell)/expenses/long-projects/actions";
import { useT } from "@/lib/i18n";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import { CurrencySelect, type CurrencyOption } from "./currency-select";
import { CategorySelect, type CategoryOption } from "./category-select";
import { TextField } from "./primitives/text-field";
import { TextareaField } from "./primitives/textarea-field";
import { MoneyInput } from "./primitives/money-input";
import { DateField } from "./primitives/date-field";
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

export interface LongProjectFormProps {
  variant?: "page" | "inline";
  mode: "create" | "edit";
  currencies: CurrencyOption[];
  categories: CategoryOption[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialValues?: Record<string, any>;
  projectId?: string;
  onSuccess?: () => void;
}

export function LongProjectForm({
  variant = "page",
  mode,
  currencies,
  categories,
  initialValues,
  projectId,
  onSuccess,
}: LongProjectFormProps) {
  const t = useT();
  const router = useRouter();

  type UpdateInput = z.infer<typeof longProjectUpdateSchema>;

  const action = React.useMemo(() => {
    if (mode === "edit" && projectId) {
      return (input: UpdateInput): Promise<ActionResult<unknown>> =>
        updateLongProjectAction(projectId, input);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return createLongProjectAction as (input: any) => Promise<ActionResult<unknown>>;
  }, [mode, projectId]);

  const schema = mode === "edit"
    ? (longProjectUpdateSchema as z.ZodType<UpdateInput>)
    : longProjectCreateSchema;

  const { form, submit, isPending, formError } = useServerActionForm(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schema as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    action as any,
    {
      defaultValues: {
        startDate: todayIso(),
        currencyCode: DEFAULT_CURRENCY,
        ...initialValues,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      onSuccess: () => {
        if (onSuccess) {
          onSuccess();
        } else {
          router.push("/expenses");
        }
      },
    },
  );

  const {
    register,
    formState: { errors },
  } = form;

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
          {mode === "create"
            ? t("forms.long_project.title_create")
            : t("forms.long_project.title_edit")}
        </h1>
      )}
      {variant === "page" && (
        <p className="form-required-hint">{t("forms.common.required_hint")}</p>
      )}

      {/* Name */}
      <TextField
        register={register("name")}
        label={t("forms.long_project.field.name")}
        error={errMsg(errors.name)}
        placeholder={t("forms.long_project.placeholder.name")}
        required
      />

      {/* Budget + Currency */}
      <div className="form-row">
        <MoneyInput
          register={register("budget")}
          label={t("forms.long_project.field.budget")}
          error={errMsg(errors.budget)}
          required
        />
        <CurrencySelect
          register={register("currencyCode")}
          currencies={currencies}
          label={t("forms.long_project.field.currency")}
          error={errMsg(errors.currencyCode)}
          required
        />
      </div>

      {/* Category */}
      {categories.length > 0 && (
        <CategorySelect
          register={register("categoryId")}
          categories={categories}
          label={t("forms.long_project.field.category")}
          error={errMsg(errors.categoryId)}
          placeholder={t("forms.long_project.placeholder.category")}
          kind="EXPENSE"
        />
      )}

      {/* Start date */}
      <DateField
        register={register("startDate")}
        label={t("forms.long_project.field.start_date")}
        error={errMsg(errors.startDate)}
        required
      />

      {/* End date */}
      <DateField
        register={register("endDate")}
        label={t("forms.long_project.field.end_date")}
        error={errMsg(errors.endDate)}
      />

      {/* Note */}
      <TextareaField
        register={register("note")}
        label={t("forms.long_project.field.note")}
        error={errMsg(errors.note)}
        placeholder={t("forms.long_project.placeholder.note")}
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
