import Link from "next/link";

type Props = {
  title: string;
  summary: string;
  href: string;
  linkLabel: string;
};

export function LinkSection({ title, summary, href, linkLabel }: Props) {
  return (
    <div className="settings-section">
      <div className="settings-section-title mono">{title}</div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <span className="settings-section-summary mono">{summary}</span>
        <Link href={href} className="btn primary" style={{ whiteSpace: "nowrap", flexShrink: 0 }}>
          {linkLabel}
        </Link>
      </div>
    </div>
  );
}
