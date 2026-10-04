"use client";

import { ChevronRight, Clock, Users } from "lucide-react";

import type { TeacherSection } from "@/lib/api";
import { useCopy } from "@/lib/copy";

/**
 * The teacher's classes, pending first. Each card shows how many students are
 * in the class and how many are waiting for a decision.
 */
export function ClassChooser({
  sections,
  onPick,
}: {
  sections: TeacherSection[];
  onPick: (section: TeacherSection) => void;
}) {
  const copy = useCopy();
  const ordered = [...sections].sort((a, b) => b.pending_students - a.pending_students);

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {ordered.map((section) => (
        <li key={section.id}>
          <button
            type="button"
            onClick={() => onPick(section)}
            className="group flex w-full items-center gap-3 rounded-xl bg-card p-4 text-left ring-1 ring-foreground/10 transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <div className="min-w-0 flex-1">
              <div className="text-base font-semibold text-foreground">
                {section.grade_label} · {section.section}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Users className="size-3.5" aria-hidden />
                  {copy.students.studentCount(section.students)}
                </span>
                {section.pending_students > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 font-medium text-amber-700 dark:text-amber-400">
                    <Clock className="size-3" aria-hidden />
                    {copy.students.waitingCount(section.pending_students)}
                  </span>
                )}
                {section.is_class_teacher && <span className="font-medium text-terracotta">{copy.students.classTeacherBadge}</span>}
              </div>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}
