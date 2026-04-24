import { DEFAULT_USER_ID } from "@/lib/constants";

/**
 * Asserts that integrations admin mode is active and the caller is the single default user.
 * Throws a descriptive error if either condition is not met.
 *
 * Must be called at the top of every server action and route handler
 * that touches IntegrationCredential data.
 */
export function assertAdminIntegrations(userId: string): void {
  if (process.env.ADMIN_INTEGRATIONS !== "true") {
    throw Object.assign(
      new Error(
        "Integrations are disabled. Set ADMIN_INTEGRATIONS=true in .env to enable.",
      ),
      { code: "FORBIDDEN" },
    );
  }

  if (userId !== DEFAULT_USER_ID) {
    throw Object.assign(
      new Error("Integrations are only available to the default admin user."),
      { code: "FORBIDDEN" },
    );
  }
}
