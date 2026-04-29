export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.INTEGRATION_SCHEDULER_ENABLED === "false") return;

  const { startScheduler } = await import("./lib/integrations/scheduler");
  startScheduler();
}
