"use client";

import { Check } from "lucide-react";

import type { PendingTeacher } from "@/lib/api";
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
  teachers: PendingTeacher[];
  busyId: string | null;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => Promise<void>;
};

export function PendingTeachers({ teachers, busyId, onApprove, onReject }: Props) {
  if (teachers.length === 0) {
    return (
      <p className="rounded-xl bg-card p-6 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
        No teacher applications waiting.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {teachers.map((t) => (
        <li
          key={t.id}
          className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-medium text-foreground">{t.full_name}</span>
              <span className="text-xs text-muted-foreground">{t.email}</span>
            </div>
            {/* the fields a principal checks against staff records */}
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <span className="text-foreground">
                <span className="text-muted-foreground">Employee code </span>
                <span className="font-medium">{t.employee_code ?? "—"}</span>
              </span>
              <span className="text-foreground">
                <span className="text-muted-foreground">Mobile </span>
                {t.mobile_number ?? "—"}
              </span>
              <span className="text-foreground">
                <span className="text-muted-foreground">Experience </span>
                {t.years_of_experience != null ? `${t.years_of_experience} yr` : "—"}
              </span>
              {t.qualification && (
                <span className="text-foreground">
                  <span className="text-muted-foreground">Qualification </span>
                  {t.qualification}
                </span>
              )}
              <span className="text-muted-foreground">Applied {fmtDate(t.applied_at)}</span>
            </div>
          </div>

          <div className="flex shrink-0 gap-2">
            <Button size="sm" onClick={() => onApprove(t.id)} disabled={busyId === t.id}>
              <Check className="size-3.5" />
              Approve
            </Button>
            <RejectDialog
              subjectName={t.full_name}
              onConfirm={(reason) => onReject(t.id, reason)}
              trigger={
                <Button variant="destructive" size="sm" disabled={busyId === t.id}>
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
