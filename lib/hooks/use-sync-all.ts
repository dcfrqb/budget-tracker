"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { syncAction, syncAllAction, syncStatusAction } from "@/app/(shell)/wallet/integrations/actions";
import { useToast } from "@/components/ui/toast";
import { useT, useLocale } from "@/lib/i18n";
import { formatRelative } from "@/lib/format/relative-time";
import type { SyncCredentialProp } from "@/components/shell/sync-button";

type SyncState = "idle" | "syncing" | "error";

type UseSyncAllResult = {
  trigger: () => void;
  state: SyncState;
  lastSyncAt: Date | null;
};

const POLL_INTERVAL_MS = 3000;
const STUCK_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

export function useSyncAll(credentials: SyncCredentialProp[]): UseSyncAllResult {
  const t = useT();
  const router = useRouter();
  const { push } = useToast();

  const [state, setState] = useState<SyncState>("idle");
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(() => {
    if (credentials.length === 0) return null;
    const dates = credentials
      .map((c) => (c.lastSyncAt ? new Date(c.lastSyncAt).getTime() : 0))
      .filter(Boolean);
    if (dates.length === 0) return null;
    return new Date(Math.min(...dates));
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const jobIdsRef = useRef<string[]>([]);
  const credentialIdsRef = useRef<string[]>(credentials.map((c) => c.id));
  const pollStartRef = useRef<number | null>(null);

  // Keep credentialIds ref current
  useEffect(() => {
    credentialIdsRef.current = credentials.map((c) => c.id);
  }, [credentials]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    pollStartRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const startPolling = useCallback(
    (credIds: string[]) => {
      pollStartRef.current = Date.now();

      intervalRef.current = setInterval(async () => {
        if (credIds.length === 0) {
          stopPolling();
          setState("idle");
          return;
        }

        // 2-minute stuck guard
        if (pollStartRef.current !== null && Date.now() - pollStartRef.current > STUCK_TIMEOUT_MS) {
          stopPolling();
          setState("error");
          push({ tone: "err", title: t("transactions.sync.toast.timeout") });
          return;
        }

        const statusResult = await syncStatusAction({ credentialIds: credIds });
        if (!statusResult.ok) return;

        const statuses = statusResult.data;
        const anyRunning = statuses.some((s) => {
          if (!s.isRunning) return false;
          // Also treat rows stuck > 2 minutes as not-running (defense-in-depth for nit #3)
          if (s.startedAt && Date.now() - new Date(s.startedAt).getTime() > STUCK_TIMEOUT_MS) {
            return false;
          }
          return true;
        });

        if (!anyRunning) {
          stopPolling();
          setState("idle");

          // Build aggregated toast
          const parts: string[] = [];
          for (const status of statuses) {
            const cred = credentials.find((c) => c.id === status.credentialId);
            const name = cred?.displayLabel ?? cred?.adapterId ?? status.credentialId;
            if (status.lastResult?.errorClass) {
              parts.push(t("transactions.sync.toast_adapter_err", { vars: { name } }));
            } else if ((status.lastResult?.created ?? 0) + (status.lastResult?.updated ?? 0) > 0) {
              const count = String((status.lastResult?.created ?? 0) + (status.lastResult?.updated ?? 0));
              parts.push(t("transactions.sync.toast_adapter_ok", { vars: { name, count } }));
            } else {
              parts.push(t("transactions.sync.toast_adapter_synced", { vars: { name } }));
            }
          }

          const hasError = statuses.some((s) => s.lastResult?.errorClass);
          const now = new Date();
          setLastSyncAt(now);

          push({
            tone: hasError ? "err" : "ok",
            title: parts.join(" · "),
          });

          router.refresh();
        }
      }, POLL_INTERVAL_MS);
    },
    [credentials, t, push, router, stopPolling],
  );

  const trigger = useCallback(async () => {
    if (state === "syncing") return;

    if (credentials.length === 0) {
      push({ tone: "warn", title: t("transactions.sync.toast_no_credentials") });
      return;
    }

    // Single-credential path: call syncAction directly to get a jobId for this
    // specific credential. This allows the per-card sync button in integrations-manager
    // to reuse the same polling infrastructure instead of a fire-and-forget approach.
    if (credentials.length === 1) {
      const result = await syncAction(credentials[0].id);
      if (!result.ok) {
        setState("error");
        push({ tone: "err", title: result.error });
        return;
      }

      if (result.data.jobId === "") {
        push({ tone: "warn", title: t("transactions.sync.toast_already_running") });
        return;
      }

      setState("syncing");
      jobIdsRef.current = [result.data.jobId];
      push({ tone: "warn", title: t("transactions.sync.toast.launched") });
      startPolling([credentials[0].id]);
      return;
    }

    // Multi-credential path: enqueue all at once
    const result = await syncAllAction();
    if (!result.ok) {
      setState("error");
      push({ tone: "err", title: t("transactions.sync.toast_no_credentials") });
      return;
    }

    const { jobIds, skipped } = result.data;

    // All are already running — nothing new was enqueued
    if (jobIds.length === 0 && skipped.length === credentials.length) {
      push({ tone: "warn", title: t("transactions.sync.toast_already_running") });
      return;
    }

    if (jobIds.length === 0) {
      push({ tone: "warn", title: t("transactions.sync.toast_already_running") });
      return;
    }

    setState("syncing");
    jobIdsRef.current = jobIds;
    push({ tone: "warn", title: t("transactions.sync.toast.launched") });
    startPolling(credentialIdsRef.current);
  }, [credentials, state, t, push, startPolling]);

  // Compute lastSyncAt from credentials when not syncing
  const computedLastSyncAt =
    state === "idle" && credentials.length > 0
      ? (() => {
          const dates = credentials
            .map((c) => (c.lastSyncAt ? new Date(c.lastSyncAt).getTime() : 0))
            .filter(Boolean);
          if (dates.length === 0) return null;
          return new Date(Math.min(...dates));
        })()
      : lastSyncAt;

  return { trigger, state, lastSyncAt: computedLastSyncAt };
}

/** Format a relative time label for the sync button. */
export function useSyncRelativeLabel(lastSyncAt: Date | null, state: SyncState): string {
  const t = useT();
  const locale = useLocale();

  if (state === "syncing") {
    return t("transactions.sync.button_syncing");
  }
  if (!lastSyncAt) {
    return t("transactions.sync.never");
  }
  const when = formatRelative(lastSyncAt, locale);
  return t("transactions.sync.button_relative", { vars: { when } });
}
