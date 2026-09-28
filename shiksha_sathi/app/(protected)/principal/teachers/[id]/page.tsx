"use client";

import { useParams } from "next/navigation";

import { RoleGate } from "@/components/auth/role-gate";
import { PrincipalShell } from "@/components/principal/principal-shell";
import { TeacherDetail } from "@/components/principal/teacher-detail";

function TeacherDetailPageContent() {
  const params = useParams<{ id: string }>();

  return (
    <PrincipalShell activeId="principal-teachers">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-8">
        <TeacherDetail teacherId={params.id} />
      </div>
    </PrincipalShell>
  );
}

export default function PrincipalTeacherDetailPage() {
  return (
    <RoleGate role={["principal"]}>
      <TeacherDetailPageContent />
    </RoleGate>
  );
}
