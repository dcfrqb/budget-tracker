import { ZodError, ZodSchema } from "zod";
import { err, validation } from "./response";

export async function parseJson(req: Request): Promise<
  { ok: true; data: unknown } | { ok: false; response: Response }
> {
  try {
    const data = await req.json();
    return { ok: true, data };
  } catch {
    return { ok: false, response: err("invalid JSON body", 400) };
  }
}

export function parseWith<T>(schema: ZodSchema<T>, input: unknown):
  | { ok: true; data: T }
  | { ok: false; response: Response } {
  const res = schema.safeParse(input);
  if (res.success) return { ok: true, data: res.data };
  return { ok: false, response: validation(res.error as ZodError) };
}

// Удобный комбайн: прочитать JSON body и провалидировать.
export async function parseBody<T>(
  req: Request,
  schema: ZodSchema<T>,
): Promise<{ ok: true; data: T } | { ok: false; response: Response }> {
  const body = await parseJson(req);
  if (!body.ok) return body;
  return parseWith(schema, body.data);
}
