import { CountUp } from "@/components/count-up";
import { getT, getLocale } from "@/lib/i18n/server";
import { formatPlainNumber } from "@/lib/format/money";
import { formatRelative } from "@/lib/format/relative-time";
import { getCurrentUserId } from "@/lib/api/auth";
import { getHomeDashboard } from "@/lib/data/dashboard";
import { getIntegrationsSummary } from "@/lib/data/_queries/integrations";
import { toHomeView } from "@/lib/view/home";
import { DEFAULT_CURRENCY } from "@/lib/constants";

// ─────────────────────────────────────────────────────────────
// Self-fetch helper — called when no data prop is supplied.
// getHomeDashboard is wrapped in react.cache so parallel calls
// within the same render tree are deduplicated.
// ─────────────────────────────────────────────────────────────

async function loadSharedSummary() {
  const [userId, t] = await Promise.all([getCurrentUserId(), getT()]);
  const dashboard = await getHomeDashboard(userId, DEFAULT_CURRENCY);
  return toHomeView(dashboard, t);
}

// ─────────────────────────────────────────────────────────────
// Types for summary blocks — passed from page-level data fetch
// ─────────────────────────────────────────────────────────────

export type SafeUntilData = {
  days: number | null;
  /** ISO date string, e.g. "2026-06-07" */
  dateIso?: string;
  deltaLabel?: string;
};

export type AvailableData = {
  freeBase: number;
  totalBase: number;
  reservedBase: number;
  /** Sum of spendable money (debit + credit-available + cash + crypto). Optional — falls back to freeBase. */
  liquidBase?: number;
};

export type BalanceData = {
  sym: string;
  display: string;
};

export type StatusData = {
  label: string;
};

// ─────────────────────────────────────────────────────────────
// SafeUntilBlock — accepts optional props; shows "—" if no data
// ─────────────────────────────────────────────────────────────

