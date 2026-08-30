"use client";

import type { ReactNode } from "react";

import { RoleGate } from "@/components/auth/role-gate";
import { StudentSidebar } from "@/components/student/student-sidebar";
import { StudentDataProvider } from "@/lib/student-context";

/**
 * Shell for the student screens (Ask Medha, Practice, Notes, Library). The
 * (protected) gate covers "not signed in"; RoleGate sends a signed-in
 * non-student back to /home. Adds the sidebar chrome + shared data provider.
 */
export default function StudentLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGate role="student">
      <StudentDataProvider>
        {/* Shell is pinned to the viewport; the sidebar stays put and each
            screen scrolls inside its own overflow-y-auto region. */}
        <div className="flex h-dvh flex-col overflow-hidden md:flex-row">
          <StudentSidebar />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {children}
          </div>
        </div>
      </StudentDataProvider>
    </RoleGate>
  );
}
