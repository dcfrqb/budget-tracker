"use client";

import React from "react";
import { UseFormRegisterReturn } from "react-hook-form";
import { SelectField } from "./primitives/select-field";

export interface WorkSourceOption {
  id: string;
  name: string;
}

interface WorkSourceSelectProps {
  register: UseFormRegisterReturn;
  workSources: WorkSourceOption[];
  label?: string;
  error?: string;
  required?: boolean;
  placeholder?: string;
}

export function WorkSourceSelect({
  register,
  workSources,
  label = "Work Source",
  error,
  required,
  placeholder,
}: WorkSourceSelectProps) {
  const options = workSources.map((w) => ({ value: w.id, label: w.name }));

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
