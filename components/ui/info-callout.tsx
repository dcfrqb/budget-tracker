import type { ReactNode } from "react";

export type InfoCalloutTone = "info" | "tax" | "warn" | "neutral";

interface InfoCalloutProps {
  tone?: InfoCalloutTone;
  children: ReactNode;
  icon?: ReactNode;
  compact?: boolean;
}

export function InfoCallout({
  tone = "info",
  children,
  icon,
  compact,
}: InfoCalloutProps) {
  return (
    <div
      role="note"
      className={`info-callout info-callout--${tone}`}
      data-compact={compact || undefined}
    >
      {icon && <span className="info-callout__icon">{icon}</span>}
      <div className="info-callout__body">{children}</div>
    </div>
  );
}
