import { NextRequest, NextResponse } from "next/server";

/**
 * Sets a per-request-nonce Content-Security-Policy. The access token lives in
 * JS memory, so blocking script injection (XSS) is the main protection it has.
 * Scripts run only if they carry this request's nonce ('strict-dynamic' lets
 * those trusted scripts load their own chunks); nothing else may execute.
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";

  const apiOrigin = new URL(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").origin;

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // styles are far lower risk than scripts, and the UI libraries set inline styles
    "style-src 'self' 'unsafe-inline'",
    // markdown images from LLM output can't be used to leak data to other
    // hosts; res.cloudinary.com is allowlisted for profile photos specifically
    // (backend-proxied uploads: the URL always points at our own Cloudinary
    // account, never arbitrary user input)
    "img-src 'self' blob: data: https://res.cloudinary.com",
    "font-src 'self'",
    "media-src 'self' blob: data:",
    `connect-src 'self' ${apiOrigin}${isDev ? " ws://localhost:* http://localhost:*" : ""}`,
    "frame-src https://phet.colorado.edu https://www.youtube-nocookie.com https://www.youtube.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
