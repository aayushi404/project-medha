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
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
