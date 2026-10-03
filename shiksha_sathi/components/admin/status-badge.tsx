const STATUS_STYLE: Record<string, string> = {
  approved: "bg-primary/10 text-primary",
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  rejected: "bg-destructive/10 text-destructive",
  revoked: "bg-destructive/10 text-destructive",
};

export function StatusBadge({ status }: { status: string | null }) {
  if (!status) {
    return (
      <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        no principal
      </span>
    );
  }
  return (
    <span
      className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium capitalize ${
        STATUS_STYLE[status] ?? "bg-muted text-muted-foreground"
      }`}
    >
      {status}
    </span>
  );
}

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}
