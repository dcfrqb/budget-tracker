import type { TimelineItemKind } from "@/lib/data/planning-timeline";

export type TimelineLegendLabels = {
  event: string;
  subscription: string;
  loan: string;
  fund_target: string;
  txn_planned: string;
};

const KINDS: { id: TimelineItemKind; glyph: string }[] = [
  { id: "event",        glyph: "E" },
  { id: "subscription", glyph: "S" },
  { id: "loan",         glyph: "L" },
  { id: "fund_target",  glyph: "F" },
  { id: "txn_planned",  glyph: "P" },
];

export function TimelineLegend({ labels }: { labels: TimelineLegendLabels }) {
  return (
    <div className="tl-legend">
      {KINDS.map(({ id, glyph }) => (
        <div key={id} className="tl-legend-item">
          <span className={`tl-legend-dot tl-legend-dot--${id}`} />
          <span className="tl-legend-glyph">{glyph}</span>
          <span>{labels[id]}</span>
        </div>
      ))}
    </div>
  );
}
