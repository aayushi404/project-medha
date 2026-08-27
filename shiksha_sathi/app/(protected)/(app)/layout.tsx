"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { AppSidebar } from "@/components/app/app-sidebar";
import { useAuth } from "@/lib/auth-context";
import { LessonProvider } from "@/lib/lesson-context";
import { ProfileProvider } from "@/lib/profile-context";

/**
 * Shell for the signed-in app screens (Dashboard, My Modules). Nests inside the
 * (protected) auth gate and adds chrome + the shared providers. The
 * onboarding-not-done redirect lives here so both screens are covered once.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  const { teacher } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (teacher && !teacher.onboarded_at) router.replace("/onboarding");
  }, [teacher, router]);

  if (!teacher || !teacher.onboarded_at) return null;

  return (
    <ProfileProvider>
      <LessonProvider>
        <div className="flex min-h-full flex-1 flex-col md:flex-row">
          <AppSidebar />
          <div className="flex min-w-0 flex-1 flex-col">{children}</div>
        </div>
      </LessonProvider>
    </ProfileProvider>
  );
}
