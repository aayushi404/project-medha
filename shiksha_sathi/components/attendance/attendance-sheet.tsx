"use client";

import { Check, X } from "lucide-react";

import type { AttendanceStatus, AttendanceStudent } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ProfileImage } from "@/components/ui/profile-image";

const OPTIONS: { value: AttendanceStatus; icon: typeof Check; active: string }[] = [
  { value: "present", icon: Check, active: "bg-sage/15 text-sage border-sage/40" },
  { value: "absent", icon: X, active: "bg-destructive/10 text-destructive border-destructive/40" },
];

/** A day's roster with local, unsaved marks (`drafts`) -- toggling a row only
 * updates the draft in the parent; nothing hits the network until the
 * parent's "Save" fires one batched `markAttendance` call. */
export function AttendanceSheet({
  students,
  drafts,
  onToggle,
}: {
  students: AttendanceStudent[];
  drafts: Record<string, AttendanceStatus>;
  onToggle: (studentId: string, status: AttendanceStatus) => void;
}) {
  if (students.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        No approved students in this class yet.
      </p>
    );
  }

  const present = students.filter((s) => drafts[s.student_id] === "present").length;
  const absent = students.filter((s) => drafts[s.student_id] === "absent").length;
  const marked = present + absent;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Stat label="Present" value={present} tone="text-sage" />
        <Stat label="Absent" value={absent} tone="text-destructive" />
        <span className="ml-auto text-muted-foreground">
          {marked}/{students.length} marked
        </span>
      </div>

      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
        {students.map((s) => {
          const status = drafts[s.student_id];
          return (
            <li key={s.student_id} className="flex items-center gap-3 bg-card px-3 py-2.5">
              <span className="w-5 shrink-0 text-xs text-muted-foreground tabular-nums">
                {s.roll_number ?? ""}
              </span>
              <ProfileImage url={s.photo_url} name={s.full_name} size="sm" />
              <span className="min-w-0 flex-1 truncate text-sm">{s.full_name}</span>
              <div className="flex shrink-0 items-center gap-1">
                {OPTIONS.map((o) => {
                  const on = status === o.value;
                  const Icon = o.icon;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      aria-pressed={on}
                      onClick={() => onToggle(s.student_id, o.value)}
                      className={cn(
                        "flex size-8 items-center justify-center rounded-lg border text-xs font-medium transition-colors",
                        on
                          ? o.active
                          : "border-border text-muted-foreground hover:bg-muted",
                      )}
                    >
                      <Icon className="size-4" />
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
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
