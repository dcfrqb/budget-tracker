import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

import { LocaleClientProvider } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { DICTS } from "@/lib/i18n/dict";

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
  title: "BDG:// budget",
  description: "Personal finance. Terminal-quant dashboard.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  // Resolve the active locale's dictionary server-side.
  // Only this dict is serialized into the page — the other locale is tree-shaken.
  const dict = DICTS[locale];

  return (
    <html lang={locale} className={`${inter.variable} ${jetbrains.variable}`}>
      <body>
        <LocaleClientProvider locale={locale} dict={dict}>
          {children}
        </LocaleClientProvider>
      </body>
    </html>
  );
}
