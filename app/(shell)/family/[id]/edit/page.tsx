export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getCurrentUserId } from "@/lib/api/auth";
import { db } from "@/lib/db";
import { FamilyForm } from "@/components/forms/family-form";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditFamilyPage({ params }: Props) {
  const { id } = await params;
  const userId = await getCurrentUserId();

  const family = await db.family.findFirst({ where: { id, ownerId: userId } });
  if (!family) notFound();

  return (
    <div className="page-content">
      <FamilyForm
        variant="page"
        mode="edit"
        familyId={id}
        initialValues={{
          name: family.name,
          note: family.note ?? undefined,
        }}
      />
    </div>
  );
}
