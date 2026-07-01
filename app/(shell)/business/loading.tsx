export default function BusinessLoading() {
  return (
    <div className="page-content">
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
