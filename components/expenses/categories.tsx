"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n";

export type ExpenseCategoryView = {
  id: string;
  name: string;
  sub: string;
  amount: string;
  amountTone?: "info";
  pct: number;
  barColor: string;
  usageLabel: string;
  total: string;
};

export function ExpenseCategories({ categories }: { categories: ExpenseCategoryView[] }) {
  const t = useT();

  return (
    <div className="section fade-in" style={{ animationDelay: "300ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>{t("expenses.category.section_title")}</b>{" "}
          <span className="dim">· {t("expenses.category.section_meta")}</span>
        </div>
        <div className="meta mono">{t("expenses.category.section_sort")}</div>
      </div>
      <div className="section-body flush">
        <div className="cat-grid">
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/transactions?categoryId=${encodeURIComponent(c.id)}`}
              className="cat-card"
            >
              <div className="cat-top">
                <div>
                  <div className="cat-name">{c.name}</div>
                  <div className="cat-sub">{c.sub}</div>
                </div>
                <div className={`cat-amt ${c.amountTone ?? ""}`}>{c.amount}</div>
              </div>
              <div className="cat-bar">
                <div className="fill" style={{ width: `${c.pct}%`, background: c.barColor }} />
              </div>
              <div className="cat-foot">
                <span>{c.usageLabel}</span>
                <span>{c.total}</span>
              </div>
            </Link>
          ))}
          {categories.length === 0 && (
            <div
              className="mono"
              style={{ fontSize: 12, color: "var(--muted)", padding: "12px 20px" }}
            >
              {t("expenses.category.empty")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
