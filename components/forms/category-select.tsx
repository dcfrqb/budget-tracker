"use client";

import React from "react";
import { UseFormRegisterReturn } from "react-hook-form";
import { SelectField } from "./primitives/select-field";

export interface CategoryOption {
  id: string;
  name: string;
  kind: string;
}

interface CategorySelectProps {
  register: UseFormRegisterReturn;
  categories: CategoryOption[];
  label?: string;
  error?: string;
  required?: boolean;
  placeholder?: string;
  /** Filter categories by kind */
  kind?: string;
}

export function CategorySelect({
  register,
  categories,
  label = "Category",
  error,
  required,
  placeholder,
  kind,
}: CategorySelectProps) {
  const filtered = kind ? categories.filter((c) => c.kind === kind) : categories;
  const options = filtered.map((c) => ({ value: c.id, label: c.name }));

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
