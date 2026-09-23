"use client";

import { useEffect } from "react";

/**
 * Registers /sw.js (offline fallback) in production builds only — a service
 * worker in `next dev` would serve stale pages across hot reloads. Renders
 * nothing.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* non-fatal: the app works without it, just no offline screen */
    });
  }, []);

  return null;
}
