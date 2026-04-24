import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/api/auth";
import { getUserContext } from "@/lib/data/settings";
import { getT } from "@/lib/i18n/server";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const [userId, t] = await Promise.all([getCurrentUserId(), getT()]);

  const ctx = await getUserContext(userId);

  // Already onboarded — send to root
  if (ctx.onboardedAt !== null) {
    redirect("/");
  }

  return (
    <div className="onboarding-page">
      <div className="onboarding-card">
        <div className="onboarding-header">
          <div className="brand mono">BDG://</div>
          <div className="title">{t("onboarding.title")}</div>
          <div className="subtitle">{t("onboarding.subtitle")}</div>
        </div>

        <OnboardingForm />
      </div>
    </div>
  );
}
