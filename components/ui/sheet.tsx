"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/lib/i18n";

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
  title?: string;
  children: React.ReactNode;
}

export function Sheet({ open, onClose, ariaLabel, title, children }: SheetProps) {
  const t = useT();
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // ESC key closes
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  // Focus first focusable element when opened
  useEffect(() => {
    if (!open || !panelRef.current) return;
    const el = panelRef.current.querySelector<HTMLElement>(
      "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
    );
    el?.focus();
  }, [open]);

  // Focus trap — keep tab focus inside panel
  useEffect(() => {
    if (!open || !panelRef.current) return;
    const panel = panelRef.current;

    function getFocusable(): HTMLElement[] {
      return Array.from(
        panel.querySelectorAll<HTMLElement>(
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

    panel.addEventListener("keydown", onKeyDown);
    return () => panel.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Inert the .shell when the sheet is open
  useEffect(() => {
    const shell = document.querySelector<HTMLElement>(".shell");
    if (!shell) return;
    if (open) {
      shell.setAttribute("inert", "");
    } else {
      shell.removeAttribute("inert");
    }
    return () => shell.removeAttribute("inert");
  }, [open]);

  if (!mounted) return null;

  return createPortal(
    <div className="drawer-host" data-open={open ? "true" : "false"} aria-hidden={!open}>
      {/* Backdrop */}
      <div
        className="drawer-backdrop"
        onClick={onClose}
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-hidden={!open}
      >
        {/* Header */}
        <div className="drawer-header">
          {title && <span className="drawer-title">{title}</span>}
          <button
            className="drawer-close"
            onClick={onClose}
            aria-label={t("drawer.close")}
            type="button"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
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
        {open && (
          <div className="drawer-content">
            {children}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
