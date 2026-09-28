"use client";

import { useParams } from "next/navigation";

import { RoleGate } from "@/components/auth/role-gate";
import { ClassDetail } from "@/components/principal/class-detail";
import { PrincipalShell } from "@/components/principal/principal-shell";

function ClassDetailPageContent() {
  const params = useParams<{ id: string }>();
  const sectionId = params.id;

  return (
    <PrincipalShell activeId="principal-classes">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-8">
        <ClassDetail sectionId={sectionId} />
      </div>
    </PrincipalShell>
  );
}

export default function PrincipalClassDetailPage() {
  return (
    <RoleGate role={["principal"]}>
      <ClassDetailPageContent />
    </RoleGate>
  );
}
