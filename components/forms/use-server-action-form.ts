"use client";

import { useState, useTransition } from "react";
import { useForm, DefaultValues, FieldValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ActionResult } from "@/lib/actions/result";

// ─────────────────────────────────────────────────────────────
// useServerActionForm — bridges RHF + Zod + server actions
// TValues must be a FieldValues-compatible object (required by react-hook-form).
// ─────────────────────────────────────────────────────────────

export function useServerActionForm<
  TValues extends FieldValues,
  TResult,
>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: z.ZodType<TValues, any, any>,
  action: (input: TValues) => Promise<ActionResult<TResult>>,
  options?: {
    onSuccess?: (result: TResult) => void;
    defaultValues?: DefaultValues<TValues>;
  },
) {
  const form = useForm<TValues>({
    resolver: zodResolver(schema),
    defaultValues: options?.defaultValues,
  });

  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  function handleAction(input: TValues) {
    setFormError(null);
    startTransition(async () => {
      const result = await action(input);
      if (!result.ok) {
        if (result.fieldErrors) {
          for (const [field, messages] of Object.entries(result.fieldErrors)) {
            form.setError(field as Parameters<typeof form.setError>[0], {
              message: messages[0],
            });
          }
        }
        if (result.formError) {
          setFormError(result.formError);
        }
        return;
      }
      options?.onSuccess?.(result.data);
    });
  }

  return {
    form,
    submit: form.handleSubmit(handleAction),
    isPending,
    formError,
  };
}
