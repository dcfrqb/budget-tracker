import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // отключаем плавающий N-индикатор в dev — он не вписывается в tone
  devIndicators: false,
  // playwright и его обёртки тянут нативные add-ons и сложный CJS — пусть Next
  // не пытается их bundleить в server chunks, а оставляет как external requires.
  serverExternalPackages: [
    "playwright",
    "playwright-extra",
    "puppeteer-extra-plugin-stealth",
  ],
};

export default nextConfig;
