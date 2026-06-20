export default function PlanningLoading() {
  return (
    <div className="page-content">
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

      {/* Hours calculator block */}
      <div
        style={{
          padding: "var(--sp-3)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="skeleton-block" style={{ width: 140, height: 14, marginBottom: 10 }} />
        <div className="skeleton-block" style={{ width: "100%", height: 48, borderRadius: 4 }} />
      </div>

      {/* Calendar strip */}
      <div
        style={{
          padding: "var(--sp-3)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="skeleton-block" style={{ width: 120, height: 14, marginBottom: 10 }} />
        <div className="skeleton-block" style={{ width: "100%", height: 100, borderRadius: 4 }} />
      </div>

      {/* Fund cards */}
      <div style={{ padding: "var(--sp-3)" }}>
        <div className="skeleton-block" style={{ width: 100, height: 14, marginBottom: 12 }} />
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="skeleton-block"
            style={{
              height: 72,
              borderRadius: 4,
              marginBottom: "var(--sp-2)",
            }}
          />
        ))}
      </div>
    </div>
  );
}
