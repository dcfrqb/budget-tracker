import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

import { NavRail } from "@/components/shell/nav-rail";
import { ShellResizer } from "@/components/shell/shell-resizer";
import { TopBar } from "@/components/shell/top-bar";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--ui-font",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--mono-font",
  display: "swap",
});

export const metadata: Metadata = {
  title: "БДЖ:// — бюджет",
  description: "Личные финансы. Terminal-quant dashboard.",
};

export default function RootLayout({
  children,
  summary,
}: Readonly<{ children: React.ReactNode; summary: React.ReactNode }>) {
  return (
    <html lang="ru" className={`${inter.variable} ${jetbrains.variable}`}>
      <body>
        <ShellResizer>
          <TopBar />
          <NavRail />
          <main className="feed">{children}</main>
          {summary}
        </ShellResizer>
      </body>
    </html>
  );
}
