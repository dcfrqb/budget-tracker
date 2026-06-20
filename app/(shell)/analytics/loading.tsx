export default function AnalyticsLoading() {
  return (
    <div className="page-content">
      {/* Weather banner */}
      <div
        style={{
          padding: "var(--sp-3)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="skeleton-block" style={{ width: "100%", height: 56, borderRadius: 4 }} />
      </div>

      {/* 4-cell KPI grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "var(--sp-2)",
          padding: "var(--sp-3)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton-block" style={{ height: 60, borderRadius: 4 }} />
        ))}
      </div>

      {/* Trend chart placeholder */}
      <div
        style={{
          padding: "var(--sp-3)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="skeleton-block" style={{ width: 100, height: 12, marginBottom: 10 }} />
        <div className="skeleton-block" style={{ width: "100%", height: 120, borderRadius: 4 }} />
      </div>

      {/* Pie placeholder */}
      <div
        style={{
          padding: "var(--sp-3)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="skeleton-block" style={{ width: 120, height: 12, marginBottom: 10 }} />
        <div className="skeleton-block" style={{ width: "100%", height: 140, borderRadius: 4 }} />
      </div>

      {/* Section blocks */}
      <div style={{ padding: "var(--sp-3)" }}>
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="skeleton-block"
            style={{
              height: 64,
              borderRadius: 4,
              marginBottom: "var(--sp-2)",
            }}
          />
        ))}
      </div>
    </div>
  );
}
