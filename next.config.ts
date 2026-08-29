import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    // The on-by-default Turbopack build cache (.next/cache/turbopack) is an
    // SST database that corrupts when a build is interrupted mid-write, which
    // then panics every later build with "Cache corruption detected". This
    // app builds cold in seconds, so skip the cache entirely.
    turbopackFileSystemCacheForBuild: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.shopify.com",
        pathname: "/s/files/**",
      },
    ],
  },
};

export default nextConfig;
