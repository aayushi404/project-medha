"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/lib/auth-context";

/**
 * Post-login router: the public landing page owns "/", so a freshly
 * authenticated user is sent here and forwarded by role -- admins to the admin
 * console, principals to theirs, teachers into onboarding or the dashboard.
 */
export default function HomePage() {
  const { teacher } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!teacher) return;
    if (teacher.role === "admin") {
      router.replace("/admin");
    } else if (teacher.role === "principal") {
      router.replace("/principal");
    } else if (teacher.role === "student") {
      router.replace("/learn");
    } else {
      router.replace(teacher.onboarded_at ? "/dashboard" : "/onboarding");
    }
  }, [teacher, router]);

  return (
    <main className="flex flex-1 items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </main>
  );
}
