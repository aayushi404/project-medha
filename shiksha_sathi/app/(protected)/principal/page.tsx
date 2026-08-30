"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  approveTeacher,
  getPendingTeachers,
  getPrincipalStats,
  getPrincipalTeachers,
  rejectTeacher,
  type PendingTeacher,
  type PrincipalStats,
  type TeacherRosterItem,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { RoleGate } from "@/components/auth/role-gate";
import { ConsoleShell } from "@/components/console/console-shell";
import { StatGrid } from "@/components/console/stat-grid";
import { PendingTeachers } from "@/components/principal/pending-teachers";
import { TeacherRoster } from "@/components/principal/teacher-roster";

function PrincipalDashboard() {
  const { accessToken } = useAuth();

  const [stats, setStats] = useState<PrincipalStats | null>(null);
  const [pending, setPending] = useState<PendingTeacher[]>([]);
  const [roster, setRoster] = useState<TeacherRosterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(() => {
    return Promise.all([
      getPrincipalStats(accessToken),
      getPendingTeachers(accessToken),
      getPrincipalTeachers(accessToken),
    ])
      .then(([s, p, r]) => {
        setStats(s);
        setPending(p);
        setRoster(r);
      })
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : "Could not load the dashboard.");
      });
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    reload().finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [accessToken, reload]);

  async function act(id: string, run: () => Promise<unknown>, ok: string) {
    setBusyId(id);
    try {
      await run();
      toast.success(ok);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
      throw e; // let RejectDialog keep itself open on failure
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ConsoleShell title="Principal">
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {stats && (
            <StatGrid
              stats={[
                { label: "Approved teachers", value: stats.teachers },
                { label: "Pending", value: stats.pending_teachers },
              ]}
            />
          )}

          <section>
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-foreground">
              Teacher applications
            </h2>
            <PendingTeachers
              teachers={pending}
              busyId={busyId}
              onApprove={(id) =>
                void act(id, () => approveTeacher(accessToken, id), "Teacher approved.")
              }
              onReject={(id, reason) =>
                act(id, () => rejectTeacher(accessToken, id, reason), "Application rejected.")
              }
            />
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-foreground">
              Your teachers
            </h2>
            <TeacherRoster teachers={roster} />
          </section>
        </div>
      )}
    </ConsoleShell>
  );
}

export default function PrincipalPage() {
  return (
    <RoleGate role="principal">
      <PrincipalDashboard />
    </RoleGate>
  );
}
