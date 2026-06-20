"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

type SelectionContextValue = {
  selected: Set<string>;
  toggle: (id: string) => void;
  clear: () => void;
};

const SelectionContext = createContext<SelectionContextValue | null>(null);

export function useSubscriptionSelection() {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("useSubscriptionSelection must be used inside SubscriptionSelectionProvider");
  return ctx;
}

export function SubscriptionSelectionProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setSelected(new Set());
  }, []);

  return (
    <SelectionContext.Provider value={{ selected, toggle, clear }}>
      {children}
    </SelectionContext.Provider>
  );
}
