"use client";

import { RoleGate } from "@/components/auth/role-gate";
import { CoverSheetPage } from "@/components/principal/cover/cover-sheet";

export default function PrincipalCoverPrintPage() {
  return (
    <RoleGate role={["principal"]}>
      <CoverSheetPage />
    </RoleGate>
  );
}
