"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

import { AppSidebar } from "@/components/app/app-sidebar";
import { FeatureLockOverlay } from "@/components/app/feature-lock-overlay";
import { useAuth } from "@/lib/auth-context";
import { LessonProvider } from "@/lib/lesson-context";
import { ProfileProvider } from "@/lib/profile-context";
import { SchoolProvider } from "@/lib/school-context";

/**
 * Early-access rollout: only Ask Medha, Work Update (reached from the
 * sidebar inside Homework, not its own route), Lesson Plan, History and
 * Simulations are live for teachers at launch. Everything else still renders
 * for real underneath a lock overlay (see FeatureLockOverlay) so it previews
 * rather than disappears. Profile stays open since it's account settings,
 * not a content feature.
 */
const TEACHER_UNLOCKED_PREFIXES = [
  "/dashboard",
  "/ask",
  "/profile",
  "/lesson-plan",
  "/history",
  "/simulations",
  "/question-paper",
  "/quiz",
  "/tools",
  "/create",
  "/report-card",
  "/timetable",
];

function isTeacherRouteLocked(pathname: string): boolean {
  return !TEACHER_UNLOCKED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Shell for the signed-in app screens (Dashboard, My Modules). Nests inside the
 * (protected) auth gate and adds chrome + the shared providers. Teachers are
 * assigned their school and classes by the principal, so there is no
 * onboarding step to wait for here.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  const { teacher } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!teacher) return;
    // admins/principals have their own consoles -- send them back to the role router
    if (teacher.role !== "teacher") router.replace("/home");
  }, [teacher, router]);

  // Base UI portals (Select popups, dialogs, the ProfileMenu popover) mount
  // onto <body>, outside this subtree -- CSS custom properties inherit down
  // the DOM tree, so a class on the wrapper div alone wouldn't reach them.
  // Toggling the same class on <body> while this shell is mounted covers both.
  useEffect(() => {
    document.body.classList.add("app-shell");
    return () => document.body.classList.remove("app-shell");
  }, []);

  if (!teacher || teacher.role !== "teacher") return null;

  return (
    <SchoolProvider>
    <ProfileProvider>
      <LessonProvider>
        {/* Shell is pinned to the viewport; the sidebar stays put and each
            screen scrolls inside its own overflow-y-auto region. */}
        <div className="app-shell flex h-dvh flex-col overflow-hidden md:flex-row">
          <AppSidebar />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {isTeacherRouteLocked(pathname) ? (
              <FeatureLockOverlay>{children}</FeatureLockOverlay>
            ) : (
              children
            )}
          </div>
        </div>
      </LessonProvider>
    </ProfileProvider>
    </SchoolProvider>
  );
}
