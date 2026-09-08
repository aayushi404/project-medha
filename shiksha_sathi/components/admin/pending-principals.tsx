"use client";

import { Check } from "lucide-react";

import type { PendingPrincipal } from "@/lib/api";
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
  principals: PendingPrincipal[];
  busyId: string | null;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => Promise<void>;
};

export function PendingPrincipals({ principals, busyId, onApprove, onReject }: Props) {
  if (principals.length === 0) {
    return (
      <p className="rounded-xl bg-card p-6 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
        No principal applications waiting.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {principals.map((p) => (
        <li
          key={p.id}
          className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-medium text-foreground">{p.full_name}</span>
              <span className="text-xs text-muted-foreground">{p.email}</span>
            </div>
            <div className="mt-1 text-sm text-foreground">
              {p.school_name}
              <span className="text-muted-foreground"> · {p.district_name}</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
              {p.mobile_number && <span>📞 {p.mobile_number}</span>}
              {p.qualification && <span>🎓 {p.qualification}</span>}
              <span>Applied {fmtDate(p.applied_at)}</span>
            </div>
          </div>

          <div className="flex shrink-0 gap-2">
            <Button
              size="sm"
              onClick={() => onApprove(p.id)}
              disabled={busyId === p.id}
            >
              <Check className="size-3.5" />
              Approve
            </Button>
            <RejectDialog
              subjectName={p.full_name}
              onConfirm={(reason) => onReject(p.id, reason)}
              trigger={
                <Button variant="destructive" size="sm" disabled={busyId === p.id}>
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
