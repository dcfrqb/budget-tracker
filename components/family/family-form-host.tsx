"use client";

import React, { useCallback } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import { Dialog } from "@/components/ui/dialog";
import { FamilyForm } from "@/components/forms/family-form";

export interface FamilyFormHostProps {
  // For edit mode: pre-fetched from server
  familyId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialValues?: Record<string, any>;
}

export function FamilyFormHost({ familyId, initialValues }: FamilyFormHostProps) {
  const t = useT();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const newParam = searchParams.get("new");
  const editParam = searchParams.get("edit");

  const isCreate = newParam === "family";
  const isEdit = !!familyId && editParam === `family:${familyId}`;
  const isOpen = isCreate || isEdit;
  const mode = isCreate ? "create" : "edit";

  const close = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("new");
    params.delete("edit");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [searchParams, pathname, router]);

  const title = mode === "create"
    ? t("forms.family.title_create")
    : t("forms.family.title_edit");

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => { if (!open) close(); }}
      title={title}
      size="md"
    >
      <FamilyForm
        variant="inline"
        mode={mode}
        familyId={isEdit ? familyId : undefined}
        initialValues={isEdit ? initialValues : undefined}
        onSuccess={close}
      />
    </Dialog>
  );
}
