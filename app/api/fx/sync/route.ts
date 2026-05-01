import "server-only";
import { timingSafeEqual } from "node:crypto";
import { syncFxRates } from "@/lib/fx/sync";
import { ok, err } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const envToken = process.env.FX_SYNC_TOKEN;
  if (!envToken) {
    return err("FX_SYNC_TOKEN not configured", 503);
  }

  const headerToken = req.headers.get("x-fx-sync-token") ?? "";
  if (headerToken.length === 0) {
    return err("unauthorized", 401);
  }

  // Constant-time comparison to prevent timing attacks.
  const envBuf = Buffer.from(envToken, "utf8");
  const hdrBuf = Buffer.from(headerToken, "utf8");
  if (
    envBuf.length !== hdrBuf.length ||
    !timingSafeEqual(envBuf, hdrBuf)
  ) {
    return err("unauthorized", 401);
  }

  try {
    const result = await syncFxRates();
    return ok(result);
  } catch (e) {
    console.error("[api/fx/sync] CBR fetch failed:", e);
    return err("CBR fetch failed", 502);
  }
}
