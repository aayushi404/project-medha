"use client";

import Link from "next/link";
import { Check, ChevronRight, Phone } from "lucide-react";

import type { PendingStudent } from "@/lib/api";
import { useCopy } from "@/lib/copy";
import { formatIndianPhone } from "@/lib/phone-format";
import { Button } from "@/components/ui/button";
import { RejectDialog } from "@/components/console/reject-dialog";

type Props = {
  students: PendingStudent[];
  /** base route for the profile link, e.g. "/students" */
  profileHref: string;
  busyId: string | null;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => Promise<void>;
};

/**
 * Registrations waiting for a decision. The name and details link to the
 * student's profile, so a teacher can check the record before approving.
 * Approve and Reject sit beside the link, not inside it.
 */
export function PendingStudents({ students, profileHref, busyId, onApprove, onReject }: Props) {
  const copy = useCopy();

  if (students.length === 0) {
    return (
      <p className="rounded-xl bg-card p-6 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
        {copy.students.noWaiting}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {students.map((s) => {
        const phone = formatIndianPhone(s.login_phone);
        return (
          <li
            key={s.id}
            className="flex flex-col gap-3 rounded-xl bg-card p-3 ring-1 ring-amber-500/30 sm:flex-row sm:items-center"
          >
            <Link
              href={`${profileHref}/${s.id}`}
              className="group flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1 transition-colors hover:bg-muted/50"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground">{s.full_name}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  {s.roll_number != null && <span>{copy.students.roll(String(s.roll_number))}</span>}
                  {phone && (
                    <span className="inline-flex items-center gap-1 text-foreground">
                      <Phone className="size-3" aria-hidden />
                      {phone}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>

            <div className="flex shrink-0 gap-2 px-1 pb-1 sm:px-0 sm:pb-0">
              <Button size="sm" onClick={() => onApprove(s.id)} disabled={busyId === s.id} aria-label={`${copy.students.approve}: ${s.full_name}`}>
                <Check className="size-3.5" />
                {copy.students.approve}
              </Button>
              <RejectDialog
                subjectName={s.full_name}
                onConfirm={(reason) => onReject(s.id, reason)}
                trigger={
                  <Button variant="destructive" size="sm" disabled={busyId === s.id}>
                    {copy.students.reject}
                  </Button>
                }
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
