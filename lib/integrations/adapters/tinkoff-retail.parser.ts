// Extracted from old tinkoff-retail.client.ts — only the response-parsing logic.
// HTTP, signing, and wuid helpers are not included (those were deleted with the old client).

export type TinkoffErrorCode =
  | "INSUFFICIENT_PRIVILEGES"
  | "WAITING_CONFIRMATION"
  | "INVALID_CREDENTIALS"
  | "RATE_LIMITED"
  | "UNKNOWN";

export class TinkoffApiError extends Error {
  readonly code: TinkoffErrorCode;
  readonly requiredAccessLevel?: number;
  readonly trackingId?: string;

  constructor(
    code: TinkoffErrorCode,
    message: string,
    opts?: { requiredAccessLevel?: number; trackingId?: string },
  ) {
    super(message);
    this.name = "TinkoffApiError";
    this.code = code;
    this.requiredAccessLevel = opts?.requiredAccessLevel;
    this.trackingId = opts?.trackingId;
  }
}

function mapResultCode(resultCode: string): TinkoffErrorCode {
  switch (resultCode) {
    case "INSUFFICIENT_PRIVILEGES":
      return "INSUFFICIENT_PRIVILEGES";
    case "WAITING_CONFIRMATION":
      return "WAITING_CONFIRMATION";
    case "INVALID_CREDENTIALS":
    case "WRONG_CREDENTIALS":
      return "INVALID_CREDENTIALS";
    case "RATE_LIMITED":
    case "TOO_MANY_REQUESTS":
      return "RATE_LIMITED";
    default:
      return "UNKNOWN";
  }
}

export function parseTinkoffResponse<T>(
  json: unknown,
): { payload: T; trackingId?: string } {
  if (json === null || typeof json !== "object") {
    throw new TinkoffApiError("UNKNOWN", "Response is not an object");
  }

  const obj = json as Record<string, unknown>;
  const resultCode =
    typeof obj.resultCode === "string" ? obj.resultCode : "UNKNOWN";
  const trackingId =
    typeof obj.trackingId === "string" ? obj.trackingId : undefined;

  if (resultCode !== "OK") {
    const errorMessage =
      typeof obj.errorMessage === "string"
        ? obj.errorMessage
        : `T-Bank error: ${resultCode}`;
    const code = mapResultCode(resultCode);
    const requiredAccessLevel =
      typeof obj.requiredAccessLevel === "number"
        ? obj.requiredAccessLevel
        : undefined;
    throw new TinkoffApiError(code, errorMessage, {
      requiredAccessLevel,
      trackingId,
    });
  }

  return { payload: obj.payload as T, trackingId };
}
