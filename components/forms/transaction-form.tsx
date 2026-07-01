"use client";

import React, { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { TransactionKind, TransactionStatus, Scope, BusinessEntryType } from "@prisma/client";
import { useServerActionForm } from "./use-server-action-form";
import { transactionCreateSchema } from "@/lib/validation/transaction";
import type { TransactionCreateInput } from "@/lib/validation/transaction";
import { createTransactionAction } from "@/app/(shell)/transactions/actions";
import { createTransferAction } from "@/app/(shell)/transactions/transfer-actions";
import Link from "next/link";
import { useT } from "@/lib/i18n";
import { DEFAULT_CURRENCY, DEFAULT_TZ } from "@/lib/constants";
import { todayKeyInTz } from "@/lib/format/date";
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
  tz?: string;
  loans?: SimpleOption[];
  subscriptions?: SimpleOption[];
  funds?: SimpleOption[];
  longProjects?: SimpleOption[];
  workSources?: SimpleOption[];
  businesses?: SimpleOption[];
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

function todayIso(tz?: string): string {
  return todayKeyInTz(tz ?? DEFAULT_TZ);
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
  businesses,
  plannedEvents,
  defaultKind,
  defaultStatus,
  defaultName,
  initialValues,
  onSuccess,
  tz,
}: TransactionFormProps) {
  const t = useT();
  const router = useRouter();

  const effectiveKind = defaultKind ?? initialValues?.kind ?? TransactionKind.EXPENSE;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const defaultValues: Record<string, any> = {
    kind: effectiveKind,
    status: defaultStatus ?? TransactionStatus.DONE,
    occurredAt: todayIso(tz),
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
    setValue,
    formState: { errors },
  } = form;

  const watchedAccountId = watch("accountId");
  const watchedKind = watch("kind") as TransactionKind;
  const watchedBusinessId = watch("businessId") as string | null | undefined;
  const watchedBusinessEntryType = watch("businessEntryType") as BusinessEntryType | null | undefined;

  // Derive currency from selected account
  const selectedAccount = accounts.find((a) => a.id === watchedAccountId);
  const accountCurrency = selectedAccount?.currencyCode;

  // ── TRANSFER-specific state ──────────────────────────────────
  const isTransfer = watchedKind === TransactionKind.TRANSFER;
  const [toAccountId, setToAccountId] = useState("");
  const [transferPending, startTransferTransition] = useTransition();
  const [transferError, setTransferError] = useState<string | null>(null);

  function handleTransferSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTransferError(null);
    const data = new FormData(e.currentTarget);
    const fromAccountId = watchedAccountId ?? "";
    const amount = (data.get("amount") as string) ?? "";
    const occurredAt = (data.get("occurredAt") as string) ?? todayIso(tz);
    const note = (data.get("note") as string) || undefined;

    if (!fromAccountId || !toAccountId || !amount) return;
    if (fromAccountId === toAccountId) {
      setTransferError(t("forms.tx.errors.transfer_same_account"));
      return;
    }
    // MVP: only same-currency transfers supported.
    // TODO: multi-currency transfer with FX rate + fee — follow-up.
    const fromCcy = accounts.find((a) => a.id === fromAccountId)?.currencyCode;
    const toCcy = accounts.find((a) => a.id === toAccountId)?.currencyCode;
    if (fromCcy && toCcy && fromCcy !== toCcy) {
      setTransferError(t("forms.tx.errors.transfer_currency_mismatch"));
      return;
    }

    startTransferTransition(async () => {
      // MVP: same-currency transfer; rate=1, fee=null.
      // TODO: multi-currency transfer with FX rate + fee — follow-up.
      const result = await createTransferAction({
        fromAccountId,
        toAccountId,
        fromAmount: amount,
        toAmount: amount,
        occurredAt,
        note: note ?? null,
      });
      if (!result.ok) {
        const errKey = result.formError ?? "internal_error";
        if (errKey === "transfer_same_account") {
          setTransferError(t("forms.tx.errors.transfer_same_account"));
        } else if (errKey === "transfer_currency_mismatch") {
          setTransferError(t("forms.tx.errors.transfer_currency_mismatch"));
        } else {
          setTransferError(t("forms.common.form_error.internal"));
        }
        return;
      }
      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/transactions");
      }
    });
  }

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
    watchedKind === TransactionKind.DEBT_IN;

  const kindOptions = [
    { value: TransactionKind.INCOME, label: t("forms.common.kind.income") },
    { value: TransactionKind.EXPENSE, label: t("forms.common.kind.expense") },
    { value: TransactionKind.TRANSFER, label: t("forms.common.kind.transfer") },
    { value: TransactionKind.LOAN_PAYMENT, label: t("forms.common.kind.loan_payment") },
    { value: TransactionKind.DEBT_OUT, label: t("forms.common.kind.debt_out") },
    { value: TransactionKind.DEBT_IN, label: t("forms.common.kind.debt_in") },
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

  // ── TRANSFER branch — rendered as its own form ───────────────
  if (isTransfer && mode === "create") {
    const toAccount = accounts.find((a) => a.id === toAccountId);
    const fromAccountCcy = selectedAccount?.currencyCode;
    const toAccountCcy = toAccount?.currencyCode;
    const ccyMismatch = !!fromAccountCcy && !!toAccountCcy && fromAccountCcy !== toAccountCcy;

    return (
      <form onSubmit={handleTransferSubmit} className="form-grid">
        {variant === "page" && (
          <h1 className="form-title">{t("forms.transfer.title_create")}</h1>
        )}
        {/* Kind selector to allow switching away from TRANSFER */}
        <SelectField
          register={register("kind")}
          label={t("forms.tx.field.kind")}
          options={kindOptions}
          error={errMsg(errors.kind)}
          required
        />
        {/* From account */}
        <AccountSelect
          register={register("accountId")}
          accounts={accounts}
          label={t("forms.tx.field.fromAccount")}
          error={errMsg(errors.accountId)}
          required
          placeholder={t("forms.tx.placeholder.account")}
        />
        {/* To account */}
        <div className="field">
          <label className="form-label" htmlFor="transfer-to-account">
            {t("forms.tx.field.toAccount")}
          </label>
          <select
            id="transfer-to-account"
            value={toAccountId}
            onChange={(e) => setToAccountId(e.target.value)}
            required
          >
            <option value="">{t("forms.tx.placeholder.account")}</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        {ccyMismatch && (
          <p className="field-hint">{t("forms.transfer.cross_currency_hint")}</p>
        )}
        {/* Amount */}
        <MoneyInput
          register={register("amount")}
          label={t("forms.tx.field.amount")}
          error={errMsg(errors.amount)}
          required
          currencyCode={fromAccountCcy}
        />
        {/* Date */}
        <DateField
          register={register("occurredAt")}
          label={t("forms.tx.field.occurred_at")}
          error={errMsg(errors.occurredAt)}
          required
        />
        {/* Note */}
        <TextareaField
          register={register("note")}
          label={t("forms.tx.field.note")}
          error={errMsg(errors.note)}
          placeholder={t("forms.tx.placeholder.note")}
        />
        <SubmitRow
          isSubmitting={transferPending}
          submitLabel={t("forms.common.save")}
          cancelLabel={t("forms.common.cancel")}
          onCancel={variant === "page" ? () => router.back() : onSuccess}
          formError={transferError}
        />
      </form>
    );
  }

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

      {watchedKind === TransactionKind.INCOME ? (
        workSources && workSources.length > 0 ? (
          <SelectField
            register={register("workSourceId")}
            label={t("forms.tx.field.work_source_required")}
            options={workSources.map((w) => ({ value: w.id, label: w.name }))}
            error={
              errMsg(errors.workSourceId) === "work_source_required"
                ? t("forms.tx.errors.work_source_required")
                : errMsg(errors.workSourceId)
            }
            required
          />
        ) : (
          <div
            className="field"
            style={{
              padding: "var(--sp-4)",
              background: "var(--surface-2, var(--surface))",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius, 4px)",
            }}
          >
            <div className="mono" style={{ fontWeight: 600, marginBottom: "var(--sp-2)" }}>
              {t("forms.tx.work_source.empty_cta_title")}
            </div>
            <p className="mono" style={{ fontSize: "var(--text-sm)", color: "var(--muted)", marginBottom: "var(--sp-3)" }}>
              {t("forms.tx.work_source.empty_cta_body")}
            </p>
            <Link href="/income/work-sources/new" className="btn primary" style={{ fontSize: 12 }}>
              {t("forms.tx.work_source.empty_cta_button")}
            </Link>
          </div>
        )
      ) : (
        workSources && workSources.length > 0 && (
          <SelectField
            register={register("workSourceId")}
            label={t("forms.tx.field.work_source")}
            options={[
              { value: "", label: "—" },
              ...workSources.map((w) => ({ value: w.id, label: w.name })),
            ]}
            error={errMsg(errors.workSourceId)}
          />
        )
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

      {businesses && businesses.length > 0 && (
        <SelectField
          register={register("businessId", {
            setValueAs: (v) => (v === "" || v == null ? null : v),
            onChange: (e) => {
              if (!e.target.value) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (setValue as any)("businessEntryType", null);
              }
            },
          })}
          label={t("forms.tx.field.business")}
          options={[
            { value: "", label: "—" },
            ...businesses.map((b) => ({ value: b.id, label: b.name })),
          ]}
          error={errMsg(errors.businessId)}
        />
      )}

      {watchedKind === TransactionKind.INCOME && watchedBusinessId && (
        <div className="field">
          <div className="form-label">{t("forms.tx.field.business_entry_type")}</div>
          <div role="radiogroup" style={{ display: "flex", gap: "var(--sp-2)" }}>
            {([BusinessEntryType.REVENUE, BusinessEntryType.PASS_THROUGH] as const).map((entryType) => (
              <button
                key={entryType}
                type="button"
                role="radio"
                aria-checked={(watchedBusinessEntryType ?? BusinessEntryType.REVENUE) === entryType}
                className={`seg-btn${(watchedBusinessEntryType ?? BusinessEntryType.REVENUE) === entryType ? " active" : ""}`}
                onClick={() => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (setValue as any)("businessEntryType", entryType);
                }}
              >
                {t(`forms.tx.business_entry_type.${entryType.toLowerCase()}` as Parameters<typeof t>[0])}
              </button>
            ))}
          </div>
          <p className="field-hint">{t("forms.tx.hint.business_entry_type")}</p>
        </div>
      )}

      {(() => {
        const incomeNoSources = watchedKind === TransactionKind.INCOME && (!workSources || workSources.length === 0);
        return (
          <SubmitRow
            isSubmitting={isPending || incomeNoSources}
            submitLabel={t("forms.common.save")}
            cancelLabel={t("forms.common.cancel")}
            onCancel={
              variant === "page"
                ? () => router.back()
                : onSuccess
            }
            formError={translatedErrorKey}
          />
        );
      })()}
    </form>
  );
}
