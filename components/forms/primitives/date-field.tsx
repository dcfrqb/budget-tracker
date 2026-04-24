"use client";

import React from "react";
import { UseFormRegisterReturn } from "react-hook-form";
import { Field } from "./field";

interface DateFieldProps {
  register: UseFormRegisterReturn;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  min?: string;
  max?: string;
}

export function DateField({
  register,
  label,
  error,
  hint,
  required,
  min,
  max,
}: DateFieldProps) {
  return (
    <Field label={label} name={register.name} error={error} hint={hint} required={required}>
      <input
        {...register}
        id={register.name}
        type="date"
        min={min}
        max={max}
        aria-invalid={!!error}
      />
    </Field>
  );
}
