"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type ToastTone = "ok" | "warn" | "err";

export type ToastItem = {
  id: string;
  tone: ToastTone;
  title: string;
  body?: string;
  durationMs?: number;
};

type ToastContextValue = {
  push: (t: Omit<ToastItem, "id">) => void;
};

// ─────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

// ─────────────────────────────────────────────────────────────
// Single toast item
// ─────────────────────────────────────────────────────────────

function Toast({
  item,
  onRemove,
}: {
  item: ToastItem;
  onRemove: (id: string) => void;
}) {
  const [leaving, setLeaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    setLeaving(true);
    timerRef.current = setTimeout(() => onRemove(item.id), 200);
  }, [item.id, onRemove]);

  useEffect(() => {
    const duration = item.durationMs ?? 5000;
    timerRef.current = setTimeout(dismiss, duration);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [dismiss, item.durationMs]);

  return (
    <div
      className="toast"
      data-tone={item.tone}
      data-leaving={leaving ? "true" : undefined}
      onClick={dismiss}
      role="status"
      aria-live="polite"
    >
      <span className="toast-accent" aria-hidden />
      <div className="toast-body">
        <span className="toast-title">{item.title}</span>
        {item.body && <span className="toast-sub">{item.body}</span>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const push = useCallback((t: Omit<ToastItem, "id">) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((prev) => [...prev, { ...t, id }]);
  }, []);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      {mounted &&
        createPortal(
          <div className="toast-container" aria-label="Notifications">
            {toasts.map((item) => (
              <Toast key={item.id} item={item} onRemove={remove} />
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}
