"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  approvePrincipal,
  getAdminSchools,
  getAdminStats,
  getPendingPrincipals,
  rejectPrincipal,
  type AdminStats,
  type PendingPrincipal,
  type SchoolPrincipalStatus,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { RoleGate } from "@/components/auth/role-gate";
import { ConsoleShell } from "@/components/console/console-shell";
import { StatGrid } from "@/components/console/stat-grid";
import { PendingPrincipals } from "@/components/admin/pending-principals";
import { SchoolsList } from "@/components/admin/schools-list";

function AdminDashboard() {
  const { accessToken } = useAuth();

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [pending, setPending] = useState<PendingPrincipal[]>([]);
  const [schools, setSchools] = useState<SchoolPrincipalStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  // returns the fetch chain; state is only set in `.then` (async), never
  // synchronously -- keeps the mount effect free of cascading renders.
  const reload = useCallback(() => {
    return Promise.all([
      getAdminStats(accessToken),
      getPendingPrincipals(accessToken),
      getAdminSchools(accessToken),
    ])
      .then(([s, p, sc]) => {
        setStats(s);
        setPending(p);
        setSchools(sc);
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
    <ConsoleShell title="Admin">
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
                { label: "Principals", value: stats.principals },
                { label: "Teachers", value: stats.teachers },
                { label: "Pending", value: stats.pending_principals },
              ]}
            />
          )}

          <section>
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-foreground">
              Principal applications
            </h2>
            <PendingPrincipals
              principals={pending}
              busyId={busyId}
              onApprove={(id) =>
                void act(id, () => approvePrincipal(accessToken, id), "Principal approved.")
              }
              onReject={(id, reason) =>
                act(id, () => rejectPrincipal(accessToken, id, reason), "Application rejected.")
              }
            />
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-foreground">
              Schools
            </h2>
            <SchoolsList schools={schools} />
          </section>
        </div>
      )}
    </ConsoleShell>
  );
}

export default function AdminPage() {
  return (
    <RoleGate role="admin">
      <AdminDashboard />
    </RoleGate>
  );
}
