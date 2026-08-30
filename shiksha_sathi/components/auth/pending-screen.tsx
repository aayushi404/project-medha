import Link from "next/link";
import { Clock } from "lucide-react";

type Props = {
  /** who still needs to act */
  approver?: string;
  message?: string;
};

/**
 * Shown after registration and on a `PENDING_APPROVAL` login. A calm waiting
 * state, deliberately not an error.
 */
export function PendingScreen({ approver = "an approver", message }: Props) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Clock className="size-6" />
      </span>
      <h2 className="text-lg font-semibold tracking-tight text-foreground">
        Waiting for approval
      </h2>
      <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
        {message ??
          `Your account has been created and is pending approval from ${approver}. You'll be able to log in once it's approved.`}
      </p>
      <Link
        href="/login"
        className="mt-2 text-sm text-primary underline-offset-2 hover:underline"
      >
        Back to log in
      </Link>
    </div>
  );
}
