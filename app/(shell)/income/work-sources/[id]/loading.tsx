export default function WorkSourceDetailLoading() {
  return (
    <div className="page-content">
      {/* Header strip */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--sp-3)",
          padding: "var(--sp-3)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="skeleton-block" style={{ width: 80, height: 14 }} />
        <div className="skeleton-block" style={{ flex: 1, height: 20 }} />
        <div className="skeleton-block" style={{ width: 64, height: 28 }} />
        <div className="skeleton-block" style={{ width: 64, height: 28 }} />
      </div>

      {/* Period tabs */}
      <div
        style={{
          display: "flex",
          gap: "var(--sp-2)",
          padding: "var(--sp-2) var(--sp-3)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {[60, 44, 44, 52, 36].map((w, i) => (
          <div
            key={i}
            className="skeleton-block"
            style={{ width: w, height: 24 }}
          />
        ))}
      </div>

      {/* KPI grid */}
      <div
        className="ws-detail"
        style={{ padding: "var(--sp-3)", borderBottom: "1px solid var(--border)" }}
      >
        <div className="ws-kpi-grid">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="skeleton-block"
              style={{ height: 72, borderRadius: 4 }}
            />
          ))}
        </div>
      </div>

      {/* Chart placeholder 1 (bar) */}
      <div
        style={{ padding: "var(--sp-3)", borderBottom: "1px solid var(--border)" }}
      >
        <div className="skeleton-block" style={{ width: 80, height: 12, marginBottom: 8 }} />
        <div className="skeleton-block" style={{ width: "100%", height: 100, borderRadius: 3 }} />
      </div>

      {/* Chart placeholder 2 (line) */}
      <div
        style={{ padding: "var(--sp-3)", borderBottom: "1px solid var(--border)" }}
      >
        <div className="skeleton-block" style={{ width: 100, height: 12, marginBottom: 8 }} />
        <div className="skeleton-block" style={{ width: "100%", height: 100, borderRadius: 3 }} />
      </div>

      {/* Optional panel placeholder */}
      <div
        style={{ padding: "var(--sp-3)", borderBottom: "1px solid var(--border)" }}
      >
        <div className="skeleton-block" style={{ width: 120, height: 14, marginBottom: 12 }} />
        <div className="skeleton-block" style={{ width: "100%", height: 48, borderRadius: 3 }} />
      </div>

      {/* Transactions list stubs */}
      <div style={{ padding: "var(--sp-3)" }}>
        <div className="skeleton-block" style={{ width: 100, height: 14, marginBottom: 12 }} />
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: "var(--sp-3)",
              alignItems: "center",
              padding: "var(--sp-2) 0",
              borderBottom: i < 4 ? "1px solid var(--grid)" : undefined,
            }}
          >
            <div className="skeleton-block" style={{ width: 48, height: 12, flexShrink: 0 }} />
            <div className="skeleton-block" style={{ flex: 1, height: 12 }} />
            <div className="skeleton-block" style={{ width: 64, height: 12, flexShrink: 0 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
