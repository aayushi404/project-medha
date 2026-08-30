"use client";

import { Check } from "lucide-react";

import type { PendingStudent } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { RejectDialog } from "@/components/console/reject-dialog";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type Props = {
  students: PendingStudent[];
  busyId: string | null;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => Promise<void>;
};

export function PendingStudents({ students, busyId, onApprove, onReject }: Props) {
  if (students.length === 0) {
    return (
      <p className="rounded-xl bg-card p-6 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
        No student registrations waiting.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {students.map((s) => (
        <li
          key={s.id}
          className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <span className="font-medium text-foreground">{s.full_name}</span>
            {/* the pair a teacher checks against the class register */}
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <span className="text-foreground">
                <span className="text-muted-foreground">Class </span>
                <span className="font-medium">{s.grade_label}</span>
              </span>
              <span className="text-foreground">
                <span className="text-muted-foreground">Roll no. </span>
                <span className="font-medium">{s.roll_number ?? "—"}</span>
              </span>
              <span className="text-muted-foreground">
                Registered {fmtDate(s.applied_at)}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 gap-2">
            <Button size="sm" onClick={() => onApprove(s.id)} disabled={busyId === s.id}>
              <Check className="size-3.5" />
              Approve
            </Button>
            <RejectDialog
              subjectName={s.full_name}
              onConfirm={(reason) => onReject(s.id, reason)}
              trigger={
                <Button variant="destructive" size="sm" disabled={busyId === s.id}>
                  Reject
                </Button>
              }
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
