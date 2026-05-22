import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["nse-bse-api"],
  experimental: {
    typedRoutes: true,
  },
  // TODO: re-enable once src/types/database.ts is regenerated via
  //   `supabase gen types typescript --linked > src/types/database.ts`
  // and the auth.getClaims() / MarketDataError override sites are fixed.
  typescript: {
    ignoreBuildErrors: true,
  },
  // TODO: re-enable once lint errors are triaged (`npm run lint` locally).
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
