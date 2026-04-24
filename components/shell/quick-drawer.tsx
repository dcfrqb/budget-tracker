"use client";

import React, { useEffect, useCallback, useRef } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import { TransactionForm } from "@/components/forms/transaction-form";
import { TransferForm } from "@/components/forms/transfer-form";
import { TransactionKind } from "@prisma/client";
import type { AccountOption } from "@/components/forms/account-select";
import type { CategoryOption } from "@/components/forms/category-select";
import type { CurrencyOption } from "@/components/forms/currency-select";

// Allowed quick-drawer slots
const QUICK_SLOTS = ["income", "expense", "transfer", "transaction"] as const;
type QuickSlot = (typeof QUICK_SLOTS)[number];

function isQuickSlot(v: string | null): v is QuickSlot {
  return QUICK_SLOTS.includes(v as QuickSlot);
}

// ─────────────────────────────────────────────────────────────
// Props — data loaded by QuickDrawerLoader (server component)
// ─────────────────────────────────────────────────────────────

export interface QuickDrawerData {
  accounts: AccountOption[];
  categories: CategoryOption[];
  currencies: CurrencyOption[];
}

interface QuickDrawerProps extends QuickDrawerData {}

export function QuickDrawer({ accounts, categories, currencies }: QuickDrawerProps) {
  const t = useT();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const drawerRef = useRef<HTMLDivElement>(null);

  const raw = searchParams.get("quick");
  const slot: QuickSlot | null = isQuickSlot(raw) ? raw : null;
  const isOpen = slot !== null;

  const close = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("quick");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [searchParams, pathname, router]);

  // ESC key closes
  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, close]);

  // Focus trap: focus first focusable element when opened
  useEffect(() => {
    if (!isOpen || !drawerRef.current) return;
    const el = drawerRef.current.querySelector<HTMLElement>(
      "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
    );
    el?.focus();
  }, [isOpen, slot]);

  // Inert the rest of the page when drawer is open
  useEffect(() => {
    const shell = document.querySelector<HTMLElement>(".shell");
    if (!shell) return;
    if (isOpen) {
      shell.setAttribute("inert", "");
    } else {
      shell.removeAttribute("inert");
    }
    return () => shell.removeAttribute("inert");
  }, [isOpen]);

  // Determine the kind for transaction forms
  let defaultKind: TransactionKind | undefined;
  if (slot === "income") defaultKind = TransactionKind.INCOME;
  else if (slot === "expense") defaultKind = TransactionKind.EXPENSE;

  return (
    <div className="drawer-host" data-open={isOpen ? "true" : "false"} aria-hidden={!isOpen}>
      {/* Backdrop */}
      <div
        className="drawer-backdrop"
        onClick={close}
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label={slot ?? ""}
        aria-hidden={!isOpen}
      >
        {/* Header */}
        <div className="drawer-header">
          <button
            className="drawer-close"
            onClick={close}
            aria-label={t("drawer.close")}
            type="button"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M12 4L4 12M4 4l8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        {isOpen && (
          <div className="drawer-content">
            {slot === "transfer" ? (
              <TransferForm
                variant="drawer"
                accounts={accounts}
                onSuccess={close}
              />
            ) : (slot === "income" || slot === "expense" || slot === "transaction") ? (
              <TransactionForm
                variant="drawer"
                mode="create"
                accounts={accounts}
                categories={categories}
                currencies={currencies}
                defaultKind={defaultKind}
                onSuccess={close}
              />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
