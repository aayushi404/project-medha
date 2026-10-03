"use client";

import Link from "next/link";
import { ChevronRight, GraduationCap, Users } from "lucide-react";

import type { SchoolPrincipalStatus } from "@/lib/api";
import { StatusBadge } from "@/components/admin/status-badge";

export function SchoolsList({ schools }: { schools: SchoolPrincipalStatus[] }) {
  if (schools.length === 0) {
    return (
      <p className="rounded-xl bg-card p-6 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
        No schools found.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-xl bg-card ring-1 ring-foreground/10">
      {schools.map((s) => (
        <li key={s.school_id}>
          <Link
            href={`/admin/schools/${s.school_id}`}
            className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-foreground">
                {s.school_name}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {s.district_name}
                {s.principal_name ? ` · ${s.principal_name}` : " · no principal"}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:inline-flex">
                <Users className="size-3.5" /> {s.teacher_count}
              </span>
              <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:inline-flex">
                <GraduationCap className="size-3.5" /> {s.student_count}
              </span>
              <StatusBadge status={s.principal_status} />
              <ChevronRight className="size-4 text-muted-foreground" />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
