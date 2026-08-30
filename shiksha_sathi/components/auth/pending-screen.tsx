"use client";

import Link from "next/link";
import { Clock } from "lucide-react";

import { useCopy } from "@/lib/copy";

type Props = {
  /** who still needs to act */
  approver?: string;
  message?: string;
};

/**
 * Shown after registration and on a `PENDING_APPROVAL` login. A calm waiting
 * state, deliberately not an error.
 */
export function PendingScreen({ approver, message }: Props) {
  const copy = useCopy();
  const who = approver ?? "an approver";

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Clock className="size-6" />
      </span>
      <h2 className="text-lg font-semibold tracking-tight text-foreground">
        {copy.pending.title}
      </h2>
      <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
        {message ?? copy.pending.body(who)}
      </p>
      <Link
        href="/login"
        className="mt-2 text-sm text-primary underline-offset-2 hover:underline"
      >
        {copy.pending.backToLogin}
      </Link>
    </div>
  );
}
