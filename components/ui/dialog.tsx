"use client";

import React, { useEffect, useRef, useCallback } from "react";
import { useT } from "@/lib/i18n";

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md";
}

export function Dialog({
  open,
  onOpenChange,
  title,
  children,
  footer,
  size = "md",
}: DialogProps) {
  const t = useT();
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFocusRef = useRef<HTMLElement | null>(null);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  // ESC closes dialog
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  // Focus first focusable element on open
  useEffect(() => {
    if (!open || !dialogRef.current) return;
    const el = dialogRef.current.querySelector<HTMLElement>(
      "button:not(.dialog-close), [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
    );
    if (el) {
      firstFocusRef.current = el;
      el.focus();
    }
  }, [open]);

  // Focus trap — keep tab focus inside dialog
  useEffect(() => {
    if (!open || !dialogRef.current) return;
    const dialog = dialogRef.current;

    function getFocusable(): HTMLElement[] {
      return Array.from(
        dialog.querySelectorAll<HTMLElement>(
          "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
        ),
      ).filter((el) => !el.hasAttribute("disabled"));
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const focusable = getFocusable();
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    dialog.addEventListener("keydown", onKeyDown);
    return () => dialog.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`dialog-backdrop${open ? " open" : ""}`}
        onClick={close}
        aria-hidden="true"
      />

      {/* Dialog wrap (for centering) */}
      {/* inert keeps closed dialog out of tab order and event flow without breaking the CSS close animation */}
      <div className="dialog-wrap" aria-hidden={!open} inert={!open || undefined}>
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          aria-hidden={!open}
          className={`dialog ${size}${open ? " open" : ""}`}
          tabIndex={-1}
        >
          <div className="dialog-header">
            <span className="dialog-title">{title}</span>
            <button
              type="button"
              className="dialog-close"
              onClick={close}
              aria-label={t("common.close")}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M11 3L3 11M3 3l8 8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          <div className="dialog-body">{children}</div>

          {footer && <div className="dialog-footer">{footer}</div>}
        </div>
      </div>
    </>
  );
}
