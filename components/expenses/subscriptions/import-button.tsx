import Link from "next/link";
import { getT } from "@/lib/i18n/server";

export async function SubscriptionImportButton() {
  const t = await getT();
  return (
    <Link href="/expenses/subscriptions/json" className="btn btn-xs">
      {t("expenses.subscriptions.json.button")}
    </Link>
  );
}
