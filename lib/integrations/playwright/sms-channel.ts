type PendingEntry = {
  resolve: (code: string) => void;
  reject: (err: Error) => void;
  timeoutHandle: NodeJS.Timeout;
};

const pending = new Map<string, PendingEntry>();

export function waitForSms(
  credentialId: string,
  timeoutMs = 5 * 60_000,
): Promise<string> {
  const existing = pending.get(credentialId);
  if (existing) {
    clearTimeout(existing.timeoutHandle);
    pending.delete(credentialId);
    existing.reject(new Error("superseded"));
  }

  return new Promise<string>((resolve, reject) => {
    const timeoutHandle = setTimeout(() => {
      pending.delete(credentialId);
      reject(new Error("timeout"));
    }, timeoutMs);

    pending.set(credentialId, { resolve, reject, timeoutHandle });
  });
}

export function pushSms(credentialId: string, code: string): boolean {
  const entry = pending.get(credentialId);
  if (!entry) return false;

  clearTimeout(entry.timeoutHandle);
  pending.delete(credentialId);
  entry.resolve(code);
  return true;
}

export function cancelSms(credentialId: string, reason = "cancelled"): void {
  const entry = pending.get(credentialId);
  if (!entry) return;

  clearTimeout(entry.timeoutHandle);
  pending.delete(credentialId);
  entry.reject(new Error(reason));
}

export function hasPendingSms(credentialId: string): boolean {
  return pending.has(credentialId);
}
