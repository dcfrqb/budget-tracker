"use client";

import React from "react";
import { useSelection } from "./selection-context";
import { useT } from "@/lib/i18n";
import type { TxnView } from "@/lib/view/transactions";

type Props = {
  id: string;
  row: TxnView;
  children: React.ReactNode;
};

export function SelectableRow({ id, row, children }: Props) {
  const t = useT();
  const { selected, toggle } = useSelection();
  const isSelected = selected.has(id);

  function handleCheckboxChange() {
    toggle(id, row);
  }

  function handleRowClick(e: React.MouseEvent) {
    if ((e.metaKey || e.ctrlKey) && !(e.target as HTMLElement).closest("input")) {
      e.preventDefault();
      toggle(id, row);
    }
  }

  return (
    <div
      className="selectable-row"
      data-selected={isSelected ? "true" : "false"}
      onClick={handleRowClick}
    >
      <label className="sel-checkbox" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={handleCheckboxChange}
          aria-label={t("transactions.selection.aria_select_row")}
        />
      </label>
      {children}
    </div>
  );
}