export async function SafeUntilBlock({ data }: { data?: SafeUntilData }) {
  const t = await getT();
  const resolved = data ?? (await loadSharedSummary()).safeUntil;
  const days = resolved?.days ?? null;
  const dateIso = data?.dateIso;
  const deltaLabel = data?.deltaLabel;

  return (
    <div className="sum-block" style={{ padding: "12px 8px" }}>
      <div className="safe-block">
        <div className="lbl">
          <span>{t("shell.summary.safe.label")}</span>
          <span className="tiny">{t("shell.summary.safe.zero_income")}</span>
        </div>
        <div className="row">
          <span className="big mono">
            {days !== null ? <CountUp to={days} format="int" /> : "—"}
          </span>
          <span className="unit mono">{t("shell.summary.safe.days")}</span>
        </div>
        {(dateIso || deltaLabel) && (
          <div className="sub mono">
            {dateIso && <>→ {dateIso}</>}
            {deltaLabel && <> · <span className="acc">{deltaLabel}</span></>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// AvailableBlock
// ─────────────────────────────────────────────────────────────

export async function AvailableBlock({ data }: { data?: AvailableData }) {
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const resolved = data ?? (await loadSharedSummary()).available;
  const freeBase = resolved?.freeBase ?? 0;
  const totalBase = resolved?.totalBase ?? 0;
  const reservedBase = resolved?.reservedBase ?? 0;
  // Big number shows liquid (sum of spendable money: debit + credit-available + cash + crypto).
  // Falls back to freeBase for legacy callers that haven't plumbed liquidBase yet.
  const displayBase = resolved?.liquidBase ?? freeBase;

  return (
    <div className="sum-block avail">
      <div className="lbl">
        <span>{t("shell.summary.avail.label")}</span>
      </div>
      <div className="big2 mono">
        <CountUp to={displayBase} /> ₽
      </div>
      <div className="sub">
        <span>
          {t("shell.summary.avail.total")}{" "}
          <span className="mono" style={{ color: "var(--muted)" }}>
            {formatPlainNumber(totalBase, locale)}
          </span>
        </span>
        <span>
          {t("shell.summary.avail.reserved")}{" "}
          <span className="mono" style={{ color: "var(--warn)" }}>
            {formatPlainNumber(reservedBase, locale)}
          </span>
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// BalancesBlock
// ─────────────────────────────────────────────────────────────

export async function BalancesBlock({ balances }: { balances?: BalanceData[] }) {
  const t = await getT();
  const rows = balances ?? (await loadSharedSummary()).balances ?? [];
  return (
    <div className="sum-block">
      <div className="lbl">
        <span>{t("shell.summary.balances.label")}</span>
        {rows.length > 0 && (
          <span className="tiny mono">
            {/* TODO: pluralize when i18n supports plural forms */}
            {t("shell.summary.balances.accounts", { vars: { count: rows.length } })}
          </span>
        )}
      </div>
      {rows.map((b) => (
        <div key={b.sym} className="bal-item">
          <span className="bal-sym mono">{b.sym}</span>
          <span className="bal-val mono">{b.display}</span>
        </div>
      ))}
      {rows.length === 0 && (
        <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
          {t("shell.summary.balances.empty")}
        </div>
      )}
    </div>
  );
}

type SessionRow = { tone: "pos" | "warn" | "muted" | "live-pos"; k: string; v: React.ReactNode; vClass?: string; vTitle?: string };

export async function SessionStateBlock({ status, rows }: { status?: StatusData; rows: SessionRow[] }) {
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const userId = await getCurrentUserId();

  let statusLabel: string;
  if (status?.label != null) {
    statusLabel = status.label;
  } else {
    const view = await loadSharedSummary();
    statusLabel = view.status.label;
  }

  const integrationsSummary = await getIntegrationsSummary(userId);

  const H12 = 12 * 60 * 60 * 1000;
  const H24 = 24 * 60 * 60 * 1000;

  let integrationsTone: "pos" | "warn" | "neg" | "muted";
  let integrationsValue: string;

  if (integrationsSummary.totalConnected === 0) {
    integrationsTone = "muted";
    integrationsValue = "—";
  } else if (integrationsSummary.hasError) {
    integrationsTone = "neg";
    integrationsValue = integrationsSummary.lastSyncAt
      ? formatRelative(integrationsSummary.lastSyncAt, locale)
      : "—";
  } else if (!integrationsSummary.lastSyncAt) {
    integrationsTone = "neg";
    integrationsValue = "—";
  } else {
    const ago = Date.now() - integrationsSummary.lastSyncAt.getTime();
    if (ago < H12) {
      integrationsTone = "pos";
    } else if (ago < H24) {
      integrationsTone = "warn";
    } else {
      integrationsTone = "neg";
    }
    integrationsValue = formatRelative(integrationsSummary.lastSyncAt, locale);
  }

  const intRow: SessionRow = {
    tone: integrationsTone === "neg" ? "muted" : integrationsTone,
    k: t("shell.summary.session.integrations"),
    v: integrationsValue,
    vClass: integrationsTone === "neg" ? "neg" : integrationsTone === "warn" ? "warn" : "",
  };

  const allRows: SessionRow[] = [intRow, ...rows];

  return (
    <div className="sum-block">
      <div className="lbl">
        <span>{t("shell.summary.session.label")}</span>
        <span className="tiny mono">{t("shell.summary.session.online")}</span>
      </div>
      <div className="status-row">
        <span className="dot live" style={{ background: "var(--pos)" }} />
        <span className="k">{t("shell.summary.session.status")}</span>
        <span className="v acc">{statusLabel}</span>
      </div>
      {allRows.map((r, i) => {
        const bg =
          r.tone === "pos" ? "var(--pos)" :
          r.tone === "warn" ? "var(--warn)" :
          r.tone === "muted" ? "var(--muted)" :
          "var(--pos)";
        return (
          <div key={i} className="status-row">
            <span className={`dot${r.tone === "live-pos" ? " live" : ""}`} style={{ background: bg }} />
            <span className="k">{r.k}</span>
            <span className={`v ${r.vClass ?? ""}`} title={r.vTitle}>{r.v}</span>
          </div>
        );
      })}
    </div>
  );
}

export async function QuickButtons() {
  const t = await getT();
  return (
    <div className="sum-block" style={{ borderBottom: 0 }}>
      <div className="lbl">
        <span>{t("shell.summary.quick.label")}</span>
      </div>
      <div className="sum-quick">
        <button title={t("shell.summary.quick.tip_income")}>{t("shell.summary.quick.income")}</button>
        <button title={t("shell.summary.quick.tip_expense")}>{t("shell.summary.quick.expense")}</button>
        <button title={t("shell.summary.quick.tip_txn")}>{t("shell.summary.quick.txn")}</button>
      </div>
    </div>
  );
}

export async function SummaryShell({ children }: { children: React.ReactNode }) {
  const t = await getT();
  return (
    <aside className="summary-rail" aria-label={t("shell.summary.aria")}>
      {children}
    </aside>
  );
}
