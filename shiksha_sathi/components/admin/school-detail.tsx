"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";

import { getAdminSchool, type SchoolDetail as SchoolDetailData } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { StatGrid } from "@/components/console/stat-grid";
import { StatusBadge } from "@/components/admin/status-badge";

export function SchoolDetail({
  schoolId,
  onLoaded,
}: {
  schoolId: string;
  onLoaded?: (name: string) => void;
}) {
  const { accessToken } = useAuth();
  const [school, setSchool] = useState<SchoolDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    getAdminSchool(accessToken, schoolId)
      .then((s) => {
        if (!active) return;
        setSchool(s);
        onLoaded?.(s.school_name);
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : "Could not load this school.");
      });
    return () => {
      active = false;
    };
  }, [accessToken, schoolId, onLoaded]);

  const back = (
    <Link
      href="/admin/schools"
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-3.5" /> All schools
    </Link>
  );

  if (error) {
    return (
      <div className="space-y-3">
        {back}
        <p className="rounded-xl bg-card p-6 text-center text-sm text-destructive ring-1 ring-foreground/10">
          {error}
        </p>
      </div>
    );
  }

  if (!school) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const facts: [string, string | null][] = [
    ["District", school.district_name],
    ["Block", school.block_name],
    ["UDISE code", school.udise_code],
    ["School type", school.school_type],
    ["Medium", school.medium_of_instruction],
  ];
  const teachers = school.staff.filter((s) => s.role === "teacher");
  const principals = school.staff.filter((s) => s.role === "principal");

  return (
    <div className="space-y-6">
      {back}

      <StatGrid
        stats={[
          { label: "Classes", value: school.class_count },
          { label: "Students", value: school.student_count },
          { label: "Students awaiting approval", value: school.pending_student_count },
          {
            label: "Attendance today",
            value: school.attendance_today_pct === null ? "—" : `${school.attendance_today_pct}%`,
          },
        ]}
      />

      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-foreground">Details</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:grid-cols-3">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="text-sm text-foreground">{value || "—"}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-foreground">
          Principal{principals.length === 1 ? "" : "s"}
        </h2>
        {principals.length === 0 ? (
          <p className="rounded-xl bg-card p-6 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
            No principal has registered for this school yet.
          </p>
        ) : (
          <StaffList staff={principals} />
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-foreground">
          Teachers ({teachers.length})
        </h2>
        {teachers.length === 0 ? (
          <p className="rounded-xl bg-card p-6 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
            No teachers yet.
          </p>
        ) : (
          <StaffList staff={teachers} />
        )}
      </section>
    </div>
  );
}

function StaffList({ staff }: { staff: SchoolDetailData["staff"] }) {
  return (
    <ul className="divide-y divide-border rounded-xl bg-card ring-1 ring-foreground/10">
      {staff.map((m) => (
        <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-foreground">{m.full_name}</div>
            <div className="truncate text-xs text-muted-foreground">
              {m.email ?? "no email"}
              {m.qualification ? ` · ${m.qualification}` : ""}
            </div>
          </div>
          <StatusBadge status={m.approval_status} />
        </li>
      ))}
    </ul>
  );
}
