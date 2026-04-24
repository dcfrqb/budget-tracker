"use client";

import React from "react";
import { UseFormRegisterReturn } from "react-hook-form";
import { Field } from "./field";

interface TextFieldProps {
  register: UseFormRegisterReturn;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
}

export function TextField({
  register,
  label,
  error,
  hint,
  required,
  placeholder,
  autoComplete,
}: TextFieldProps) {
  return (
    <Field label={label} name={register.name} error={error} hint={hint} required={required}>
      <input
        {...register}
        id={register.name}
        type="text"
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={!!error}
      />
    </Field>
  );
}
