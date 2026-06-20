export default function ExpensesLoading() {
  return (
    <div className="page-content">
      {/* 5-cell KPI grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: "var(--sp-2)",
          padding: "var(--sp-3)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton-block" style={{ height: 60, borderRadius: 4 }} />
        ))}
      </div>

      {/* Section cards */}
      <div style={{ padding: "var(--sp-3)" }}>
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
