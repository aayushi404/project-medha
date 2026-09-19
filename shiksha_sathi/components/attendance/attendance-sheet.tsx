"use client";

import { Check, Loader2, Phone, X } from "lucide-react";
import { toast } from "sonner";

import type { AttendanceStatus, AttendanceStudent } from "@/lib/api";
import { cn } from "@/lib/utils";

const OPTIONS: { value: AttendanceStatus; icon: typeof Check; active: string }[] = [
  { value: "present", icon: Check, active: "bg-sage/15 text-sage border-sage/40" },
  { value: "absent", icon: X, active: "bg-destructive/10 text-destructive border-destructive/40" },
];

// Placeholder guardian contact number, shared across every student, until
// real per-student guardian numbers are wired up (see absence_calls on the
// backend, which already has one per student for the automated AI call --
// this manual "Call" button is a separate, teacher-initiated action).
const PLACEHOLDER_GUARDIAN_PHONE = "+919572704600";

export function AttendanceSheet({
  students,
  busyId,
  onMark,
}: {
  students: AttendanceStudent[];
  busyId: string | null;
  onMark: (studentId: string, status: AttendanceStatus) => void;
}) {
  if (students.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        No approved students in this class yet.
      </p>
    );
  }

  const present = students.filter((s) => s.status === "present").length;
  const absent = students.filter((s) => s.status === "absent").length;
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
        {students.map((s, i) => {
          const busy = busyId === s.student_id;
          return (
            <li key={s.student_id} className="flex items-center gap-3 bg-card px-3 py-2.5">
              <span className="w-5 shrink-0 text-xs text-muted-foreground tabular-nums">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">
                {s.full_name}
                {s.roll_number ? (
                  <span className="ml-1.5 text-xs text-muted-foreground">#{s.roll_number}</span>
                ) : null}
              </span>
              <div className="flex shrink-0 items-center gap-1">
                {busy && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                {s.status === "absent" ? (
                  <a
                    href={`tel:${PLACEHOLDER_GUARDIAN_PHONE}`}
                    onClick={() => toast(`Calling ${s.full_name}'s guardian…`)}
                    title={`Call guardian — ${PLACEHOLDER_GUARDIAN_PHONE}`}
                    aria-label={`Call ${s.full_name}'s guardian`}
                    className="flex size-8 items-center justify-center rounded-lg border border-terracotta/40 text-terracotta transition-colors hover:bg-terracotta/10"
                  >
                    <Phone className="size-4" />
                  </a>
                ) : null}
                {OPTIONS.map((o) => {
                  const on = s.status === o.value;
                  const Icon = o.icon;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      aria-pressed={on}
                      disabled={busy}
                      onClick={() => onMark(s.student_id, o.value)}
                      className={cn(
                        "flex size-8 items-center justify-center rounded-lg border text-xs font-medium transition-colors disabled:opacity-50",
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
