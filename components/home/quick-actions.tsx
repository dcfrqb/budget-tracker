"use client";

import { useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useT } from "@/lib/i18n";
import type { TKey } from "@/lib/i18n";
import { QuickInput, type CategoryOption } from "@/components/transactions/quick-input";

type Action = {
  id: "inc" | "exp" | "txn";
  labelKey: TKey;
  ariaKey: TKey;
  key: string;
  quick: string;
  svg: React.ReactNode;
};

const ACTIONS: Action[] = [
  {
    id: "inc",
    labelKey: "home.quick.income.label",
    ariaKey: "home.quick.income.aria",
    key: "I",
    quick: "income",
    svg: (
      <svg
        width="15"
        height="15"
        viewBox="0 0 15 15"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M7.5 10V2m0 8-3-3m3 3 3-3" />
        <path d="M2 13h11" />
      </svg>
    ),
  },
  {
    id: "exp",
    labelKey: "home.quick.expense.label",
    ariaKey: "home.quick.expense.aria",
    key: "E",
    quick: "expense",
    svg: (
      <svg
        width="15"
        height="15"
        viewBox="0 0 15 15"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M7.5 5v8m0-8 3 3m-3-3-3 3" />
        <path d="M2 2h11" />
      </svg>
    ),
  },
  {
    id: "txn",
    labelKey: "home.quick.transfer.label",
    ariaKey: "home.quick.transfer.aria",
    key: "T",
    quick: "transfer",
    svg: (
      <svg
        width="15"
        height="15"
        viewBox="0 0 15 15"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M5 3 2 6l3 3" />
        <path d="M2 6h11" />
        <path d="M10 12l3-3-3-3" />
        <path d="M13 9H2" />
      </svg>
    ),
  },
];

export interface QuickActionsProps {
  defaultAccountId?: string;
  defaultCurrency?: string;
  categories?: CategoryOption[];
  accountName?: string;
}

export function QuickActions({
  defaultAccountId,
  defaultCurrency,
  categories,
  accountName,
}: QuickActionsProps) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();

  const openDrawer = useCallback(
    (quick: string) => {
      router.push(`${pathname}?quick=${quick}`);
    },
    [router, pathname],
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      )
        return;
      const k = e.key.toUpperCase();
      const match = ACTIONS.find((a) => a.key === k);
      if (!match) return;
      e.preventDefault();
      openDrawer(match.quick);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openDrawer]);

  return (
    <div className="section fade-in" style={{ animationDelay: "60ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>{t("home.quick.title")}</b>
        </div>
        <div className="meta mono">{t("home.quick.shortcut_hint")}</div>
      </div>
      <div className="section-body flush">
        {/* Quick one-liner input */}
        <QuickInput
          variant="home"
          defaultAccountId={defaultAccountId}
          defaultCurrency={defaultCurrency}
          categories={categories}
          accountName={accountName}
        />
        <div className="qa-row">
          {ACTIONS.map((a) => (
            <button
              key={a.id}
              type="button"
              className="qa-btn"
              data-qa={a.id}
              aria-label={t(a.ariaKey)}
              onClick={() => openDrawer(a.quick)}
            >
              <span className="qa-inner">
                {a.svg}
                <span>{t(a.labelKey)}</span>
              </span>
              <span className="k">{a.key}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
