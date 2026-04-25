"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useServerActionForm } from "./use-server-action-form";
import {
  familyCreateSchema,
  familyUpdateSchema,
} from "@/lib/validation/family";
import {
  createFamilyAction,
  updateFamilyAction,
} from "@/app/(shell)/family/actions";
import { useT } from "@/lib/i18n";
import { TextField } from "./primitives/text-field";
import { TextareaField } from "./primitives/textarea-field";
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

export interface FamilyFormProps {
  variant?: "page" | "inline";
  mode: "create" | "edit";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialValues?: Record<string, any>;
  familyId?: string;
  onSuccess?: () => void;
}

export function FamilyForm({
  variant = "page",
  mode,
  initialValues,
  familyId,
  onSuccess,
}: FamilyFormProps) {
  const t = useT();
  const router = useRouter();

  type UpdateInput = z.infer<typeof familyUpdateSchema>;

  const action = React.useMemo(() => {
    if (mode === "edit" && familyId) {
      return (input: UpdateInput): Promise<ActionResult<unknown>> =>
        updateFamilyAction(familyId, input);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return createFamilyAction as (input: any) => Promise<ActionResult<unknown>>;
  }, [mode, familyId]);

  const schema = mode === "edit"
    ? (familyUpdateSchema as z.ZodType<UpdateInput>)
    : familyCreateSchema;

  const { form, submit, isPending, formError } = useServerActionForm(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schema as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    action as any,
    {
      defaultValues: {
        ...initialValues,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      onSuccess: () => {
        if (onSuccess) {
          onSuccess();
        } else {
          router.push("/family");
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
            ? t("forms.family.title_create")
            : t("forms.family.title_edit")}
        </h1>
      )}
      {variant === "page" && (
        <p className="form-required-hint">{t("forms.common.required_hint")}</p>
      )}

      {/* Name */}
      <TextField
        register={register("name")}
        label={t("forms.family.field.name")}
        error={errMsg(errors.name)}
        placeholder={t("forms.family.placeholder.name")}
        required
      />

      {/* Note */}
      <TextareaField
        register={register("note")}
        label={t("forms.family.field.note")}
        error={errMsg(errors.note)}
        placeholder={t("forms.family.placeholder.note")}
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
