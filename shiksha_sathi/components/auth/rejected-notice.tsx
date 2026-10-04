"use client";

import Link from "next/link";

import { useCopy } from "@/lib/copy";

type Props = {
  reason: string | null;
  onBack: () => void;
};

/** Shown when a login is refused because the registration was rejected. */
export function RejectedNotice({ reason, onBack }: Props) {
  const copy = useCopy();

  return (
    <div className="mlogin-rejected">
      <strong>{copy.login.rejectedTitle}</strong>
      <p>{reason ? copy.login.rejectedReason(reason) : copy.login.rejectedFallback}</p>
      <Link href="/register" className="mlogin-link">
        {copy.login.registerAgain}
      </Link>
      <button type="button" className="mlogin-link-muted" onClick={onBack}>
        {copy.login.backToLogin}
      </button>
    </div>
  );
}
