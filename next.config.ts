import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // отключаем плавающий N-индикатор в dev — он не вписывается в tone
  devIndicators: false,
};

export default nextConfig;
