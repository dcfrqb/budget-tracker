export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getCurrentUserId } from "@/lib/api/auth";
import { getCurrentUserTz } from "@/lib/data/_users/get-user-tz";
import { dayKeyInTz } from "@/lib/format/date";
import { db } from "@/lib/db";
import { LongProjectForm } from "@/components/forms/long-project-form";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditLongProjectPage({ params }: Props) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const tz = await getCurrentUserTz();

  const [project, currencies, categories] = await Promise.all([
    db.longProject.findFirst({ where: { id, userId } }),
    db.currency.findMany({ orderBy: { code: "asc" } }),
    db.category.findMany({
      where: { userId, archivedAt: null, kind: "EXPENSE" },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!project) notFound();

  return (
    <div className="page-content">
      <LongProjectForm
        variant="page"
        mode="edit"
        projectId={id}
        currencies={currencies.map((c) => ({ code: c.code, symbol: c.symbol }))}
        categories={categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind }))}
        tz={tz}
        initialValues={{
          name: project.name,
          budget: String(project.budget),
          currencyCode: project.currencyCode,
          categoryId: project.categoryId ?? undefined,
          startDate: dayKeyInTz(project.startDate, tz),
          endDate: project.endDate ? dayKeyInTz(project.endDate, tz) : undefined,
          note: project.note ?? undefined,
        }}
      />
    </div>
  );
}
