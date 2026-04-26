import type { DashboardStatus } from "@/lib/data/dashboard";
import type { TOptions } from "@/lib/i18n/types";
import type { TKey } from "@/lib/i18n/t";

type TFn = (key: TKey, options?: TOptions) => string;

export function getStatusLabel(status: DashboardStatus, t: TFn): string {
  switch (status) {
    case "stable":  return t("shell.status.stable");
    case "warning": return t("shell.status.warning");
    case "crisis":  return t("shell.status.crisis");
  }
}
