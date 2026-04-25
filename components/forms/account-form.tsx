"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AccountKind, InstitutionKind, SavingsCapitalization } from "@prisma/client";
import { useServerActionForm } from "./use-server-action-form";
import { accountCreateSchema, accountUpdateSchema } from "@/lib/validation/account";
import { createAccountAction, updateAccountAction, archiveAccountAction } from "@/app/(shell)/wallet/actions";
import { useT } from "@/lib/i18n";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import { CurrencySelect, type CurrencyOption } from "./currency-select";
import { TextField } from "./primitives/text-field";
import { TextareaField } from "./primitives/textarea-field";
import { MoneyInput } from "./primitives/money-input";
import { SelectField } from "./primitives/select-field";
import { SubmitRow } from "./primitives/submit-row";
import { CardLast4Input } from "./primitives/card-last4-input";
import { z } from "zod";
import type { ActionResult } from "@/lib/actions/result";
import { InfoCallout } from "@/components/ui/info-callout";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function errMsg(e: any): string | undefined {
  if (!e) return undefined;
  if (typeof e === "string") return e;
  if (typeof e?.message === "string") return e.message;
  return undefined;
}

const ACCOUNT_ERROR_CODES = new Set([
  "credit_rate_required",
  "credit_limit_required",
  "savings_rate_required",
  "cash_goes_through_cash_stash",
  "balance_required",
  "card_last4_already_bound",
]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function useAccountErrMsg(t: ReturnType<typeof useT>) {
  return (e: any): string | undefined => {
    const raw = errMsg(e);
    if (!raw) return undefined;
    if (ACCOUNT_ERROR_CODES.has(raw)) {
      return t(`forms.account.errors.${raw}` as Parameters<typeof t>[0]);
    }
    return raw;
  };
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
  const accErrMsg = useAccountErrMsg(t);
  const router = useRouter();
  const [showNewInstitution, setShowNewInstitution] = useState(false);
  const [isArchiving, startArchive] = useTransition();
  const [archiveError, setArchiveError] = useState<string | null>(null);

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
        balance: "",
        includeInAnalytics: true,
        currencyCode: DEFAULT_CURRENCY,
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
  const selectedKind = watch("kind") as AccountKind;
  const [minPaymentType, setMinPaymentType] = React.useState<"percent" | "fixed">("percent");

  // cardLast4 chips — local state kept in sync with RHF via setValue
  const watchedCardLast4 = watch("cardLast4") as string[] | undefined;
  const [chips, setChips] = React.useState<string[]>(() => watchedCardLast4 ?? []);

  function handleChipsChange(next: string[]) {
    setChips(next);
    setValue(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      "cardLast4" as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      next as any,
      { shouldDirty: true },
    );
  }

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

  // CASH excluded from create form (D5); CREDIT added
  const kindOptions = [
    { value: AccountKind.CARD, label: t("forms.account.kind.card") },
    { value: AccountKind.CREDIT, label: t("forms.account.kind.credit") },
    { value: AccountKind.SAVINGS, label: t("forms.account.kind.savings") },
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

  const savingsCapOptions = [
    { value: SavingsCapitalization.NONE, label: t("wallet.account.form.savings.cap_none") },
    { value: SavingsCapitalization.MONTHLY, label: t("wallet.account.form.savings.cap_monthly") },
    { value: SavingsCapitalization.QUARTERLY, label: t("wallet.account.form.savings.cap_quarterly") },
    { value: SavingsCapitalization.YEARLY, label: t("wallet.account.form.savings.cap_yearly") },
  ];

  const translatedErrorKey =
    formError === "unique_violation"
      ? t("forms.common.form_error.unique_violation")
      : formError === "not_found"
      ? t("forms.common.form_error.not_found")
      : formError === "conflict"
      ? t("forms.common.form_error.conflict")
      : formError === "card_last4_already_bound"
      ? t("forms.account.errors.card_last4_already_bound")
      : formError
      ? t("forms.common.form_error.internal")
      : null;

  const isCredit = selectedKind === AccountKind.CREDIT;
  const isSavings = selectedKind === AccountKind.SAVINGS;
  const payType = minPaymentType;

  return (
    <>
    <form onSubmit={submit} className="form-grid">
      {variant === "page" && (
        <h1 className="form-title">
          {mode === "create" ? t("forms.account.title_create") : t("forms.account.title_edit")}
        </h1>
      )}
      {variant === "page" && (
        <p className="form-required-hint">{t("forms.common.required_hint")}</p>
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

      {/* Balance — required on create, editable on edit */}
      {mode === "create" ? (
        <MoneyInput
          register={register("balance")}
          label={isCredit ? t("forms.account.field.balance_label_credit") : t("forms.account.field.balance_required")}
          error={accErrMsg(errors.balance)}
          inputClassName="money-input--leading"
          required
        />
      ) : (
        <div>
          <MoneyInput
            register={register("balance")}
            label={t("forms.account.balance.label.edit")}
            error={accErrMsg(errors.balance)}
            inputClassName="money-input--leading"
          />
          <p className="field-hint">{t("forms.account.balance.hint.edit")}</p>
        </div>
      )}

      {/* Account kind */}
      <SelectField
        register={register("kind")}
        label={t("forms.account.field.kind")}
        options={kindOptions}
        error={accErrMsg(errors.kind)}
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

      {/* ── CREDIT conditional fields (D6) ── */}
      {isCredit && (
        <div className="form-indent">
          <p className="form-section-label">{t("forms.account.kind.credit")}</p>
          {mode === "create" && (
            <InfoCallout tone="info" compact>
              {t("forms.account.credit.balance_hint")}
            </InfoCallout>
          )}
          <MoneyInput
            register={register("creditRatePct")}
            label={t("wallet.account.form.credit.rate")}
            error={accErrMsg(errors.creditRatePct)}
            required
          />
          <MoneyInput
            register={register("creditLimit")}
            label={t("wallet.account.form.credit.limit")}
            error={accErrMsg(errors.creditLimit)}
            required
          />
          <div className="field">
            <label className="form-label">{t("wallet.account.form.credit.grace_period")}</label>
            <input
              type="number"
              min={0}
              max={365}
              step={1}
              {...register("gracePeriodDays", { valueAsNumber: true })}
            />
            {errMsg(errors.gracePeriodDays) && (
              <span className="field-error" role="alert">{errMsg(errors.gracePeriodDays)}</span>
            )}
          </div>
          <div className="field">
            <label className="form-label">{t("wallet.account.form.credit.statement_day")}</label>
            <input
              type="number"
              min={1}
              max={31}
              step={1}
              {...register("statementDay", { valueAsNumber: true })}
            />
            {errMsg(errors.statementDay) && (
              <span className="field-error" role="alert">{errMsg(errors.statementDay)}</span>
            )}
          </div>
          {/* Min payment — radio for percent vs fixed */}
          <div className="field">
            <label className="form-label">{t("wallet.account.form.credit.min_payment.label")}</label>
            <div style={{ display: "flex", gap: 16, marginBottom: 8 }}>
              <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
                <input
                  type="radio"
                  value="percent"
                  checked={payType === "percent"}
                  onChange={() => {
                    setMinPaymentType("percent");
                    setValue("minPaymentFixed", null);
                  }}
                />
                {t("wallet.account.form.credit.min_payment.type_percent")}
              </label>
              <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
                <input
                  type="radio"
                  value="fixed"
                  checked={payType === "fixed"}
                  onChange={() => {
                    setMinPaymentType("fixed");
                    setValue("minPaymentPercent", null);
                  }}
                />
                {t("wallet.account.form.credit.min_payment.type_fixed")}
              </label>
            </div>
            {payType === "percent" ? (
              <MoneyInput
                register={register("minPaymentPercent")}
                label={t("wallet.account.form.credit.min_payment.percent")}
                error={errMsg(errors.minPaymentPercent)}
              />
            ) : (
              <MoneyInput
                register={register("minPaymentFixed")}
                label={t("wallet.account.form.credit.min_payment.fixed")}
                error={errMsg(errors.minPaymentFixed)}
              />
            )}
          </div>
        </div>
      )}

      {/* ── SAVINGS conditional fields (D6) ── */}
      {isSavings && (
        <div className="form-indent">
          <p className="form-section-label">{t("forms.account.kind.savings")}</p>
          <MoneyInput
            register={register("annualRatePct")}
            label={t("wallet.account.form.savings.rate")}
            error={accErrMsg(errors.annualRatePct)}
            required
          />
          <SelectField
            register={register("savingsCapitalization")}
            label={t("wallet.account.form.savings.capitalization")}
            options={savingsCapOptions}
            error={errMsg(errors.savingsCapitalization)}
          />
          <MoneyInput
            register={register("withdrawalLimit")}
            label={t("wallet.account.form.savings.withdrawal_limit")}
            error={errMsg(errors.withdrawalLimit)}
          />
        </div>
      )}

      {/* Note */}
      <TextareaField
        register={register("sub")}
        label={t("forms.account.field.note")}
        error={errMsg(errors.sub)}
        placeholder={t("forms.account.placeholder.note")}
      />

      {/* cardLast4 chip input */}
      <CardLast4Input chips={chips} onChange={handleChipsChange} />

      {/* Bank requisites (optional) */}
      <div className="form-indent">
        <p className="form-section-label">{t("forms.account.section.requisites.title")}</p>
        <TextField
          register={register("accountNumber")}
          label={t("forms.account.requisites.accountNumber.label")}
          error={errMsg(errors.accountNumber)}
          placeholder={t("forms.account.requisites.accountNumber.hint")}
        />
        <TextField
          register={register("bic")}
          label={t("forms.account.requisites.bic.label")}
          error={errMsg(errors.bic)}
          placeholder={t("forms.account.requisites.bic.hint")}
        />
        <TextField
          register={register("bankName")}
          label={t("forms.account.requisites.bankName.label")}
          error={errMsg(errors.bankName)}
          placeholder={t("forms.account.requisites.bankName.label")}
        />
      </div>

      {/* includeInAnalytics checkbox (D7) */}
      <div className="field">
        <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
          <input
            type="checkbox"
            {...register("includeInAnalytics")}
          />
          <span className="form-label" style={{ margin: 0 }}>
            {t("wallet.account.form.include_in_analytics.label")}
          </span>
        </label>
        <p className="field-hint">{t("wallet.account.form.include_in_analytics.hint")}</p>
      </div>

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

    {mode === "edit" && accountId && (
      <div style={{ marginTop: "var(--sp-4)" }}>
        <button
          type="button"
          className="btn-ghost"
          disabled={isArchiving || isPending}
          onClick={() => {
            setArchiveError(null);
            startArchive(async () => {
              const result = await archiveAccountAction(accountId);
              if (!result.ok) {
                setArchiveError(t("wallet.account.edit.archive_failed"));
                return;
              }
              router.push("/wallet");
            });
          }}
        >
          {t("wallet.account.edit.archive")}
        </button>
        {archiveError && (
          <div className="field-error" role="alert" style={{ marginTop: "var(--sp-2)" }}>
            {archiveError}
          </div>
        )}
      </div>
    )}
    </>
  );
}
