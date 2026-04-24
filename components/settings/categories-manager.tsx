"use client";

import React, { useState, useTransition, useRef } from "react";
import { CategoryKind } from "@prisma/client";
import { useT } from "@/lib/i18n";
import {
  createCategoryAction,
  updateCategoryAction,
  archiveCategoryAction,
  unarchiveCategoryAction,
} from "@/app/(shell)/settings/categories/actions";
import { categoryCreateSchema } from "@/lib/validation/category";
import type { CategoryCreateInput } from "@/lib/validation/category";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface CategoryRow {
  id: string;
  name: string;
  kind: CategoryKind;
  icon: string | null;
  color: string | null;
  parentId: string | null;
  sortOrder: number;
  limitEconomy: string | null;
  limitNormal: string | null;
  limitFree: string | null;
  archivedAt: Date | null;
}

interface CategoriesManagerProps {
  categories: CategoryRow[];
}

type FilterKind = "all" | CategoryKind | "archived";

// ─────────────────────────────────────────────────────────────
// Inline add form state
// ─────────────────────────────────────────────────────────────

interface NewCategoryState {
  name: string;
  kind: CategoryKind;
  parentId: string;
  icon: string;
  color: string;
  limitEconomy: string;
  limitNormal: string;
  limitFree: string;
}

