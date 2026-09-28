"use client";

import { useParams } from "next/navigation";

import { RoleGate } from "@/components/auth/role-gate";
import { PrincipalShell } from "@/components/principal/principal-shell";
import { StudentDetail } from "@/components/principal/student-detail";

function StudentDetailPageContent() {
  const params = useParams<{ id: string }>();

  return (
    <PrincipalShell activeId="principal-students">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-8">
        <StudentDetail studentId={params.id} />
      </div>
    </PrincipalShell>
  );
}

export default function PrincipalStudentDetailPage() {
  return (
    <RoleGate role={["principal"]}>
      <StudentDetailPageContent />
    </RoleGate>
  );
}
