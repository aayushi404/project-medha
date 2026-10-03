"use client";

import { RoleGate } from "@/components/auth/role-gate";
import { ActivityFeed } from "@/components/admin/activity-feed";
import { AdminShell } from "@/components/admin/admin-shell";

export default function AdminActivityPage() {
  return (
    <RoleGate role="admin">
      <AdminShell
        title="Activity log"
        description="Every approval, rejection and revocation across all schools."
      >
        <ActivityFeed limit={100} />
      </AdminShell>
    </RoleGate>
  );
}
