import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// ActionResult — discriminated union returned by all server actions
// ─────────────────────────────────────────────────────────────

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; formError?: string; fieldErrors?: Record<string, string[]> };

export function actionOk<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function actionError<T = never>(formError: string): ActionResult<T> {
  return { ok: false, formError };
}

export function actionFieldErrors<T = never>(
  fieldErrors: Record<string, string[]>,
): ActionResult<T> {
  return { ok: false, fieldErrors };
}

export function fromZodError<T = never>(err: z.ZodError): ActionResult<T> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".");
    if (!fieldErrors[key]) fieldErrors[key] = [];
    fieldErrors[key].push(issue.message);
  }
  return { ok: false, fieldErrors };
}
