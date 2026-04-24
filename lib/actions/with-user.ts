import "server-only";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { getCurrentUserId } from "@/lib/api/auth";
import {
  ActionResult,
  actionOk,
  actionError,
  fromZodError,
} from "./result";

// ─────────────────────────────────────────────────────────────
// withUserAction — wraps a server action with:
//   1. getCurrentUserId()
//   2. Zod schema validation
//   3. Prisma known-error translation
//   4. Generic error boundary
// ─────────────────────────────────────────────────────────────

export function withUserAction<Input, Output>(
  schema: z.ZodType<Input>,
  fn: (userId: string, input: Input) => Promise<Output>,
): (rawInput: unknown) => Promise<ActionResult<Output>> {
  return async (rawInput: unknown): Promise<ActionResult<Output>> => {
    const userId = await getCurrentUserId();

    const parsed = schema.safeParse(rawInput);
    if (!parsed.success) {
      return fromZodError(parsed.error);
    }

    try {
      const result = await fn(userId, parsed.data);
      return actionOk(result);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === "P2002") {
          return actionError("unique_violation");
        }
        if (e.code === "P2025") {
          return actionError("not_found");
        }
      }
      console.error("[withUserAction] unexpected error:", e);
      return actionError("internal_error");
    }
  };
}
