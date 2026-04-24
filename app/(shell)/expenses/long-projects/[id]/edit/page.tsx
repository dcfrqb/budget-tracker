export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getCurrentUserId } from "@/lib/api/auth";
import { db } from "@/lib/db";
import { LongProjectForm } from "@/components/forms/long-project-form";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditLongProjectPage({ params }: Props) {
  const { id } = await params;
  const userId = await getCurrentUserId();

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
        initialValues={{
          name: project.name,
          budget: String(project.budget),
          currencyCode: project.currencyCode,
          categoryId: project.categoryId ?? undefined,
          startDate: project.startDate.toISOString().slice(0, 10),
          endDate: project.endDate?.toISOString().slice(0, 10) ?? undefined,
          note: project.note ?? undefined,
        }}
      />
    </div>
  );
}
