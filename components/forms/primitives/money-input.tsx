"use client";

import React from "react";
import { UseFormRegisterReturn } from "react-hook-form";
import { Field } from "./field";

interface MoneyInputProps {
  register: UseFormRegisterReturn;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  currencyCode?: string;
  placeholder?: string;
  inputClassName?: string;
}

export function MoneyInput({
  register,
  label,
  error,
  hint,
  required,
  currencyCode,
  placeholder = "0.00",
  inputClassName,
}: MoneyInputProps) {
  return (
    <Field label={label} name={register.name} error={error} hint={hint} required={required}>
      <div className="money-input-wrap">
        <input
          {...register}
          id={register.name}
          type="text"
          inputMode="decimal"
          className={inputClassName ? `money-input ${inputClassName}` : "money-input"}
          placeholder={placeholder}
          aria-invalid={!!error}
          // Trim whitespace on blur
          onBlur={(e) => {
            e.target.value = e.target.value.trim();
            register.onBlur(e);
          }}
        />
        {currencyCode && (
          <span className="money-input-currency" aria-label={currencyCode}>
            {currencyCode}
          </span>
        )}
      </div>
    </Field>
  );
}
