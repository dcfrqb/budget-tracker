"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useServerActionForm } from "./use-server-action-form";
import { transferCreateSchema, transferUpdateSchema } from "@/lib/validation/transfer";
import type { TransferCreateInput, TransferUpdateInput } from "@/lib/validation/transfer";
import {
  createTransferAction,
  updateTransferAction,
} from "@/app/(shell)/transactions/transfer-actions";
import { useT } from "@/lib/i18n";
import { AccountSelect, type AccountOption } from "./account-select";
import { MoneyInput } from "./primitives/money-input";
import { DateField } from "./primitives/date-field";
import { TextareaField } from "./primitives/textarea-field";
import { TextField } from "./primitives/text-field";
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

export interface TransferFormProps {
  variant: "page" | "drawer";
  mode?: "create" | "edit";
  transferId?: string;
  accounts: AccountOption[];
  defaultValues?: Partial<TransferCreateInput>;
  initialValues?: Partial<TransferCreateInput>;
  onSuccess?: () => void;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function TransferForm({
  variant,
  mode = "create",
  transferId,
  accounts,
  defaultValues: initialDefaults,
  initialValues,
  onSuccess,
}: TransferFormProps) {
  const t = useT();
  const router = useRouter();

  // Build the action: for create, use createTransferAction directly.
  // For edit, bind transferId into updateTransferAction.
  const action = React.useMemo(() => {
    if (mode === "edit" && transferId) {
      return (input: TransferUpdateInput): Promise<ActionResult<unknown>> =>
        updateTransferAction(transferId, input);
    }
    // Create: schema is the full create schema, cast action accordingly
    return createTransferAction as (input: TransferCreateInput) => Promise<ActionResult<unknown>>;
  }, [mode, transferId]);

  const schema = mode === "edit" ? (transferUpdateSchema as z.ZodType<TransferUpdateInput>) : transferCreateSchema;

  const { form, submit, isPending, formError } = useServerActionForm(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schema as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    action as any,
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      defaultValues: {
        occurredAt: todayIso(),
        ...initialDefaults,
        ...initialValues,
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
    watch,
    setValue,
    formState: { errors },
  } = form;

  const fromAccountId = watch("fromAccountId");
  const toAccountId = watch("toAccountId");

  const fromAccount = accounts.find((a) => a.id === fromAccountId);
  const toAccount = accounts.find((a) => a.id === toAccountId);

  const sameCurrency =
    fromAccount && toAccount && fromAccount.currencyCode === toAccount.currencyCode;

  // Auto-sync toAmount when same currency
  const fromAmountVal = watch("fromAmount");
  useEffect(() => {
    if (sameCurrency && fromAmountVal) {
      setValue("toAmount", fromAmountVal);
    }
  }, [sameCurrency, fromAmountVal, setValue]);

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
            ? t("forms.transfer.title_create")
            : t("forms.transfer.title_edit")}
        </h1>
      )}

      {/* From account */}
      <AccountSelect
        register={register("fromAccountId")}
        accounts={accounts}
        label={t("forms.transfer.field.from_account")}
        error={errMsg(errors.fromAccountId)}
        required
        placeholder={t("forms.transfer.placeholder.from_account")}
      />

      {/* To account */}
      <AccountSelect
        register={register("toAccountId")}
        accounts={accounts}
        label={t("forms.transfer.field.to_account")}
        error={errMsg(errors.toAccountId)}
        required
        placeholder={t("forms.transfer.placeholder.to_account")}
      />

      {/* From amount */}
      <MoneyInput
        register={register("fromAmount")}
        label={t("forms.transfer.field.from_amount")}
        error={errMsg(errors.fromAmount)}
        required={mode === "create"}
        currencyCode={fromAccount?.currencyCode}
      />

      {/* To amount — hidden when same currency */}
      {!sameCurrency && (
        <MoneyInput
          register={register("toAmount")}
          label={t("forms.transfer.field.to_amount")}
          error={errMsg(errors.toAmount)}
          required={mode === "create"}
          currencyCode={toAccount?.currencyCode}
        />
      )}

      {/* Rate — only for cross-currency */}
      {!sameCurrency && fromAccount && toAccount && (
        <TextField
          register={register("rate")}
          label={t("forms.transfer.field.rate")}
          error={errMsg(errors.rate)}
          placeholder={t("forms.transfer.placeholder.rate")}
          hint={t("forms.transfer.cross_currency_hint")}
        />
      )}

      {/* Fee — optional */}
      <MoneyInput
        register={register("fee")}
        label={t("forms.transfer.field.fee")}
        error={errMsg(errors.fee)}
        currencyCode={fromAccount?.currencyCode}
      />

      {/* Date */}
      <DateField
        register={register("occurredAt")}
        label={t("forms.transfer.field.occurred_at")}
        error={errMsg(errors.occurredAt)}
        required={mode === "create"}
      />

      {/* Note */}
      <TextareaField
        register={register("note")}
        label={t("forms.transfer.field.note")}
        error={errMsg(errors.note)}
        placeholder={t("forms.transfer.placeholder.note")}
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
