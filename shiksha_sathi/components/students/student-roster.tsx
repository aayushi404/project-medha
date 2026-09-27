import Link from "next/link";

import type { StudentRosterItem } from "@/lib/api";
import { ProfileImage } from "@/components/ui/profile-image";

function Row({ s }: { s: StudentRosterItem }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <ProfileImage url={s.photo_url} name={s.full_name} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">{s.full_name}</div>
        <div className="truncate text-xs text-muted-foreground">
          {s.grade_label} · {s.section}
          {s.roll_number != null ? ` · Roll ${s.roll_number}` : ""}
          {s.email ? ` · ${s.email}` : ""}
        </div>
      </div>
    </div>
  );
}

/** `profileHref` opts a caller into linking each row to a real profile route
 * (e.g. the principal dashboard passes "/principal/students") -- omitted by
 * default since a plain teacher's own /students roster has no such route to
 * link to. */
export function StudentRoster({
  students,
  profileHref,
}: {
  students: StudentRosterItem[];
  profileHref?: string;
}) {
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
        <li key={s.id}>
          {profileHref ? (
            <Link href={`${profileHref}/${s.id}`} className="block transition-colors hover:bg-muted/50">
              <Row s={s} />
            </Link>
          ) : (
            <Row s={s} />
          )}
        </li>
      ))}
    </ul>
  );
}
