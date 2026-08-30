"use client";

import { Check } from "lucide-react";

import type { AttStatus, DaySummary, Student } from "@/lib/attendance-store";
import { cn } from "@/lib/utils";

const OPTIONS: { value: AttStatus; label: string; active: string }[] = [
  { value: "present", label: "P", active: "bg-sage/15 text-sage border-sage/40" },
  { value: "absent", label: "A", active: "bg-destructive/10 text-destructive border-destructive/40" },
  { value: "late", label: "L", active: "bg-gold/15 text-earth border-gold/50" },
];

export function AttendanceSheet({
  students,
  day,
  summary,
  onMark,
  onMarkRemaining,
  onClear,
}: {
  students: Student[];
  day: Record<string, AttStatus>;
  summary: DaySummary;
  onMark: (studentId: string, status: AttStatus) => void;
  onMarkRemaining: (status: AttStatus) => void;
  onClear: () => void;
}) {
  if (students.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        No students in this class yet. Add them in the Roster tab.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Stat label="Present" value={summary.present} tone="text-sage" />
        <Stat label="Absent" value={summary.absent} tone="text-destructive" />
        <Stat label="Late" value={summary.late} tone="text-earth" />
        <span className="ml-auto text-muted-foreground">
          {summary.marked}/{summary.total} marked · {summary.pct}% present
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onMarkRemaining("present")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-muted"
        >
          <Check className="size-3.5" /> Mark remaining present
        </button>
        {summary.marked > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted"
          >
            Clear day
          </button>
        )}
      </div>

      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
        {students.map((s, i) => {
          const current = day[s.id];
          return (
            <li
              key={s.id}
              className="flex items-center gap-3 bg-card px-3 py-2.5"
            >
              <span className="w-5 shrink-0 text-xs text-muted-foreground tabular-nums">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">
                {s.name}
                {s.roll ? (
                  <span className="ml-1.5 text-xs text-muted-foreground">#{s.roll}</span>
                ) : null}
              </span>
              <div className="flex shrink-0 gap-1">
                {OPTIONS.map((o) => {
                  const on = current === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      aria-pressed={on}
                      onClick={() => onMark(s.id, o.value)}
                      className={cn(
                        "size-8 rounded-lg border text-xs font-medium transition-colors",
                        on
                          ? o.active
                          : "border-border text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] text-muted-foreground">
        Saved to this browser as you tap. It won&apos;t sync to other devices yet.
      </p>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2 py-1">
      <span className={cn("font-semibold tabular-nums", tone)}>{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}
