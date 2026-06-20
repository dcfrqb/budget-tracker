export default function TransactionsLoading() {
  return (
    <div className="page-content">
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          gap: "var(--sp-2)",
          padding: "var(--sp-2) var(--sp-3)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {[80, 52, 52, 52, 52].map((w, i) => (
          <div key={i} className="skeleton-block" style={{ width: w, height: 28 }} />
        ))}
        <div className="skeleton-block" style={{ flex: 1, height: 28 }} />
        <div className="skeleton-block" style={{ width: 80, height: 28 }} />
      </div>

      {/* 3-col KPI grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "var(--sp-2)",
          padding: "var(--sp-3)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton-block" style={{ height: 60, borderRadius: 4 }} />
        ))}
      </div>

      {/* Day-grouped feed rows */}
      <div style={{ padding: "0 var(--sp-3)" }}>
        {Array.from({ length: 2 }).map((_, g) => (
          <div key={g} style={{ marginBottom: "var(--sp-2)" }}>
            <div
              className="skeleton-block"
              style={{ width: 80, height: 12, margin: "var(--sp-3) 0 var(--sp-2)" }}
            />
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: "var(--sp-3)",
                  alignItems: "center",
                  padding: "var(--sp-2) 0",
                  borderBottom: i < 2 ? "1px solid var(--grid)" : undefined,
                }}
              >
                <div className="skeleton-block" style={{ width: 48, height: 12, flexShrink: 0 }} />
                <div className="skeleton-block" style={{ flex: 1, height: 12 }} />
                <div className="skeleton-block" style={{ width: 72, height: 12, flexShrink: 0 }} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
