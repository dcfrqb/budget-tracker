"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { TransactionKind, TransactionStatus, Scope } from "@prisma/client";
import { useServerActionForm } from "./use-server-action-form";
import { transactionCreateSchema } from "@/lib/validation/transaction";
import type { TransactionCreateInput } from "@/lib/validation/transaction";
import { createTransactionAction } from "@/app/(shell)/transactions/actions";
import { useT } from "@/lib/i18n";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import { AccountSelect, type AccountOption } from "./account-select";
import { CategorySelect, type CategoryOption } from "./category-select";
import { CurrencySelect, type CurrencyOption } from "./currency-select";
import { TextField } from "./primitives/text-field";
import { TextareaField } from "./primitives/textarea-field";
import { MoneyInput } from "./primitives/money-input";
import { DateField } from "./primitives/date-field";
import { SelectField } from "./primitives/select-field";
import { SubmitRow } from "./primitives/submit-row";

// ─────────────────────────────────────────────────────────────
// Helper: extract string error message from RHF error field
// ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function errMsg(e: any): string | undefined {
  if (!e) return undefined;
  if (typeof e === "string") return e;
  if (typeof e?.message === "string") return e.message;
  return undefined;
}

// ─────────────────────────────────────────────────────────────
// Option types for linked entities
// ─────────────────────────────────────────────────────────────

export interface SimpleOption {
  id: string;
  name: string;
}

export interface TransactionFormProps {
  variant: "page" | "drawer";
  mode: "create" | "edit";
  accounts: AccountOption[];
  categories: CategoryOption[];
  currencies: CurrencyOption[];
  loans?: SimpleOption[];
  subscriptions?: SimpleOption[];
  funds?: SimpleOption[];
  longProjects?: SimpleOption[];
  workSources?: SimpleOption[];
  personalDebts?: SimpleOption[];
  plannedEvents?: SimpleOption[];
  defaultKind?: TransactionKind;
  defaultStatus?: TransactionStatus;
  /** Pre-fill the Name/Description field (e.g. from one-liner quick input) */
  defaultName?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialValues?: Record<string, any>;
  onSuccess?: () => void;
  transactionId?: string;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function TransactionForm({
  variant,
  mode,
  accounts,
  categories,
  currencies,
  loans,
  subscriptions,
  funds,
  longProjects,
  workSources,
  plannedEvents,
  defaultKind,
  defaultStatus,
  defaultName,
  initialValues,
  onSuccess,
}: TransactionFormProps) {
  const t = useT();
  const router = useRouter();

  const effectiveKind = defaultKind ?? initialValues?.kind ?? TransactionKind.EXPENSE;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const defaultValues: Record<string, any> = {
    kind: effectiveKind,
    status: defaultStatus ?? TransactionStatus.DONE,
    occurredAt: todayIso(),
    scope: Scope.PERSONAL,
    currencyCode: DEFAULT_CURRENCY,
    ...(defaultName ? { name: defaultName } : {}),
    ...initialValues,
  };

  const { form, submit, isPending, formError } = useServerActionForm(
    transactionCreateSchema,
    createTransactionAction,
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      defaultValues: defaultValues as any,
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
    watch,
    formState: { errors },
  } = form;

  const watchedAccountId = watch("accountId");
  const watchedKind = watch("kind") as TransactionKind;
  const watchedIsReimbursable = watch("isReimbursable");

  // Derive currency from selected account
  const selectedAccount = accounts.find((a) => a.id === watchedAccountId);
  const accountCurrency = selectedAccount?.currencyCode;

  // Title
  let title: string;
  if (mode === "edit") {
    title = t("forms.tx.title_edit");
  } else if (watchedKind === TransactionKind.INCOME) {
    title = t("forms.tx.title_income");
  } else if (watchedKind === TransactionKind.EXPENSE) {
    title = t("forms.tx.title_expense");
  } else {
    title = t("forms.tx.title_create");
  }

  const isExpense =
    watchedKind === TransactionKind.EXPENSE ||
    watchedKind === TransactionKind.LOAN_PAYMENT;
  const isIncome =
    watchedKind === TransactionKind.INCOME ||
    watchedKind === TransactionKind.REIMBURSEMENT ||
    watchedKind === TransactionKind.DEBT_IN;

  const kindOptions = [
    { value: TransactionKind.INCOME, label: t("forms.common.kind.income") },
    { value: TransactionKind.EXPENSE, label: t("forms.common.kind.expense") },
    { value: TransactionKind.LOAN_PAYMENT, label: t("forms.common.kind.loan_payment") },
    { value: TransactionKind.DEBT_OUT, label: t("forms.common.kind.debt_out") },
    { value: TransactionKind.DEBT_IN, label: t("forms.common.kind.debt_in") },
    { value: TransactionKind.REIMBURSEMENT, label: t("forms.common.kind.reimbursement") },
  ];

  const statusOptions = [
    { value: TransactionStatus.DONE, label: t("forms.common.status.done") },
    { value: TransactionStatus.PLANNED, label: t("forms.common.status.planned") },
    { value: TransactionStatus.PARTIAL, label: t("forms.common.status.partial") },
    { value: TransactionStatus.MISSED, label: t("forms.common.status.missed") },
    { value: TransactionStatus.CANCELLED, label: t("forms.common.status.cancelled") },
  ];

  const scopeOptions = [
    { value: Scope.PERSONAL, label: t("forms.common.scope.personal") },
    { value: Scope.SHARED, label: t("forms.common.scope.shared") },
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
        <h1 className="form-title">{title}</h1>
      )}
      {variant === "page" && (
        <p className="form-required-hint">{t("forms.common.required_hint")}</p>
      )}

