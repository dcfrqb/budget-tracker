export default function WalletLoading() {
  return (
    <div className="page-content">
      {/* Totals block */}
      <div
        style={{
          padding: "var(--sp-3)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="skeleton-block" style={{ width: 100, height: 14, marginBottom: 10 }} />
        <div className="skeleton-block" style={{ width: 160, height: 32, marginBottom: 6 }} />
        <div className="skeleton-block" style={{ width: 120, height: 14 }} />
      </div>

      {/* FX rate rows */}
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
            <div className="skeleton-block" style={{ width: 40, height: 12, flexShrink: 0 }} />
            <div className="skeleton-block" style={{ flex: 1, height: 12 }} />
            <div className="skeleton-block" style={{ width: 72, height: 12, flexShrink: 0 }} />
          </div>
        ))}
      </div>

      {/* Institution cards */}
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
