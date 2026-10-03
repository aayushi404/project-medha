"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  approvePrincipal,
  getAdminStats,
  getPendingPrincipals,
  rejectPrincipal,
  type AdminStats,
  type PendingPrincipal,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { RoleGate } from "@/components/auth/role-gate";
import { ActivityFeed } from "@/components/admin/activity-feed";
import { AdminShell } from "@/components/admin/admin-shell";
import { PendingPrincipals } from "@/components/admin/pending-principals";
import { StatGrid } from "@/components/console/stat-grid";

function AdminDashboard() {
  const { accessToken } = useAuth();

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [pending, setPending] = useState<PendingPrincipal[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  // bumped after a decision so the activity feed refetches
  const [feedVersion, setFeedVersion] = useState(0);

  // state is only set in `.then` (async), never synchronously -- keeps the
  // mount effect free of cascading renders.
  const reload = useCallback(() => {
    return Promise.all([getAdminStats(accessToken), getPendingPrincipals(accessToken)])
      .then(([s, p]) => {
        setStats(s);
        setPending(p);
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
      setFeedVersion((v) => v + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
      throw e; // let RejectDialog keep itself open on failure
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminShell
      title="Overview"
      description="Every school, principal and teacher on Medha at a glance."
    >
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {stats && (
            <StatGrid
              stats={[
                { label: "Schools", value: stats.schools },
                { label: "Districts", value: stats.districts },
                { label: "Principals", value: stats.principals },
                { label: "Teachers", value: stats.teachers },
                { label: "Students", value: stats.students },
                { label: "Pending principals", value: stats.pending_principals },
                { label: "Schools without a principal", value: stats.schools_without_principal },
                {
                  label: "Attendance today",
                  value: stats.attendance_today_pct === null ? "—" : `${stats.attendance_today_pct}%`,
                },
              ]}
            />
          )}

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-wide text-foreground">
                Principal applications
              </h2>
              <Link href="/admin/principals" className="text-xs font-semibold text-terracotta">
                Manage all
              </Link>
            </div>
            <PendingPrincipals
              principals={pending}
              busyId={busyId}
              onApprove={(id) =>
                void act(id, () => approvePrincipal(accessToken, id), "Principal approved.").catch(
                  () => {},
                )
              }
              onReject={(id, reason) =>
                act(id, () => rejectPrincipal(accessToken, id, reason), "Application rejected.")
              }
            />
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-wide text-foreground">
                Recent activity
              </h2>
              <Link href="/admin/activity" className="text-xs font-semibold text-terracotta">
                View all
              </Link>
            </div>
            <ActivityFeed key={feedVersion} limit={8} />
          </section>
        </div>
      )}
    </AdminShell>
  );
}

export default function AdminPage() {
  return (
    <RoleGate role="admin">
      <AdminDashboard />
    </RoleGate>
  );
}