      {/* Kind — show when creating and no defaultKind */}
      {mode === "create" && !defaultKind && (
        <SelectField
          register={register("kind")}
          label={t("forms.tx.field.kind")}
          options={kindOptions}
          error={errMsg(errors.kind)}
          required
        />
      )}

      {/* Account */}
      <AccountSelect
        register={register("accountId")}
        accounts={accounts}
        label={t("forms.tx.field.account")}
        error={errMsg(errors.accountId)}
        required
        placeholder={t("forms.tx.placeholder.account")}
      />

      {/* Amount + Currency in a row */}
      <div className="form-row">
        <MoneyInput
          register={register("amount")}
          label={t("forms.tx.field.amount")}
          error={errMsg(errors.amount)}
          required
          currencyCode={accountCurrency}
        />
        <CurrencySelect
          register={register("currencyCode")}
          currencies={currencies}
          label={t("forms.tx.field.currency")}
          error={errMsg(errors.currencyCode)}
          required
          placeholder={t("forms.tx.placeholder.currency")}
        />
      </div>

      {/* Name */}
      <TextField
        register={register("name")}
        label={t("forms.tx.field.name")}
        error={errMsg(errors.name)}
        required
        placeholder={t("forms.tx.placeholder.name")}
      />

      {/* Category — filtered by kind */}
      <CategorySelect
        register={register("categoryId")}
        categories={categories}
        label={t("forms.tx.field.category")}
        error={errMsg(errors.categoryId)}
        placeholder={t("forms.tx.placeholder.category")}
        kind={isExpense ? "EXPENSE" : isIncome ? "INCOME" : undefined}
      />

      {/* Date */}
      <DateField
        register={register("occurredAt")}
        label={t("forms.tx.field.occurred_at")}
        error={errMsg(errors.occurredAt)}
        required
      />

      {/* Planned At — optional */}
      <DateField
        register={register("plannedAt")}
        label={t("forms.tx.field.planned_at")}
        error={errMsg(errors.plannedAt)}
      />

      {/* Status — only in edit mode */}
      {mode === "edit" && (
        <SelectField
          register={register("status")}
          label={t("forms.tx.field.status")}
          options={statusOptions}
          error={errMsg(errors.status)}
        />
      )}

      {/* Scope */}
      <SelectField
        register={register("scope")}
        label={t("forms.tx.field.scope")}
        options={scopeOptions}
        error={errMsg(errors.scope)}
      />

      {/* Note */}
      <TextareaField
        register={register("note")}
        label={t("forms.tx.field.note")}
        error={errMsg(errors.note)}
        placeholder={t("forms.tx.placeholder.note")}
      />

      {/* Reimbursable — only for expenses */}
      {isExpense && (
        <div className="field">
          <label className="form-checkbox-label">
            <input
              type="checkbox"
              {...register("isReimbursable")}
            />
            {t("forms.tx.field.is_reimbursable")}
          </label>
          {watchedIsReimbursable && (
            <div className="form-indent">
              <TextField
                register={register("reimbursementFromName")}
                label={t("forms.tx.field.reimbursement_from")}
                error={errMsg(errors.reimbursementFromName)}
              />
              <MoneyInput
                register={register("expectedReimbursement")}
                label={t("forms.tx.field.expected_reimbursement")}
                error={errMsg(errors.expectedReimbursement)}
                currencyCode={accountCurrency}
              />
            </div>
          )}
        </div>
      )}

      {/* Optional linked entity selects */}
      {loans && loans.length > 0 && (
        <SelectField
          register={register("loanId")}
          label={t("forms.tx.field.loan")}
          options={[
            { value: "", label: "—" },
            ...loans.map((l) => ({ value: l.id, label: l.name })),
          ]}
          error={errMsg(errors.loanId)}
        />
      )}

      {subscriptions && subscriptions.length > 0 && (
        <SelectField
          register={register("subscriptionId")}
          label={t("forms.tx.field.subscription")}
          options={[
            { value: "", label: "—" },
            ...subscriptions.map((s) => ({ value: s.id, label: s.name })),
          ]}
          error={errMsg(errors.subscriptionId)}
        />
      )}

      {funds && funds.length > 0 && (
        <SelectField
          register={register("fundId")}
          label={t("forms.tx.field.fund")}
          options={[
            { value: "", label: "—" },
            ...funds.map((f) => ({ value: f.id, label: f.name })),
          ]}
          error={errMsg(errors.fundId)}
        />
      )}

      {longProjects && longProjects.length > 0 && (
        <SelectField
          register={register("longProjectId")}
          label={t("forms.tx.field.long_project")}
          options={[
            { value: "", label: "—" },
            ...longProjects.map((p) => ({ value: p.id, label: p.name })),
          ]}
          error={errMsg(errors.longProjectId)}
        />
      )}

      {workSources && workSources.length > 0 && (
        <SelectField
          register={register("workSourceId")}
          label={t("forms.tx.field.work_source")}
          options={[
            { value: "", label: "—" },
            ...workSources.map((w) => ({ value: w.id, label: w.name })),
          ]}
          error={errMsg(errors.workSourceId)}
        />
      )}

      {plannedEvents && plannedEvents.length > 0 && (
        <SelectField
          register={register("plannedEventId")}
          label={t("forms.tx.field.planned_event")}
          options={[
            { value: "", label: "—" },
            ...plannedEvents.map((e) => ({ value: e.id, label: e.name })),
          ]}
          error={errMsg(errors.plannedEventId)}
        />
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
