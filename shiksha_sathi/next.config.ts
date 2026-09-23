import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Browsers must always re-check the service worker, or installed apps
        // can stay pinned to an old version.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

export default nextConfig;
