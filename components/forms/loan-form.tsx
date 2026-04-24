"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useServerActionForm } from "./use-server-action-form";
import {
  loanCreateSchema,
  loanUpdateSchema,
} from "@/lib/validation/loan";
import {
  createLoanAction,
  updateLoanAction,
} from "@/app/(shell)/expenses/loans/actions";
import { useT } from "@/lib/i18n";
import { CurrencySelect, type CurrencyOption } from "./currency-select";
import { AccountSelect, type AccountOption } from "./account-select";
import { TextField } from "./primitives/text-field";
import { TextareaField } from "./primitives/textarea-field";
import { MoneyInput } from "./primitives/money-input";
import { DateField } from "./primitives/date-field";
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

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface LoanFormProps {
  variant?: "page" | "inline";
  mode: "create" | "edit";
  currencies: CurrencyOption[];
  accounts: AccountOption[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialValues?: Record<string, any>;
  loanId?: string;
  onSuccess?: () => void;
}

export function LoanForm({
  variant = "page",
  mode,
  currencies,
  accounts,
  initialValues,
  loanId,
  onSuccess,
}: LoanFormProps) {
  const t = useT();
  const router = useRouter();

  type UpdateInput = z.infer<typeof loanUpdateSchema>;

  const action = React.useMemo(() => {
    if (mode === "edit" && loanId) {
      return (input: UpdateInput): Promise<ActionResult<unknown>> =>
        updateLoanAction(loanId, input);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return createLoanAction as (input: any) => Promise<ActionResult<unknown>>;
  }, [mode, loanId]);

  const schema = mode === "edit"
    ? (loanUpdateSchema as z.ZodType<UpdateInput>)
    : loanCreateSchema;

  const { form, submit, isPending, formError } = useServerActionForm(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schema as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    action as any,
    {
      defaultValues: {
        startDate: todayIso(),
        termMonths: 12,
        annualRatePct: 0,
        ...initialValues,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      onSuccess: () => {
        if (onSuccess) {
          onSuccess();
        } else {
          router.push("/expenses/loans");
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
          {mode === "create" ? t("forms.loan.title_create") : t("forms.loan.title_edit")}
        </h1>
      )}

      {/* Name */}
      <TextField
        register={register("name")}
        label={t("forms.loan.field.name")}
        error={errMsg(errors.name)}
        required
      />

      {/* Principal + Currency */}
      <div className="form-row">
        <MoneyInput
          register={register("principal")}
          label={t("forms.loan.field.principal")}
          error={errMsg(errors.principal)}
          required
        />
        <CurrencySelect
          register={register("currencyCode")}
          currencies={currencies}
          label={t("forms.loan.field.currency")}
          error={errMsg(errors.currencyCode)}
          required
        />
      </div>

      {/* Annual rate */}
      <NumberField
        register={register("annualRatePct", { valueAsNumber: true })}
        label={t("forms.loan.field.annual_rate")}
        error={errMsg(errors.annualRatePct)}
        required
        min={0}
        max={200}
        step={0.01}
        placeholder="0.00"
      />

      {/* Term months */}
      <NumberField
        register={register("termMonths", { valueAsNumber: true })}
        label={t("forms.loan.field.term_months")}
        error={errMsg(errors.termMonths)}
        required
        min={1}
        max={600}
        step={1}
      />

      {/* Start date */}
      <DateField
        register={register("startDate")}
        label={t("forms.loan.field.start_date")}
        error={errMsg(errors.startDate)}
        required
      />

      {/* Account */}
      {accounts.length > 0 && (
        <AccountSelect
          register={register("accountId")}
          accounts={accounts}
          label={t("forms.loan.field.account")}
          error={errMsg(errors.accountId)}
          placeholder="—"
        />
      )}

      {/* Note */}
      <TextareaField
        register={register("note")}
        label={t("forms.loan.field.note")}
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
