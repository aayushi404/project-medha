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
    if (!teacher) return;
    // admins/principals have their own consoles -- send them back to the role router
    if (teacher.role !== "teacher") router.replace("/home");
    else if (!teacher.onboarded_at) router.replace("/onboarding");
  }, [teacher, router]);

  // Base UI portals (Select popups, dialogs, the ProfileMenu popover) mount
  // onto <body>, outside this subtree -- CSS custom properties inherit down
  // the DOM tree, so a class on the wrapper div alone wouldn't reach them.
  // Toggling the same class on <body> while this shell is mounted covers both.
  useEffect(() => {
    document.body.classList.add("app-shell");
    return () => document.body.classList.remove("app-shell");
  }, []);

  if (!teacher || teacher.role !== "teacher" || !teacher.onboarded_at) return null;

  return (
    <ProfileProvider>
      <LessonProvider>
        {/* Shell is pinned to the viewport; the sidebar stays put and each
            screen scrolls inside its own overflow-y-auto region. */}
        <div className="app-shell flex h-dvh flex-col overflow-hidden md:flex-row">
          <AppSidebar />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {children}
          </div>
        </div>
      </LessonProvider>
    </ProfileProvider>
  );
}
