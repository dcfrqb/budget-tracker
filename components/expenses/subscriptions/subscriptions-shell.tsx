"use client";

import React, { useMemo } from "react";
import type { SubscriptionGroupView } from "@/lib/view/subscriptions";
import { SubscriptionSelectionProvider } from "./selection-context";
import { SubscriptionGroup } from "./group";
import { SubscriptionSelectionBar } from "./selection-bar";
import type { MergeSubItem } from "./merge-dialog";

type Props = {
  personalGroup: SubscriptionGroupView;
  splitGroup: SubscriptionGroupView;
  paidGroup: SubscriptionGroupView;
  subMetas: MergeSubItem[];
  tz?: string;
};

export function SubscriptionsShell({ personalGroup, splitGroup, paidGroup, subMetas, tz }: Props) {
  const subMetaMap = useMemo(() => new Map(subMetas.map((s) => [s.id, s])), [subMetas]);

  return (
    <SubscriptionSelectionProvider>
      <SubscriptionGroup group={personalGroup} tz={tz} />
      <SubscriptionGroup group={splitGroup} tz={tz} />
      <SubscriptionGroup group={paidGroup} tz={tz} />
      <SubscriptionSelectionBar subMap={subMetaMap} />
    </SubscriptionSelectionProvider>
  );
}
