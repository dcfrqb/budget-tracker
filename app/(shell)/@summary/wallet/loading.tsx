export default function WalletSummaryLoading() {
  return (
    <aside className="summary-rail">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="sum-block">
          <div className="skeleton-block" style={{ width: 80, height: 12, marginBottom: 8 }} />
          <div className="skeleton-block" style={{ width: "70%", height: 28 }} />
        </div>
      ))}
    </aside>
  );
}
