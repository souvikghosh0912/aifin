import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["nse-bse-api"],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
