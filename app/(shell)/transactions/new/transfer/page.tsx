import { getCurrentUserId } from "@/lib/api/auth";
import { db } from "@/lib/db";
import { TransferForm } from "@/components/forms/transfer-form";

export const dynamic = "force-dynamic";

export default async function NewTransferPage() {
  const userId = await getCurrentUserId();

  const accounts = await db.account.findMany({
    where: { userId, deletedAt: null, isArchived: false },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, currencyCode: true },
  });

  return (
    <div className="page-content">
      <TransferForm
        variant="page"
        accounts={accounts}
      />
    </div>
  );
}
