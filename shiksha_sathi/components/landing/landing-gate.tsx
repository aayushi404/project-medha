"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { GovLanding } from "@/components/landing/gov-landing";

/**
 * Visitors who already have a session (restored via the silent refresh the
 * AuthProvider runs on every app load) should never have to click "Login"
 * again -- forward them straight to /home, which routes on to their role's
 * dashboard exactly like a fresh login does. Anonymous visitors (the vast
 * majority) see the marketing page immediately; nothing blocks on the auth
 * check resolving.
 */
export function LandingGate() {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/home");
    }
  }, [status, router]);

  if (status === "authenticated") {
    return (
      <main className="flex min-h-screen flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  return <GovLanding />;
}
