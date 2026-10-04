"use client";

import { createContext, useContext } from "react";

import type { StudentProfileSummary } from "@/lib/api";

/** Why the student's login stopped short of a session, when it did. */
export type StudentLoginOutcome =
  | { kind: "pending" }
  | { kind: "rejected"; reason: string | null };

/**
 * The student login's in-memory state, shared by its three steps (phone,
 * profile, password). Lives in app/login/student/layout.tsx and nowhere else:
 * no storage, so a page refresh starts again at the phone step, and nothing
 * outlives the tab.
 */
export type StudentLoginFlow = {
  /** 10-digit number the profiles were looked up with. */
  phone: string | null;
  profiles: StudentProfileSummary[];
  selected: StudentProfileSummary | null;
  outcome: StudentLoginOutcome | null;
  begin: (phone: string, profiles: StudentProfileSummary[]) => void;
  choose: (profile: StudentProfileSummary) => void;
  setOutcome: (outcome: StudentLoginOutcome | null) => void;
  restart: () => void;
};

export const StudentLoginFlowContext = createContext<StudentLoginFlow | null>(null);

export function useStudentLoginFlow(): StudentLoginFlow {
  const ctx = useContext(StudentLoginFlowContext);
  if (!ctx) throw new Error("useStudentLoginFlow must be used within the student login layout");
  return ctx;
}

/** `+91 •••••• 3210`: enough to recognise the number, not enough to read it. */
export function maskPhone(phone: string): string {
  return `+91 ${"•".repeat(6)} ${phone.slice(-4)}`;
}
