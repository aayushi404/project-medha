"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/lib/auth-context";

/** "/" is just a router: send a logged-in teacher wherever they belong. */
export default function IndexPage() {
  const { teacher } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!teacher) return;
    router.replace(teacher.onboarded_at ? "/dashboard" : "/onboarding");
  }, [teacher, router]);

  return (
    <main className="flex flex-1 items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </main>
  );
}
