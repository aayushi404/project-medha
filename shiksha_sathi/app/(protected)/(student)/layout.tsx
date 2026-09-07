"use client";

import { useEffect, type ReactNode } from "react";

import { RoleGate } from "@/components/auth/role-gate";
import { StudentSidebar } from "@/components/student/student-sidebar";
import { StudentDataProvider } from "@/lib/student-context";

/**
 * Shell for the student screens (Ask Medha, Practice, Notes, Library, …). The
 * (protected) gate covers "not signed in"; RoleGate sends a signed-in
 * non-student back to /home. Adds the sidebar chrome + shared data provider.
 *
 * Wears the same `app-shell` skin as the teacher shell so the softer radius
 * token and the print isolation rules apply here too -- toggled on <body> as
 * well because Base UI popups (Select, Dialog) portal outside this subtree.
 */
export default function StudentLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.body.classList.add("app-shell");
    return () => document.body.classList.remove("app-shell");
  }, []);

  return (
    <RoleGate role="student">
      <StudentDataProvider>
        {/* Shell is pinned to the viewport; the sidebar stays put and each
            screen scrolls inside its own overflow-y-auto region. */}
        <div className="app-shell flex h-dvh flex-col overflow-hidden md:flex-row">
          <StudentSidebar />
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {/* Nalanda watercolour -- the same still backdrop the teacher
                dashboard uses, held behind every student screen with a heavy
                ivory wash so text stays legible over it. */}
            <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/dashboard-background.png"
                alt=""
                className="size-full object-cover object-[50%_35%]"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-ivory/90 via-ivory/78 to-ivory/90" />
            </div>
            <div className="relative z-10 flex min-h-0 flex-1 flex-col">
              {children}
            </div>
          </div>
        </div>
      </StudentDataProvider>
    </RoleGate>
  );
}
