import type { TeacherRosterItem } from "@/lib/api";

export function TeacherRoster({ teachers }: { teachers: TeacherRosterItem[] }) {
  if (teachers.length === 0) {
    return (
      <p className="rounded-xl bg-card p-6 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
        No approved teachers yet.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-xl bg-card ring-1 ring-foreground/10">
      {teachers.map((t) => (
        <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-foreground">
              {t.full_name}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {t.email}
              {t.employee_code ? ` · ${t.employee_code}` : ""}
            </div>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">
            {t.years_of_experience != null ? `${t.years_of_experience} yr` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}
