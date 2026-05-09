"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useT } from "@/lib/i18n/context";

type FilterKey = "all" | "done" | "planned" | "partial";

interface Props {
  active: string | undefined;
  basePath: string;
}

export function TransactionStatusFilter({ active, basePath }: Props) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  void basePath;

  const filters: FilterKey[] = ["all", "done", "planned", "partial"];

  function handleClick(filter: FilterKey) {
    const params = new URLSearchParams(searchParams.toString());
    if (filter === "all") {
      params.delete("status");
    } else {
      params.set("status", filter);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  const activeFilter: FilterKey = (["done", "planned", "partial"].includes(active ?? "") ? active : "all") as FilterKey;

  return (
    <div
      style={{
        padding: "var(--sp-2) var(--sp-3)",
        display: "flex",
        gap: "var(--sp-2)",
        flexWrap: "wrap",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {filters.map((f) => (
        <button
          key={f}
          className={`btn mono${activeFilter === f ? " primary" : ""}`}
          style={{ fontSize: "var(--text-xs)", padding: "2px 8px" }}
          onClick={() => handleClick(f)}
        >
          {t(`income.work.detail.txns.filter.${f}` as Parameters<typeof t>[0])}
        </button>
      ))}
    </div>
  );
}
