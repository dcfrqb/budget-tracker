export const dynamic = "force-dynamic";

import { FamilyForm } from "@/components/forms/family-form";

export default function NewFamilyPage() {
  return (
    <div className="page-content">
      <FamilyForm variant="page" mode="create" />
    </div>
  );
}
