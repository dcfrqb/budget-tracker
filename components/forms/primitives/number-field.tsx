"use client";

import React from "react";
import { UseFormRegisterReturn } from "react-hook-form";
import { Field } from "./field";

interface NumberFieldProps {
  register: UseFormRegisterReturn;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  placeholder?: string;
  step?: number | string;
  min?: number | string;
  max?: number | string;
}

export function NumberField({
  register,
  label,
  error,
  hint,
  required,
  placeholder,
  step,
  min,
  max,
}: NumberFieldProps) {
  return (
    <Field label={label} name={register.name} error={error} hint={hint} required={required}>
      <input
        {...register}
        id={register.name}
        type="number"
        inputMode="decimal"
        placeholder={placeholder}
        step={step}
        min={min}
        max={max}
        aria-invalid={!!error}
      />
    </Field>
  );
}
