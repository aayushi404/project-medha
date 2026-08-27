"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/lib/auth-context";

/**
 * Gate for every route under this group: requires a session restored either
 * by a fresh email/password login or by the silent /auth/refresh on app load. The
 * refresh cookie is set on the (cross-origin) FastAPI backend, so Next.js's
 * own proxy.ts can't see it here -- this client-side check is the auth
 * boundary for this dev/deploy topology.
 */
export default function ProtectedLayout({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status !== "authenticated") {
    return (
      <main className="flex flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  return <>{children}</>;
}
