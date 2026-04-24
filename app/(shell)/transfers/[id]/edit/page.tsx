import { notFound } from "next/navigation";
import { getCurrentUserId } from "@/lib/api/auth";
import { db } from "@/lib/db";
import { TransferForm } from "@/components/forms/transfer-form";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditTransferPage({ params }: Props) {
  const userId = await getCurrentUserId();
  const { id } = await params;

  const [transfer, accounts, currencies] = await Promise.all([
    db.transfer.findFirst({
      where: { id, userId },
      select: {
        id: true,
        fromAccountId: true,
        toAccountId: true,
        fromAmount: true,
        toAmount: true,
        fromCcy: true,
        toCcy: true,
        rate: true,
        fee: true,
        occurredAt: true,
        note: true,
      },
    }),
    db.account.findMany({
      where: { userId, deletedAt: null, isArchived: false },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, currencyCode: true },
    }),
    db.currency.findMany({ orderBy: { code: "asc" } }),
  ]);

  if (!transfer) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const initialValues: Record<string, any> = {
    fromAccountId: transfer.fromAccountId,
    toAccountId: transfer.toAccountId,
    fromAmount: transfer.fromAmount.toString(),
    toAmount: transfer.toAmount.toString(),
    rate: transfer.rate?.toString(),
    fee: transfer.fee?.toString(),
    occurredAt: transfer.occurredAt.toISOString().slice(0, 10),
    note: transfer.note ?? undefined,
  };

  return (
    <div className="page-content">
      <TransferForm
        variant="page"
        mode="edit"
        transferId={id}
        accounts={accounts.map((a) => ({
          id: a.id,
          name: a.name,
          currencyCode: a.currencyCode,
        }))}
        initialValues={initialValues}
      />
    </div>
  );
}
