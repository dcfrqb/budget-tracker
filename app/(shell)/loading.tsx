export default function HomeLoading() {
  return (
    <div className="page-content">
      {/* Quick-actions row */}
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
          <div key={i} className="skeleton-block" style={{ height: 40, borderRadius: 4 }} />
        ))}
      </div>

      {/* Plan / fact 2-col grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "var(--sp-2)",
          padding: "var(--sp-3)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton-block" style={{ height: 60, borderRadius: 4 }} />
        ))}
      </div>

      {/* Obligations list */}
      <div style={{ padding: "var(--sp-3)", borderBottom: "1px solid var(--border)" }}>
        <div className="skeleton-block" style={{ width: 140, height: 14, marginBottom: 12 }} />
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
            <div className="skeleton-block" style={{ width: 52, height: 12, flexShrink: 0 }} />
            <div className="skeleton-block" style={{ flex: 1, height: 12 }} />
            <div className="skeleton-block" style={{ width: 72, height: 12, flexShrink: 0 }} />
          </div>
        ))}
      </div>

      {/* Top categories */}
      <div style={{ padding: "var(--sp-3)" }}>
        <div className="skeleton-block" style={{ width: 120, height: 14, marginBottom: 12 }} />
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
            <div className="skeleton-block" style={{ flex: 1, height: 12 }} />
            <div className="skeleton-block" style={{ width: 64, height: 12, flexShrink: 0 }} />
            <div className="skeleton-block" style={{ width: 36, height: 12, flexShrink: 0 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
