export default function IncomeLoading() {
  return (
    <div className="page-content">
      {/* Top KPI strip */}
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

      {/* Work source cards */}
      <div style={{ padding: "var(--sp-3)" }}>
        <div
          className="skeleton-block"
          style={{ width: 120, height: 14, marginBottom: 12 }}
        />
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
