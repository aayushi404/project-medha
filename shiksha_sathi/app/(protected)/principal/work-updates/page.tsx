"use client";

import { RoleGate } from "@/components/auth/role-gate";
import { PrincipalShell } from "@/components/principal/principal-shell";
import { PrincipalWorkUpdatesHistory } from "@/components/principal/principal-work-updates-history";

function WorkUpdatesPageContent() {
  return (
    <PrincipalShell activeId="principal-work-updates">
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-8">
        <PrincipalWorkUpdatesHistory />
      </div>
    </PrincipalShell>
  );
}

export default function PrincipalWorkUpdatesPage() {
  return (
    <RoleGate role={["principal"]}>
      <WorkUpdatesPageContent />
    </RoleGate>
  );
}
