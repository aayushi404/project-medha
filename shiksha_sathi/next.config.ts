import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
const apiUrl = process.env.NEXT_PUBLIC_API_URL;

// A production build must know exactly which backend it talks to, over TLS --
// silently falling back to plain-HTTP localhost would ship a broken (and, via
// the CSP's connect-src, wrongly-scoped) app.
if (isProd && process.env.NEXT_PHASE === "phase-production-build") {
  if (!apiUrl) {
    throw new Error("NEXT_PUBLIC_API_URL must be set for a production build.");
  }
  const u = new URL(apiUrl);
  const isLocal = u.hostname === "localhost" || u.hostname === "127.0.0.1";
  if (u.protocol !== "https:" && !isLocal) {
    throw new Error("NEXT_PUBLIC_API_URL must be https:// in production.");
  }
  if (apiUrl.endsWith("/")) {
    throw new Error("NEXT_PUBLIC_API_URL must not end with a slash.");
  }
}

const BACKEND_URL = (apiUrl ?? "http://localhost:8000").replace(/\/$/, "");

// The Content-Security-Policy (with a per-request nonce) is set in proxy.ts;
// everything that doesn't vary per request lives here.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // microphone is used by the voice assistant / speech input, nothing else is
  {
    key: "Permissions-Policy",
    value: "microphone=(self), camera=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  ...(isProd
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async rewrites() {
    // The browser calls /api/* on this site (see API_BASE_URL in lib/api.ts)
    // and it is proxied to the FastAPI backend, which serves the same routes
    // under /api (backend/src/backend/core/api_prefix.py).
    return [{ source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` }];
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
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
