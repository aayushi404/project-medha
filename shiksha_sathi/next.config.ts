import type { NextConfig } from "next";

const BACKEND_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    // The browser calls /api/* on this site (see API_BASE_URL in lib/api.ts)
    // and it is proxied to the FastAPI backend, which serves the same routes
    // under /api (backend/src/backend/core/api_prefix.py).
    return [{ source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` }];
  },
  async headers() {
    return [
      {
        // Per-user API responses must never be cached by Vercel's CDN.
        source: "/api/:path*",
        headers: [{ key: "x-vercel-enable-rewrite-caching", value: "0" }],
      },
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
