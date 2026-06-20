export default function FamilyLoading() {
  return (
    <div className="page-content">
      {/* Group header */}
      <div
        style={{
          padding: "var(--sp-3)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="skeleton-block" style={{ width: 180, height: 20, marginBottom: 8 }} />
        <div className="skeleton-block" style={{ width: 260, height: 14 }} />
      </div>

      {/* Space-tab blocks */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "var(--sp-2)",
          padding: "var(--sp-3)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="skeleton-block" style={{ height: 64, borderRadius: 4 }} />
        ))}
      </div>

      {/* Member rows */}
      <div
        style={{
          padding: "var(--sp-3)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="skeleton-block" style={{ width: 80, height: 12, marginBottom: 12 }} />
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
            <div className="skeleton-block" style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0 }} />
            <div className="skeleton-block" style={{ flex: 1, height: 12 }} />
            <div className="skeleton-block" style={{ width: 60, height: 12, flexShrink: 0 }} />
          </div>
        ))}
      </div>

      {/* Shared fund cards */}
      <div style={{ padding: "var(--sp-3)" }}>
        <div className="skeleton-block" style={{ width: 120, height: 12, marginBottom: 12 }} />
        {Array.from({ length: 2 }).map((_, i) => (
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
