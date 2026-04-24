import type { SubscriptionGroupView } from "@/lib/view/subscriptions";
import { SubscriptionCard } from "./card";

type Props = {
  group: SubscriptionGroupView;
  markPaidLabel: string;
};

export function SubscriptionGroup({ group, markPaidLabel }: Props) {
  return (
    <div className="section fade-in">
      <div className="section-hd">
        <div className="ttl mono">
          <span className="dim">{group.title}</span>
          {group.items.length > 0 && (
            <span className="dim" style={{ marginLeft: 4 }}>{group.subtitle}</span>
          )}
        </div>
      </div>
      <div className="section-body flush">
        {group.items.length === 0 ? (
          <div
            className="mono"
            style={{ color: "var(--dim)", fontSize: 11, padding: "8px 12px" }}
          >
            {group.empty}
          </div>
        ) : (
          <div className="sub-grid">
            {group.items.map((card) => (
              <SubscriptionCard key={card.id} card={card} markPaidLabel={markPaidLabel} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
