"use client";

import { UserCheck } from "lucide-react";

import { TeacherStatusRow } from "@/components/principal/work-updates/teacher-status-row";
import type { DailyStatusApi } from "@/lib/api";

/** The core reusable view: a summary stat plus every teacher's status for
 * one date, not-yet-submitted teachers surfaced first since that's what a
 * principal most needs to see. Used by both the dashboard's "today" view
 * and the full history route (any date). */
export function DailyStatusBoard({
  status,
  onFeedback,
}: {
  status: DailyStatusApi;
  onFeedback: (id: string, body: { note?: string | null; flagged: boolean; badge?: string | null }) => Promise<void>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const isToday = status.date === today;

  const sorted = [...status.teachers].sort((a, b) => {
    if (a.submitted_today !== b.submitted_today) return a.submitted_today ? 1 : -1;
    return a.teacher_name.localeCompare(b.teacher_name);
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-terracotta/10 text-terracotta">
          <UserCheck className="size-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">
              {isToday ? "Today's Work Updates" : `Work Updates — ${status.date}`}
            </h3>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                status.submitted_count === status.total_count && status.total_count > 0
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
              }`}
            >
              {status.submitted_count}/{status.total_count} submitted
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Not-yet-submitted teachers are shown first. Tap a submitted teacher to review and send feedback.
          </p>
        </div>
      </div>

      {status.teachers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center text-xs text-muted-foreground">
          No approved teachers at this school yet.
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((t) => (
            <TeacherStatusRow key={t.teacher_id} teacher={t} onFeedback={onFeedback} />
          ))}
        </div>
      )}
    </div>
  );
}
