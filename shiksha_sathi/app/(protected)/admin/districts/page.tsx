"use client";

import { RoleGate } from "@/components/auth/role-gate";
import { AdminShell } from "@/components/admin/admin-shell";
import { DistrictsTable } from "@/components/admin/districts-table";

export default function AdminDistrictsPage() {
  return (
    <RoleGate role="admin">
      <AdminShell
        title="Districts"
        description="How each district is doing. Click one to see its schools."
      >
        <DistrictsTable />
      </AdminShell>
    </RoleGate>
  );
}
