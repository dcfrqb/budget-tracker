"use client";

import { useState, useTransition } from "react";
import { formatMoney } from "@/lib/format/money";
import { Prisma } from "@prisma/client";
import { useT } from "@/lib/i18n";
import { setAllocationsAction } from "@/app/(shell)/planning/trips/_actions";

export type RollupKind = "TRANSPORT" | "LODGING" | "FOOD" | "ACTIVITY" | "OTHER";

export type RollupRow = {
  kind: RollupKind;
  allocation: string;
  spent: string;
  remaining: string;
  currencyCode: string;
};

type Props = {
  tripId: string;
  rows: RollupRow[];
  labels: {
    title: string;
    kind: Record<string, string>;
    col_allocation: string;
    col_spent: string;
    col_remaining: string;
    edit_allocation: string;
    save_allocation: string;
    mixed_ccy_tooltip: string;
  };
};

export function TripCategoryRollup({ tripId, rows, labels }: Props) {
  const [editingKind, setEditingKind] = useState<RollupKind | null>(null);
  const [editValue, setEditValue] = useState("");
  const [localRows, setLocalRows] = useState(rows);
  const [isPending, startTransition] = useTransition();

  function handleEdit(kind: RollupKind, currentAlloc: string) {
    setEditingKind(kind);
    setEditValue(currentAlloc);
  }

  function handleSave(kind: RollupKind) {
    const newAlloc = editValue.trim() || "0";
    const updated = localRows.map((r) =>
      r.kind === kind ? { ...r, allocation: newAlloc } : r,
    );
    setLocalRows(updated);
    setEditingKind(null);

    const allocations: Record<string, string> = {};
    for (const r of updated) allocations[r.kind] = r.allocation;

    startTransition(async () => {
      await setAllocationsAction(tripId, { allocations });
    });
  }

  return (
    <div className="section trip-rollup fade-in">
      <div className="section-hd">
        <span className="ttl mono dim">{labels.title}</span>
      </div>
      <table className="trip-rollup-table">
        <thead>
          <tr>
            <th className="dim mono">{""}</th>
            <th className="dim mono right">{labels.col_allocation}</th>
            <th className="dim mono right">{labels.col_spent}</th>
            <th className="dim mono right">{labels.col_remaining}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {localRows.map((row) => {
            const allocation = new Prisma.Decimal(row.allocation || "0");
            const spent = new Prisma.Decimal(row.spent || "0");
            const remaining = new Prisma.Decimal(row.remaining || "0");
            const pct = allocation.isZero()
              ? 0
              : Math.min(100, spent.div(allocation).times(100).toNumber());

            return (
              <tr key={row.kind} className="trip-rollup-row">
                <td className="trip-rollup-kind dim mono">
                  {labels.kind[row.kind.toLowerCase()] ?? row.kind}
                </td>
                <td className="right mono">
                  {editingKind === row.kind ? (
                    <input
                      className="trip-rollup-input mono"
                      type="number"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSave(row.kind);
                        if (e.key === "Escape") setEditingKind(null);
                      }}
                      autoFocus
                    />
                  ) : (
                    formatMoney(allocation, row.currencyCode, { decimals: 0 })
                  )}
                </td>
                <td className="right mono acc">
                  {formatMoney(spent, row.currencyCode, { decimals: 0 })}
                </td>
                <td className={`right mono ${remaining.lte(0) ? "neg" : ""}`}>
                  {formatMoney(remaining, row.currencyCode, { decimals: 0 })}
                </td>
                <td className="trip-rollup-actions">
                  {editingKind === row.kind ? (
                    <button
                      className="btn-link dim"
                      onClick={() => handleSave(row.kind)}
                      disabled={isPending}
                    >
                      {labels.save_allocation}
                    </button>
                  ) : (
                    <button
                      className="btn-link dim"
                      onClick={() => handleEdit(row.kind, row.allocation)}
                    >
                      {labels.edit_allocation}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
