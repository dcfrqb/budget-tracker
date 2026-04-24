"use client";

import React from "react";
import { useServerActionForm } from "./use-server-action-form";
import {
  familyMemberCreateSchema,
  familyMemberUpdateSchema,
} from "@/lib/validation/family-member";
import {
  addFamilyMemberAction,
  updateFamilyMemberAction,
} from "@/app/(shell)/family/actions";
import { useT } from "@/lib/i18n";
import { TextField } from "./primitives/text-field";
import { SelectField } from "./primitives/select-field";
import { SubmitRow } from "./primitives/submit-row";
import type { ActionResult } from "@/lib/actions/result";
import { z } from "zod";

const COLOR_OPTIONS = [
  { value: "var(--accent)", label: "Accent" },
  { value: "var(--info)", label: "Info" },
  { value: "var(--pos)", label: "Green" },
  { value: "var(--warn)", label: "Orange" },
  { value: "var(--chart-5)", label: "Purple" },
  { value: "var(--chart-6)", label: "Teal" },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function errMsg(e: any): string | undefined {
  if (!e) return undefined;
  if (typeof e === "string") return e;
  if (typeof e?.message === "string") return e.message;
  return undefined;
}

export interface FamilyMemberFormProps {
  mode: "create" | "edit";
  familyId?: string;
  memberId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialValues?: Record<string, any>;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function FamilyMemberForm({
  mode,
  familyId,
  memberId,
  initialValues,
  onSuccess,
  onCancel,
}: FamilyMemberFormProps) {
  const t = useT();

  type UpdateInput = z.infer<typeof familyMemberUpdateSchema>;

  const action = React.useMemo(() => {
    if (mode === "edit" && memberId) {
      return (input: UpdateInput): Promise<ActionResult<unknown>> =>
        updateFamilyMemberAction(memberId, input);
    }
    if (mode === "create" && familyId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (input: any): Promise<ActionResult<unknown>> =>
        addFamilyMemberAction(familyId, input);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (_input: any): Promise<ActionResult<unknown>> =>
      Promise.resolve({ ok: false as const, formError: "misconfigured" });
  }, [mode, familyId, memberId]);

  const schema = mode === "edit"
    ? (familyMemberUpdateSchema as z.ZodType<UpdateInput>)
    : familyMemberCreateSchema;

  const { form, submit, isPending, formError } = useServerActionForm(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schema as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    action as any,
    {
      defaultValues: {
        role: "MEMBER",
        ...initialValues,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      onSuccess: () => {
        onSuccess?.();
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
      : formError
      ? t("forms.common.form_error.internal")
      : null;

  const roleOptions = [
    { value: "OWNER", label: t("forms.family_member.role.OWNER") },
    { value: "MEMBER", label: t("forms.family_member.role.MEMBER") },
  ];

  return (
    <form onSubmit={submit} className="form-grid">
      <h2 className="form-title" style={{ fontSize: 14 }}>
        {mode === "create"
          ? t("forms.family_member.title_create")
          : t("forms.family_member.title_edit")}
      </h2>

      {/* Display name */}
      <TextField
        register={register("displayName")}
        label={t("forms.family_member.field.display_name")}
        error={errMsg(errors.displayName)}
        placeholder={t("forms.family_member.placeholder.display_name")}
        required={mode === "create"}
      />

      {/* Letter */}
      <TextField
        register={register("letter")}
        label={t("forms.family_member.field.letter")}
        error={errMsg(errors.letter)}
        placeholder={t("forms.family_member.placeholder.letter")}
      />

      {/* Color */}
      <SelectField
        register={register("color")}
        label={t("forms.family_member.field.color")}
        options={COLOR_OPTIONS}
        error={errMsg(errors.color)}
        placeholder={t("forms.family_member.placeholder.color")}
      />

      {/* Role */}
      <SelectField
        register={register("role")}
        label={t("forms.family_member.field.role")}
        options={roleOptions}
        error={errMsg(errors.role)}
      />

      <SubmitRow
        isSubmitting={isPending}
        submitLabel={t("forms.common.save")}
        cancelLabel={t("forms.common.cancel")}
        onCancel={onCancel}
        formError={translatedErrorKey}
      />
    </form>
  );
}
