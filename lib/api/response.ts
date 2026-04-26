import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

// Prisma.Decimal не сериализуется напрямую в JSON — превращаем в строку.
// Применяется рекурсивно к любому ответу через `ok()`.
function serialize(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Prisma.Decimal) return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serialize(v);
    }
    return out;
  }
  return value;
}

export function ok<T>(data: T, status = 200): Response {
  return Response.json({ ok: true, data: serialize(data) }, { status });
}

export function err(
  error: string,
  status: number,
  extra?: Record<string, unknown>,
): Response {
  return Response.json({ ok: false, error, ...extra }, { status });
}

export function notFound(what = "not found"): Response {
  return err(what, 404);
}

export function conflict(reason: string): Response {
  return err(reason, 409);
}

export function validation(zerr: ZodError): Response {
  return err("validation failed", 400, { issues: zerr.issues });
}

export function serverError(e: unknown): Response {
  console.error(e);
  return err("internal_server_error", 500);
}
