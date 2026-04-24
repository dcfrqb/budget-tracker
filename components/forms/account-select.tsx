"use client";

import React from "react";
import { UseFormRegisterReturn } from "react-hook-form";
import { SelectField } from "./primitives/select-field";

export interface AccountOption {
  id: string;
  name: string;
  currencyCode: string;
}

interface AccountSelectProps {
  register: UseFormRegisterReturn;
  accounts: AccountOption[];
  label?: string;
  error?: string;
  required?: boolean;
  placeholder?: string;
}

export function AccountSelect({
  register,
  accounts,
  label = "Account",
  error,
  required,
  placeholder,
}: AccountSelectProps) {
  const options = accounts.map((a) => ({
    value: a.id,
    label: `${a.name} (${a.currencyCode})`,
  }));

  return (
    <SelectField
      register={register}
      label={label}
      options={options}
      error={error}
      required={required}
      placeholder={placeholder}
    />
  );
}
