"use client";

import React, { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useServerActionForm } from "./use-server-action-form";
import { businessCreateSchema, businessUpdateSchema } from "@/lib/validation/business";
import type { BusinessCreateInput } from "@/lib/validation/business";
import {
  createBusinessAction,
  updateBusinessAction,
  deactivateBusinessAction,
} from "@/app/(shell)/business/actions";
import { useT } from "@/lib/i18n";
import { CurrencySelect, type CurrencyOption } from "./currency-select";
import { TextField } from "./primitives/text-field";
import { TextareaField } from "./primitives/textarea-field";
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

export interface BusinessFormProps {
  variant?: "page" | "inline";
  mode: "create" | "edit";
  currencies: CurrencyOption[];
  initialValues?: Partial<BusinessCreateInput>;
  businessId?: string;
  currencyHasLockedTxns?: boolean;
  defaultCurrencyCode?: string;
  onSuccess?: () => void;
}

export function BusinessForm({
  variant = "page",
  mode,
  currencies,
  initialValues,
  businessId,
  currencyHasLockedTxns = false,
  defaultCurrencyCode,
  onSuccess,
}: BusinessFormProps) {
  const t = useT();
  const router = useRouter();
  const [isDeleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  type UpdateInput = z.infer<typeof businessUpdateSchema>;

  const action = React.useMemo(() => {
    if (mode === "edit" && businessId) {
      return (input: UpdateInput): Promise<ActionResult<unknown>> =>
        updateBusinessAction(businessId, input);
    }
    return createBusinessAction as (input: BusinessCreateInput) => Promise<ActionResult<unknown>>;
  }, [mode, businessId]);

  const schema = mode === "edit"
    ? (businessUpdateSchema as z.ZodType<UpdateInput>)
    : businessCreateSchema;

  const { form, submit, isPending, formError } = useServerActionForm(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schema as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    action as any,
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      defaultValues: {
        isActive: true,
        currencyCode: defaultCurrencyCode ?? null,
        ...initialValues,
      } as any,
      onSuccess: () => {
        if (onSuccess) {
          onSuccess();
        } else {
          router.push("/business");
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
      : formError === "currency_locked"
      ? t("forms.business.currency_locked")
      : formError
      ? t("forms.common.form_error.internal")
      : null;

  return (
    <>
    <form onSubmit={submit} className="form-grid">
      {variant === "page" && (
        <h1 className="form-title">
          {mode === "create" ? t("forms.business.title_create") : t("forms.business.title_edit")}
        </h1>
      )}
      {variant === "page" && (
        <p className="form-required-hint">{t("forms.common.required_hint")}</p>
      )}

      <TextField
        register={register("name")}
        label={t("forms.business.field.name")}
        error={errMsg(errors.name)}
        required
        placeholder={t("forms.business.placeholder.name")}
      />

      <CurrencySelect
        register={register("currencyCode", {
          setValueAs: (v) => (v === "" || v == null ? null : v),
        })}
        currencies={currencies}
        label={t("forms.business.field.currency")}
        error={errMsg(errors.currencyCode)}
        disabled={mode === "edit" && currencyHasLockedTxns}
      />
      {mode === "edit" && currencyHasLockedTxns ? (
        <p className="field-hint">{t("forms.business.currency_locked")}</p>
      ) : (
        <p className="field-hint">{t("forms.business.hint.currency_default")}</p>
      )}

      <DateField
        register={register("startedAt", { setValueAs: (v) => (v === "" || v == null ? null : v) })}
        label={t("forms.business.field.started_at")}
        error={errMsg(errors.startedAt)}
      />

      <div className="field">
        <label className="form-checkbox-label">
          <input type="checkbox" {...register("isActive")} />
          {t("forms.business.field.is_active")}
        </label>
      </div>

      <TextareaField
        register={register("note")}
        label={t("forms.business.field.note")}
        error={errMsg(errors.note)}
        placeholder={t("forms.business.placeholder.note")}
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

    {mode === "edit" && businessId && (
      <div style={{ marginTop: "var(--sp-4)" }}>
        <button
          type="button"
          className="btn-ghost"
          disabled={isDeleting || isPending}
          onClick={() => {
            if (!confirm(t("forms.business.delete_confirm"))) return;
            setDeleteError(null);
            startDelete(async () => {
              const result = await deactivateBusinessAction(businessId);
              if (!result.ok) {
                setDeleteError(t("forms.business.delete_failed"));
                return;
              }
              router.push("/business");
            });
          }}
        >
          {t("forms.business.delete")}
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
