"use client";

import { useParams } from "next/navigation";

import { RoleGate } from "@/components/auth/role-gate";
import { PrincipalShell } from "@/components/principal/principal-shell";
import { StudentProfileView } from "@/components/students/student-profile";

function StudentDetailPageContent() {
  const params = useParams<{ id: string }>();

  return (
    <PrincipalShell activeId="principal-admission">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-8">
        <StudentProfileView studentId={params.id} backHref="/principal" />
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
