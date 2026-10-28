"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { WorkUpdateCard } from "@/components/principal/work-updates/work-update-card";
import type { TeacherDailyStatus } from "@/lib/api";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/** One teacher's row: who they are, a 5-day streak strip (oldest to
 * newest, ending on the viewed date), whether they've submitted for the
 * viewed date, and -- expanded -- their update(s) for that date. */
export function TeacherStatusRow({
  teacher,
  defaultOpen,
  onFeedback,
}: {
  teacher: TeacherDailyStatus;
  defaultOpen?: boolean;
  onFeedback: (id: string, body: { note?: string | null; flagged: boolean; badge?: string | null }) => Promise<void>;
}) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  const hasUpdates = teacher.updates.length > 0;

  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => hasUpdates && setOpen((v) => !v)}
        disabled={!hasUpdates}
        className="flex w-full items-center gap-3 p-3 text-left disabled:cursor-default"
      >
        {teacher.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={teacher.photo_url}
            alt=""
            className="size-9 shrink-0 rounded-full object-cover ring-1 ring-border"
          />
        ) : (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-terracotta/15 text-xs font-semibold text-terracotta">
            {initials(teacher.teacher_name)}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-foreground">{teacher.teacher_name}</div>
          <div className="mt-1 flex items-center gap-1">
            {teacher.recent_days.map((d) => (
              <span
                key={d.date}
                title={d.date}
                className={`size-2 rounded-full ${d.submitted ? "bg-emerald-500" : "bg-muted-foreground/25"}`}
              />
            ))}
            <span className="ml-1.5 text-[10px] text-muted-foreground">last 5 days</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {teacher.submitted_today ? (
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
              ✅ Submitted{teacher.updates.length > 1 ? ` (${teacher.updates.length})` : ""}
            </span>
          ) : (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
              ⏳ Not yet
            </span>
          )}
          {hasUpdates &&
            (open ? (
              <ChevronDown className="size-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="size-3.5 text-muted-foreground" />
            ))}
        </div>
      </button>

      {open && hasUpdates && (
        <div className="grid grid-cols-1 gap-3 border-t border-border/60 p-3 sm:grid-cols-2">
          {teacher.updates.map((u) => (
            <WorkUpdateCard key={u.id} item={u} onFeedback={onFeedback} />
          ))}
        </div>
      )}
    </div>
  );
}
