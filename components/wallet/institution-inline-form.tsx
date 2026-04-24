"use client";

import React from "react";
import { InstitutionKind } from "@prisma/client";
import { useServerActionForm } from "@/components/forms/use-server-action-form";
import { createInstitutionAction } from "@/app/(shell)/wallet/actions";
import { useT } from "@/lib/i18n";
import { TextField } from "@/components/forms/primitives/text-field";
import { SelectField } from "@/components/forms/primitives/select-field";
import { SubmitRow } from "@/components/forms/primitives/submit-row";
import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function errMsg(e: any): string | undefined {
  if (!e) return undefined;
  if (typeof e === "string") return e;
  if (typeof e?.message === "string") return e.message;
  return undefined;
}

const schema = z.object({
  name: z.string().min(1).max(120),
  kind: z.nativeEnum(InstitutionKind),
});

type FormValues = z.infer<typeof schema>;

interface InstitutionInlineFormProps {
  onSuccess?: (institutionId: string) => void;
  onCancel?: () => void;
}

export function InstitutionInlineForm({ onSuccess, onCancel }: InstitutionInlineFormProps) {
  const t = useT();

  const { form, submit, isPending, formError } = useServerActionForm(
    schema,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createInstitutionAction as any,
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      defaultValues: { kind: InstitutionKind.BANK } as any,
      onSuccess: (result) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onSuccess?.((result as any).id);
      },
    },
  );

  const { register, formState: { errors } } = form;

  const kindOptions = [
    { value: InstitutionKind.BANK, label: t("forms.account.institution_kind_bank") },
    { value: InstitutionKind.CRYPTO, label: t("forms.account.institution_kind_crypto") },
    { value: InstitutionKind.CASH, label: t("forms.account.institution_kind_cash") },
  ];

  const translatedError = formError ? t("forms.common.form_error.internal") : null;

  return (
    <form onSubmit={submit} className="form-grid">
      <TextField
        register={register("name")}
        label={t("forms.account.institution_name")}
        error={errMsg(errors.name)}
        required
        placeholder={t("forms.account.institution_name")}
      />
      <SelectField
        register={register("kind")}
        label={t("forms.account.institution_kind")}
        options={kindOptions}
        error={errMsg(errors.kind)}
        required
      />
      <SubmitRow
        isSubmitting={isPending}
        submitLabel={t("forms.common.add")}
        cancelLabel={t("forms.common.cancel")}
        onCancel={onCancel}
        formError={translatedError}
      />
    </form>
  );
}
