"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { RoleGate } from "@/components/auth/role-gate";
import { AdminShell } from "@/components/admin/admin-shell";
import { SchoolsBrowser } from "@/components/admin/schools-browser";

function SchoolsContent() {
  const districtId = useSearchParams().get("district") ?? undefined;
  return <SchoolsBrowser initialDistrictId={districtId} />;
}

export default function AdminSchoolsPage() {
  return (
    <RoleGate role="admin">
      <AdminShell title="Schools" description="Search every registered school and open its details.">
        <Suspense fallback={null}>
          <SchoolsContent />
        </Suspense>
      </AdminShell>
    </RoleGate>
  );
}
