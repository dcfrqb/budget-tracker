import { redirect } from "next/navigation";

export default function LegacyIntegrationsRedirect(): never {
  redirect("/wallet/integrations");
}
