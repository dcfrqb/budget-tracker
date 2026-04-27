type SessionEntry = {
  promise: Promise<void>;
  abort: () => void;
  startedAt: number;
};

const sessions = new Map<string, SessionEntry>();

export function registerSession(credentialId: string, entry: SessionEntry): void {
  const existing = sessions.get(credentialId);
  if (existing) {
    existing.abort();
  }
  sessions.set(credentialId, entry);
  entry.promise.finally(() => {
    if (sessions.get(credentialId) === entry) {
      sessions.delete(credentialId);
    }
  });
}

export function getSession(credentialId: string): SessionEntry | undefined {
  return sessions.get(credentialId);
}

export function abortSession(credentialId: string, reason?: string): void {
  const entry = sessions.get(credentialId);
  if (!entry) return;
  sessions.delete(credentialId);
  try {
    entry.abort();
  } catch {
    // best-effort
  }
}

export function hasSession(credentialId: string): boolean {
  return sessions.has(credentialId);
}
