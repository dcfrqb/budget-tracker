"use client";

import React from "react";
import { UseFormRegisterReturn } from "react-hook-form";
import { SelectField } from "./primitives/select-field";

export interface CurrencyOption {
  code: string;
  symbol: string;
}

interface CurrencySelectProps {
  register: UseFormRegisterReturn;
  currencies: CurrencyOption[];
  label?: string;
  error?: string;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
}

export function CurrencySelect({
  register,
  currencies,
  label = "Currency",
  error,
  required,
  placeholder,
  disabled,
}: CurrencySelectProps) {
  const options = currencies.map((c) => ({
    value: c.code,
    label: `${c.code} ${c.symbol}`,
  }));

  return (
    <SelectField
      register={register}
      label={label}
      options={options}
      error={error}
      required={required}
      placeholder={placeholder}
      disabled={disabled}
    />
  );
}
