"use client";

import { useParams } from "next/navigation";

import { RoleGate } from "@/components/auth/role-gate";
import { AdminShell } from "@/components/admin/admin-shell";
import { SchoolDetail } from "@/components/admin/school-detail";

export default function AdminSchoolDetailPage() {
  const params = useParams<{ id: string }>();
  return (
    <RoleGate role="admin">
      <AdminShell title="School details">
        <SchoolDetail schoolId={params.id} />
      </AdminShell>
    </RoleGate>
  );
}
