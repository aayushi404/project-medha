"use client";

import { Loader2, Phone, PhoneMissed, PhoneOff } from "lucide-react";

import type { AbsenceCall, AbsenceCallStatus } from "@/lib/api";
import { cn } from "@/lib/utils";

const STATUS_META: Record<
  AbsenceCallStatus,
  { label: string; tone: string; spinning?: boolean; icon: typeof Phone }
> = {
  queued: { label: "Calling…", tone: "bg-muted text-muted-foreground", spinning: true, icon: Phone },
  dialing: { label: "Calling…", tone: "bg-muted text-muted-foreground", spinning: true, icon: Phone },
  ringing: { label: "Ringing…", tone: "bg-gold/15 text-earth", spinning: true, icon: Phone },
  in_progress: { label: "On the call…", tone: "bg-sage/15 text-sage", spinning: true, icon: Phone },
  completed: { label: "Done", tone: "bg-sage/15 text-sage", icon: Phone },
  no_answer: { label: "No answer", tone: "bg-gold/15 text-earth", icon: PhoneMissed },
  failed: { label: "Call failed", tone: "bg-destructive/10 text-destructive", icon: PhoneOff },
  no_guardian_phone: {
    label: "No guardian number on file",
    tone: "bg-muted text-muted-foreground",
    icon: PhoneOff,
  },
  not_configured: {
    label: "Guardian calling isn't set up yet",
    tone: "bg-muted text-muted-foreground",
    icon: PhoneOff,
  },
};

export function GuardianCallsPanel({ calls }: { calls: AbsenceCall[] }) {
  if (calls.length === 0) return null;

  return (
    <div className="mt-5 flex flex-col gap-2">
      <span className="text-xs font-medium text-muted-foreground">
        Guardian calls — today&apos;s absences
      </span>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
        {calls.map((call) => {
          const meta = STATUS_META[call.status];
          const Icon = meta.icon;
          return (
            <li key={call.id} className="flex flex-col gap-1 bg-card px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm">{call.student_name}</span>
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                    meta.tone,
                  )}
                >
                  {meta.spinning ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Icon className="size-3" />
                  )}
                  {meta.label}
                </span>
              </div>
              {call.reason_text && (
                <p className="text-xs text-muted-foreground">{call.reason_text}</p>
              )}
              {!call.reason_text && call.failure_reason && (
                <p className="text-xs text-destructive/80">{call.failure_reason}</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
