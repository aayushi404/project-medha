"use client";

import { RoleGate } from "@/components/auth/role-gate";
import { AdminShell } from "@/components/admin/admin-shell";
import { PrincipalsManager } from "@/components/admin/principals-manager";

export default function AdminPrincipalsPage() {
  return (
    <RoleGate role="admin">
      <AdminShell
        title="Principals"
        description="Review applications, and revoke access when a principal leaves a school."
      >
        <PrincipalsManager />
      </AdminShell>
    </RoleGate>
  );
}
