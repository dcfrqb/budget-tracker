"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { AccountKind, InstitutionKind } from "@prisma/client";
import { useServerActionForm } from "./use-server-action-form";
import { accountCreateSchema, accountUpdateSchema } from "@/lib/validation/account";
import { createAccountAction, updateAccountAction } from "@/app/(shell)/wallet/actions";
import { useT } from "@/lib/i18n";
import { CurrencySelect, type CurrencyOption } from "./currency-select";
import { TextField } from "./primitives/text-field";
import { TextareaField } from "./primitives/textarea-field";
import { MoneyInput } from "./primitives/money-input";
import { SelectField } from "./primitives/select-field";
import { SubmitRow } from "./primitives/submit-row";
import { z } from "zod";
import type { ActionResult } from "@/lib/actions/result";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function errMsg(e: any): string | undefined {
  if (!e) return undefined;
  if (typeof e === "string") return e;
  if (typeof e?.message === "string") return e.message;
  return undefined;
}

// ─────────────────────────────────────────────────────────────
// Extended schema with inline institution support (create only)
// ─────────────────────────────────────────────────────────────

const accountCreateFormSchema = accountCreateSchema.extend({
  newInstitutionName: z.string().min(1).max(120).optional(),
  newInstitutionKind: z.nativeEnum(InstitutionKind).optional(),
});

type AccountCreateFormValues = z.infer<typeof accountCreateFormSchema>;
type AccountUpdateFormValues = z.infer<typeof accountUpdateSchema>;

export interface InstitutionOption {
  id: string;
  name: string;
  kind: string;
}

export interface AccountFormProps {
  variant?: "page" | "inline";
  mode: "create" | "edit";
  institutions: InstitutionOption[];
  currencies: CurrencyOption[];
  initialValues?: Partial<AccountCreateFormValues>;
  accountId?: string;
  onSuccess?: () => void;
}

const NEW_INSTITUTION_VALUE = "__new__";

export function AccountForm({
  variant = "page",
  mode,
  institutions,
  currencies,
  initialValues,
  accountId,
  onSuccess,
}: AccountFormProps) {
  const t = useT();
  const router = useRouter();
  const [showNewInstitution, setShowNewInstitution] = useState(false);

  // Build action based on mode
  const action = React.useMemo(() => {
    if (mode === "edit" && accountId) {
      return (input: AccountUpdateFormValues): Promise<ActionResult<unknown>> =>
        updateAccountAction(accountId, input);
    }
    return createAccountAction as (input: AccountCreateFormValues) => Promise<ActionResult<unknown>>;
  }, [mode, accountId]);

  const schema = mode === "edit"
    ? (accountUpdateSchema as z.ZodType<AccountUpdateFormValues>)
    : accountCreateFormSchema;

  const { form, submit, isPending, formError } = useServerActionForm(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schema as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    action as any,
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      defaultValues: {
        kind: AccountKind.CARD,
        balance: "0",
        ...initialValues,
      } as any,
      onSuccess: () => {
        if (onSuccess) {
          onSuccess();
        } else {
          router.push("/wallet");
        }
      },
    },
  );

  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = form;

  const institutionSelectValue = watch("institutionId") as string | undefined;

  // Handle institution select change
  const handleInstitutionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value === NEW_INSTITUTION_VALUE) {
      setShowNewInstitution(true);
      setValue("institutionId", undefined);
    } else {
      setShowNewInstitution(false);
      setValue("institutionId", e.target.value || undefined);
    }
  };

  const kindOptions = [
    { value: AccountKind.CARD, label: t("forms.account.kind.card") },
    { value: AccountKind.SAVINGS, label: t("forms.account.kind.savings") },
    { value: AccountKind.CASH, label: t("forms.account.kind.cash") },
    { value: AccountKind.CRYPTO, label: t("forms.account.kind.crypto") },
    { value: AccountKind.LOAN, label: t("forms.account.kind.loan") },
  ];

  const institutionOptions = [
    { value: "", label: t("forms.account.placeholder.institution") },
    ...institutions.map((i) => ({ value: i.id, label: i.name })),
    { value: NEW_INSTITUTION_VALUE, label: t("forms.account.new_institution") },
  ];

  const institutionKindOptions = [
    { value: InstitutionKind.BANK, label: t("forms.account.institution_kind_bank") },
    { value: InstitutionKind.CRYPTO, label: t("forms.account.institution_kind_crypto") },
    { value: InstitutionKind.CASH, label: t("forms.account.institution_kind_cash") },
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
          {mode === "create" ? t("forms.account.title_create") : t("forms.account.title_edit")}
        </h1>
      )}

      {/* Institution select */}
      <div className="field">
        <label className="form-label" htmlFor="institutionId-select">
          {t("forms.account.field.institution")}
        </label>
        <select
          id="institutionId-select"
          value={showNewInstitution ? NEW_INSTITUTION_VALUE : (institutionSelectValue ?? "")}
          onChange={handleInstitutionChange}
        >
          {institutionOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {/* Hidden register for actual institutionId */}
        <input type="hidden" {...register("institutionId")} />
        {errMsg(errors.institutionId) && (
          <span className="field-error" role="alert">
            {errMsg(errors.institutionId)}
          </span>
        )}
      </div>

      {/* New institution inline form — only on create */}
      {mode === "create" && showNewInstitution && (
        <div className="form-indent">
          <p className="form-section-label">{t("forms.account.institution_section")}</p>
          <TextField
            register={register("newInstitutionName")}
            label={t("forms.account.institution_name")}
            error={errMsg(errors.newInstitutionName)}
            required
            placeholder={t("forms.account.institution_name")}
          />
          <SelectField
            register={register("newInstitutionKind")}
            label={t("forms.account.institution_kind")}
            options={institutionKindOptions}
            error={errMsg(errors.newInstitutionKind)}
          />
        </div>
      )}

      {/* Account name */}
      <TextField
        register={register("name")}
        label={t("forms.account.field.name")}
        error={errMsg(errors.name)}
        required
        placeholder={t("forms.account.placeholder.name")}
      />

      {/* Account kind */}
      <SelectField
        register={register("kind")}
        label={t("forms.account.field.kind")}
        options={kindOptions}
        error={errMsg(errors.kind)}
        required
      />

      {/* Currency */}
      <CurrencySelect
        register={register("currencyCode")}
        currencies={currencies}
        label={t("forms.account.field.currency")}
        error={errMsg(errors.currencyCode)}
        required
      />

      {/* Starting balance — only on create */}
      {mode === "create" && (
        <MoneyInput
          register={register("balance")}
          label={t("forms.account.field.balance")}
          error={errMsg(errors.balance)}
        />
      )}

      {/* Note */}
      <TextareaField
        register={register("sub")}
        label={t("forms.account.field.note")}
        error={errMsg(errors.sub)}
        placeholder={t("forms.account.placeholder.note")}
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