const EMPTY_NEW: NewCategoryState = {
  name: "",
  kind: CategoryKind.EXPENSE,
  parentId: "",
  icon: "",
  color: "",
  limitEconomy: "",
  limitNormal: "",
  limitFree: "",
};

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function CategoriesManager({ categories: initialCategories }: CategoriesManagerProps) {
  const t = useT();
  const [isPending, startTransition] = useTransition();

  const [categories, setCategories] = useState<CategoryRow[]>(initialCategories);
  const [filter, setFilter] = useState<FilterKind>("all");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCat, setNewCat] = useState<NewCategoryState>(EMPTY_NEW);
  const [addError, setAddError] = useState<string | null>(null);

  // Inline editing state: id → field → value
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);

  // ─── Filter ─────────────────────────────────────────────────

  const filtered = categories.filter((c) => {
    if (filter === "archived") return c.archivedAt !== null;
    if (filter === CategoryKind.INCOME) return c.kind === CategoryKind.INCOME && !c.archivedAt;
    if (filter === CategoryKind.EXPENSE) return c.kind === CategoryKind.EXPENSE && !c.archivedAt;
    return !c.archivedAt; // "all"
  });

  // ─── Inline edit handlers ────────────────────────────────────

  function startEdit(id: string, field: string) {
    setEditingCell({ id, field });
  }

  function commitEdit(id: string, field: string, value: string) {
    setEditingCell(null);
    if (!value.trim() && field === "name") return; // don't save empty name

    const updateData: Record<string, string | number | null> = {};
    if (field === "name") updateData.name = value.trim();
    else if (field === "limitEconomy") updateData.limitEconomy = value || null;
    else if (field === "limitNormal") updateData.limitNormal = value || null;
    else if (field === "limitFree") updateData.limitFree = value || null;

    if (Object.keys(updateData).length === 0) return;

    // Optimistic update
    setCategories((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        return { ...c, ...updateData } as CategoryRow;
      }),
    );

    startTransition(async () => {
      const result = await updateCategoryAction(id, updateData);
      if (!result.ok) {
        // Revert — reload from server would be ideal, but for now just warn
        console.error("[CategoriesManager] update failed:", result);
      }
    });
  }

  // ─── Archive ────────────────────────────────────────────────

  function handleArchive(id: string) {
    startTransition(async () => {
      const result = await archiveCategoryAction(id);
      if (result.ok) {
        setCategories((prev) =>
          prev.map((c) =>
            c.id === id ? { ...c, archivedAt: new Date() } : c,
          ),
        );
      }
    });
  }

  function handleUnarchive(id: string) {
    startTransition(async () => {
      const result = await unarchiveCategoryAction(id);
      if (result.ok) {
        setCategories((prev) =>
          prev.map((c) =>
            c.id === id ? { ...c, archivedAt: null } : c,
          ),
        );
      }
    });
  }

  // ─── Add new ────────────────────────────────────────────────

  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);

    const input: CategoryCreateInput = {
      name: newCat.name.trim(),
      kind: newCat.kind,
      parentId: newCat.parentId || undefined,
      icon: newCat.icon || undefined,
      color: newCat.color || undefined,
      limitEconomy: newCat.limitEconomy || undefined,
      limitNormal: newCat.limitNormal || undefined,
      limitFree: newCat.limitFree || undefined,
    };

    const parsed = categoryCreateSchema.safeParse(input);
    if (!parsed.success) {
      setAddError(parsed.error.issues[0]?.message ?? t("forms.common.required"));
      return;
    }

    startTransition(async () => {
      const result = await createCategoryAction(parsed.data);
      if (result.ok) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const created = result.data as any;
        const newRow: CategoryRow = {
          id: created.id,
          name: created.name,
          kind: created.kind,
          icon: created.icon ?? null,
          color: created.color ?? null,
          parentId: created.parentId ?? null,
          sortOrder: created.sortOrder,
          limitEconomy: created.limitEconomy?.toString() ?? null,
          limitNormal: created.limitNormal?.toString() ?? null,
          limitFree: created.limitFree?.toString() ?? null,
          archivedAt: null,
        };
        setCategories((prev) => [...prev, newRow]);
        setNewCat(EMPTY_NEW);
        setShowAddForm(false);
      } else {
        setAddError(
          result.formError === "unique_violation"
            ? t("forms.common.form_error.unique_violation")
            : t("forms.common.form_error.internal"),
        );
      }
    });
  }

  // ─── Render ─────────────────────────────────────────────────

  const filterButtons: Array<{ key: FilterKind; label: string }> = [
    { key: "all", label: t("forms.category.filter_all") },
    { key: CategoryKind.INCOME, label: t("forms.category.filter_income") },
    { key: CategoryKind.EXPENSE, label: t("forms.category.filter_expense") },
    { key: "archived", label: t("forms.category.filter_archived") },
  ];

  const parentOptions = categories
    .filter((c) => !c.archivedAt && !c.parentId)
    .map((c) => ({ value: c.id, label: c.name }));

  return (
    <div className="categories-manager">
      {/* Filter tabs */}
      <div className="segmented-control" role="tablist">
        {filterButtons.map((fb) => (
          <button
            key={fb.key}
            role="tab"
            type="button"
            aria-selected={filter === fb.key}
            className={`seg-btn${filter === fb.key ? " active" : ""}`}
            onClick={() => setFilter(fb.key)}
          >
            {fb.label}
          </button>
        ))}
      </div>

      {/* Category rows */}
      <div className="categories-list">
        {filtered.length === 0 && (
          <p className="categories-empty mut">{t("forms.category.empty")}</p>
        )}
        {filtered.map((cat) => (
          <CategoryListRow
            key={cat.id}
            cat={cat}
            editingCell={editingCell}
            onStartEdit={startEdit}
            onCommitEdit={commitEdit}
            onArchive={handleArchive}
            onUnarchive={handleUnarchive}
            isPending={isPending}
          />
        ))}
      </div>

      {/* Add new category */}
      {!showAddForm ? (
        <button
          type="button"
          className="btn-ghost categories-add-btn"
          onClick={() => setShowAddForm(true)}
        >
          {t("forms.category.add_button")}
        </button>
      ) : (
        <form onSubmit={handleAddSubmit} className="categories-add-form form-grid">
          <div className="form-row">
            <div className="field">
              <label className="form-label" htmlFor="new-cat-name">
                {t("forms.category.field.name")} *
              </label>
              <input
                id="new-cat-name"
                type="text"
                value={newCat.name}
                onChange={(e) => setNewCat((s) => ({ ...s, name: e.target.value }))}
                placeholder={t("forms.category.placeholder.name")}
                required
              />
            </div>
            <div className="field">
              <label className="form-label" htmlFor="new-cat-kind">
                {t("forms.category.field.kind")}
              </label>
              <select
                id="new-cat-kind"
                value={newCat.kind}
                onChange={(e) =>
                  setNewCat((s) => ({ ...s, kind: e.target.value as CategoryKind }))
                }
              >
                <option value={CategoryKind.INCOME}>{t("forms.category.kind.income")}</option>
                <option value={CategoryKind.EXPENSE}>{t("forms.category.kind.expense")}</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label className="form-label" htmlFor="new-cat-parent">
                {t("forms.category.field.parent")}
              </label>
              <select
                id="new-cat-parent"
                value={newCat.parentId}
                onChange={(e) => setNewCat((s) => ({ ...s, parentId: e.target.value }))}
              >
                <option value="">{t("forms.category.placeholder.parent")}</option>
                {parentOptions.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="form-label" htmlFor="new-cat-icon">
                {t("forms.category.field.icon")}
              </label>
              <input
                id="new-cat-icon"
                type="text"
                value={newCat.icon}
                onChange={(e) => setNewCat((s) => ({ ...s, icon: e.target.value }))}
                placeholder={t("forms.category.placeholder.icon")}
                maxLength={16}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label className="form-label" htmlFor="new-cat-eco">
                {t("forms.category.field.limit_economy")}
              </label>
              <input
                id="new-cat-eco"
                type="text"
                inputMode="decimal"
                value={newCat.limitEconomy}
                onChange={(e) => setNewCat((s) => ({ ...s, limitEconomy: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div className="field">
              <label className="form-label" htmlFor="new-cat-norm">
                {t("forms.category.field.limit_normal")}
              </label>
              <input
                id="new-cat-norm"
                type="text"
                inputMode="decimal"
                value={newCat.limitNormal}
                onChange={(e) => setNewCat((s) => ({ ...s, limitNormal: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div className="field">
              <label className="form-label" htmlFor="new-cat-free">
                {t("forms.category.field.limit_free")}
              </label>
              <input
                id="new-cat-free"
                type="text"
                inputMode="decimal"
                value={newCat.limitFree}
                onChange={(e) => setNewCat((s) => ({ ...s, limitFree: e.target.value }))}
                placeholder="0"
              />
            </div>
          </div>

          {addError && (
            <span className="field-error" role="alert">
              {addError}
            </span>
          )}

          <div className="submit-row">
            <div className="submit-row-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setShowAddForm(false);
                  setNewCat(EMPTY_NEW);
                  setAddError(null);
                }}
                disabled={isPending}
              >
                {t("forms.common.cancel")}
              </button>
              <button type="submit" className="btn-primary" disabled={isPending}>
                {isPending ? t("forms.common.loading") : t("forms.common.add")}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Row component
// ─────────────────────────────────────────────────────────────

interface RowProps {
  cat: CategoryRow;
  editingCell: { id: string; field: string } | null;
  onStartEdit: (id: string, field: string) => void;
  onCommitEdit: (id: string, field: string, value: string) => void;
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
  isPending: boolean;
}

function CategoryListRow({
  cat,
  editingCell,
  onStartEdit,
  onCommitEdit,
  onArchive,
  onUnarchive,
  isPending,
}: RowProps) {
  const t = useT();
  const isArchived = !!cat.archivedAt;

  function isEditing(field: string) {
    return editingCell?.id === cat.id && editingCell.field === field;
  }

  function EditableCell({
    field,
    value,
    placeholder,
  }: {
    field: string;
    value: string | null;
    placeholder?: string;
  }) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [localValue, setLocalValue] = useState(value ?? "");

    if (isEditing(field)) {
      return (
        <input
          ref={inputRef}
          autoFocus
          className="inline-edit-input"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={() => onCommitEdit(cat.id, field, localValue)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onCommitEdit(cat.id, field, localValue);
            }
            if (e.key === "Escape") {
              onCommitEdit(cat.id, field, value ?? "");
            }
          }}
          style={{ width: "100%" }}
        />
      );
    }

    return (
      <span
        className="editable-cell"
        onDoubleClick={() => !isArchived && onStartEdit(cat.id, field)}
        title={isArchived ? undefined : "Double-click to edit"}
      >
        {value ?? <span className="mut">{placeholder ?? "—"}</span>}
      </span>
    );
  }

  return (
    <div
      className={`category-row${isArchived ? " category-row--archived" : ""}`}
      data-kind={cat.kind}
    >
      {/* Icon */}
      <span className="category-row-icon">{cat.icon ?? "·"}</span>

      {/* Name */}
      <div className="category-row-name">
        <EditableCell field="name" value={cat.name} />
        {isArchived && (
          <span className="badge badge-muted">{t("forms.category.archived_badge")}</span>
        )}
      </div>

      {/* Kind badge */}
      <span className="category-row-kind mut">
        {cat.kind === CategoryKind.INCOME
          ? t("forms.category.kind.income")
          : t("forms.category.kind.expense")}
      </span>

      {/* Limit cells */}
      <div className="category-row-limits">
        <EditableCell
          field="limitEconomy"
          value={cat.limitEconomy}
          placeholder={t("forms.category.field.limit_economy")}
        />
        <EditableCell
          field="limitNormal"
          value={cat.limitNormal}
          placeholder={t("forms.category.field.limit_normal")}
        />
        <EditableCell
          field="limitFree"
          value={cat.limitFree}
          placeholder={t("forms.category.field.limit_free")}
        />
      </div>

      {/* Actions */}
      <div className="category-row-actions">
        {isArchived ? (
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={() => onUnarchive(cat.id)}
            disabled={isPending}
          >
            {t("forms.common.restore")}
          </button>
        ) : (
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={() => onArchive(cat.id)}
            disabled={isPending}
            aria-label={t("forms.common.archive")}
          >
            {t("forms.common.archive")}
          </button>
        )}
      </div>
    </div>
  );
}
