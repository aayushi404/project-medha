import type { StudentRosterItem } from "@/lib/api";

export function StudentRoster({ students }: { students: StudentRosterItem[] }) {
  if (students.length === 0) {
    return (
      <p className="rounded-xl bg-card p-6 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
        No approved students yet.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-xl bg-card ring-1 ring-foreground/10">
      {students.map((s) => (
        <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-foreground">
              {s.full_name}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {s.grade_label}
              {s.roll_number ? ` · Roll ${s.roll_number}` : ""}
              {s.email ? ` · ${s.email}` : ""}
            </div>
          </div>
          <span
            className={
              s.activated
                ? "shrink-0 text-xs text-muted-foreground"
                : "shrink-0 rounded-full bg-gold/15 px-2 py-0.5 text-xs text-earth"
            }
          >
            {s.activated ? "Active" : "Not activated"}
          </span>
        </li>
      ))}
    </ul>
  );
}
