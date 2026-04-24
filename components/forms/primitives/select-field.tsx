"use client";

import React from "react";
import { UseFormRegisterReturn } from "react-hook-form";
import { Field } from "./field";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectFieldProps {
  register: UseFormRegisterReturn;
  label: string;
  options: SelectOption[];
  error?: string;
  hint?: string;
  required?: boolean;
  placeholder?: string;
}

export function SelectField({
  register,
  label,
  options,
  error,
  hint,
  required,
  placeholder,
}: SelectFieldProps) {
  return (
    <Field label={label} name={register.name} error={error} hint={hint} required={required}>
      <select
        {...register}
        id={register.name}
        aria-invalid={!!error}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
