"use client";

import React from "react";
import { UseFormRegisterReturn } from "react-hook-form";
import { Field } from "./field";

interface TextareaFieldProps {
  register: UseFormRegisterReturn;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  placeholder?: string;
  rows?: number;
}

export function TextareaField({
  register,
  label,
  error,
  hint,
  required,
  placeholder,
  rows = 3,
}: TextareaFieldProps) {
  return (
    <Field label={label} name={register.name} error={error} hint={hint} required={required}>
      <textarea
        {...register}
        id={register.name}
        placeholder={placeholder}
        rows={rows}
        aria-invalid={!!error}
      />
    </Field>
  );
}
