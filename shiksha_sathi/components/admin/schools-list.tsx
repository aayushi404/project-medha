import type { SchoolPrincipalStatus } from "@/lib/api";

const STATUS_STYLE: Record<string, string> = {
  approved: "bg-primary/10 text-primary",
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  rejected: "bg-destructive/10 text-destructive",
};

export function SchoolsList({ schools }: { schools: SchoolPrincipalStatus[] }) {
  if (schools.length === 0) {
    return (
      <p className="rounded-xl bg-card p-6 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
        No schools registered yet.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-xl bg-card ring-1 ring-foreground/10">
      {schools.map((s) => (
        <li
          key={s.school_id}
          className="flex items-center justify-between gap-3 px-4 py-3"
        >
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-foreground">
              {s.school_name}
            </div>
            <div className="text-xs text-muted-foreground">
              {s.district_name}
              {s.principal_name ? ` · ${s.principal_name}` : " · no principal"}
            </div>
          </div>
          {s.principal_status ? (
            <span
              className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${
                STATUS_STYLE[s.principal_status] ?? "bg-muted text-muted-foreground"
              }`}
            >
              {s.principal_status}
            </span>
          ) : (
            <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              open
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
