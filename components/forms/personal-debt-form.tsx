"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useServerActionForm } from "./use-server-action-form";
import {
  debtCreateSchema,
  debtUpdateSchema,
} from "@/lib/validation/debt";
import {
  createPersonalDebtAction,
  updatePersonalDebtAction,
} from "@/app/(shell)/transactions/personal-debts/actions";
import { useT } from "@/lib/i18n";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import { CurrencySelect, type CurrencyOption } from "./currency-select";
import { AccountSelect, type AccountOption } from "./account-select";
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

export interface PersonalDebtFormProps {
  variant?: "page" | "inline";
  mode: "create" | "edit";
  currencies: CurrencyOption[];
  accounts: AccountOption[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialValues?: Record<string, any>;
  debtId?: string;
  onSuccess?: () => void;
}

export function PersonalDebtForm({
  variant = "page",
  mode,
  currencies,
  accounts,
  initialValues,
  debtId,
  onSuccess,
}: PersonalDebtFormProps) {
  const t = useT();
  const router = useRouter();

  type UpdateInput = z.infer<typeof debtUpdateSchema>;

  const action = React.useMemo(() => {
    if (mode === "edit" && debtId) {
      return (input: UpdateInput): Promise<ActionResult<unknown>> =>
        updatePersonalDebtAction(debtId, input);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return createPersonalDebtAction as (input: any) => Promise<ActionResult<unknown>>;
  }, [mode, debtId]);

  const schema = mode === "edit"
    ? (debtUpdateSchema as z.ZodType<UpdateInput>)
    : debtCreateSchema;

  const { form, submit, isPending, formError } = useServerActionForm(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schema as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    action as any,
    {
      defaultValues: {
        direction: "OUT",
        openedAt: todayIso(),
        currencyCode: DEFAULT_CURRENCY,
        ...initialValues,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      onSuccess: () => {
        if (onSuccess) {
          onSuccess();
        } else {
          router.push("/transactions");
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

  const directionOptions = [
    { value: "OUT", label: t("forms.personal_debt.direction.OUT") },
    { value: "IN", label: t("forms.personal_debt.direction.IN") },
  ];

  return (
    <form onSubmit={submit} className="form-grid">
      {variant === "page" && (
        <h1 className="form-title">
          {mode === "create"
            ? t("forms.personal_debt.title_create")
            : t("forms.personal_debt.title_edit")}
        </h1>
      )}
      {variant === "page" && (
        <p className="form-required-hint">{t("forms.common.required_hint")}</p>
      )}

      {/* Direction (create only) */}
      {mode === "create" && (
        <SelectField
          register={register("direction")}
          label={t("forms.personal_debt.field.direction")}
          options={directionOptions}
          error={errMsg(errors.direction)}
          required
        />
      )}

      {/* Counterparty */}
      <TextField
        register={register("counterparty")}
        label={t("forms.personal_debt.field.counterparty")}
        error={errMsg(errors.counterparty)}
        placeholder={t("forms.personal_debt.placeholder.counterparty")}
        required
      />

      {/* Principal + Currency (create only) */}
      {mode === "create" && (
        <div className="form-row">
          <MoneyInput
            register={register("principal")}
            label={t("forms.personal_debt.field.principal")}
            error={errMsg(errors.principal)}
            required
          />
          <CurrencySelect
            register={register("currencyCode")}
            currencies={currencies}
            label={t("forms.personal_debt.field.currency")}
            error={errMsg(errors.currencyCode)}
            required
          />
        </div>
      )}

      {/* Opened at (create only) */}
      {mode === "create" && (
        <DateField
          register={register("openedAt")}
          label={t("forms.personal_debt.field.opened_at")}
          error={errMsg(errors.openedAt)}
          required
        />
      )}

      {/* Due at */}
      <DateField
        register={register("dueAt")}
        label={t("forms.personal_debt.field.due_at")}
        error={errMsg(errors.dueAt)}
      />

      {/* Account (create only) */}
      {mode === "create" && accounts.length > 0 && (
        <AccountSelect
          register={register("initialTransfer.accountId")}
          accounts={accounts}
          label={t("forms.personal_debt.field.account")}
          error={errMsg(errors.initialTransfer)}
          placeholder={t("forms.personal_debt.placeholder.account")}
        />
      )}

      {/* Note */}
      <TextareaField
        register={register("note")}
        label={t("forms.personal_debt.field.note")}
        error={errMsg(errors.note)}
        placeholder={t("forms.personal_debt.placeholder.note")}
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
