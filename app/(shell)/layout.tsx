import { Suspense } from "react";

import { NavRail } from "@/components/shell/nav-rail";
import { ShellResizer } from "@/components/shell/shell-resizer";
import { TopBar } from "@/components/shell/top-bar";
import { QuickDrawerLoader } from "@/components/shell/quick-drawer-loader";

export default function ShellLayout({
  children,
  summary,
}: Readonly<{ children: React.ReactNode; summary: React.ReactNode }>) {
  return (
    <ShellResizer>
      <TopBar />
      <NavRail />
      <main className="feed">{children}</main>
      {summary}
      <Suspense>
        <QuickDrawerLoader />
      </Suspense>
    </ShellResizer>
  );
}
