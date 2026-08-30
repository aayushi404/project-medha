"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import type { Role } from "@/lib/api";

/**
 * Client-side role guard for the admin/principal consoles. The (protected)
 * layout already handles "not signed in"; this only sends a signed-in user
 * with the wrong role back to `/home`, which re-routes them by role.
 *
 * Client guards are for UX -- the backend enforces the real boundary via
 * `require_admin` / `require_principal`.
 */
export function RoleGate({
  role,
  children,
}: {
  role: Role | Role[];
  children: ReactNode;
}) {
  const { status, teacher } = useAuth();
  const router = useRouter();
  const allowed = Array.isArray(role) ? role : [role];
  const ok = teacher != null && allowed.includes(teacher.role);

  useEffect(() => {
    if (status === "authenticated" && teacher && !ok) router.replace("/home");
  }, [status, teacher, ok, router]);

  if (status !== "authenticated" || !teacher || !ok) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  return <>{children}</>;
}
