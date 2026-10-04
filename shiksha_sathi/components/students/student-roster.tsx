"use client";

import type { StudentRosterItem } from "@/lib/api";
import { StudentCard } from "@/components/students/student-card";

/** A list of student cards. `profileHref` is the base route (e.g. "/students");
 * each card links to `${profileHref}/${id}`. */
export function StudentRoster({
  students,
  profileHref,
  emptyText = "No approved students yet.",
}: {
  students: StudentRosterItem[];
  profileHref: string;
  emptyText?: string;
}) {
  if (students.length === 0) {
    return (
      <p className="rounded-xl bg-card p-6 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
        {emptyText}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {students.map((s) => (
        <li key={s.id}>
          <StudentCard student={s} href={`${profileHref}/${s.id}`} />
        </li>
      ))}
    </ul>
  );
}
