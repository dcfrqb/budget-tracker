"use client";

import React, { useCallback } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import { Sheet } from "@/components/ui/sheet";
import { LongProjectForm } from "@/components/forms/long-project-form";
import type { CurrencyOption } from "@/components/forms/currency-select";
import type { CategoryOption } from "@/components/forms/category-select";

export interface LongProjectSheetHostProps {
  currencies: CurrencyOption[];
  categories: CategoryOption[];
  tz?: string;
  // edit mode (populated when ?edit=project:<id>)
  projectId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialValues?: Record<string, any>;
}

export function LongProjectSheetHost({
  currencies,
  categories,
  tz,
  projectId,
  initialValues,
}: LongProjectSheetHostProps) {
  const t = useT();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const newParam = searchParams.get("new");
  const editParam = searchParams.get("edit");

  const isCreateOpen = newParam === "project";
  const isEditOpen = projectId != null && editParam === `project:${projectId}`;
  const isOpen = isCreateOpen || isEditOpen;

  const mode = isEditOpen ? "edit" : "create";

  const close = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (isCreateOpen) params.delete("new");
    if (isEditOpen) params.delete("edit");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [searchParams, pathname, router, isCreateOpen, isEditOpen]);

  const title = mode === "edit"
    ? t("forms.long_project.title_edit")
    : t("forms.long_project.title_create");

  return (
    <Sheet open={isOpen} onClose={close} ariaLabel={title} title={title}>
      <LongProjectForm
        variant="inline"
        mode={mode}
        currencies={currencies}
        categories={categories}
        tz={tz}
        projectId={isEditOpen ? projectId : undefined}
        initialValues={isEditOpen ? initialValues : undefined}
        onSuccess={close}
      />
    </Sheet>
  );
}
