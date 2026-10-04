"use client";

import { useLocale } from "@/lib/copy";
import { RoleGate } from "@/components/auth/role-gate";
import { CoverBoard } from "@/components/principal/cover/cover-board";
import { PrincipalShell } from "@/components/principal/principal-shell";

function CoverPageContent() {
  const { locale } = useLocale();
  const isHi = locale === "hi";

  return (
    <PrincipalShell activeId="principal-cover">
      <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-6 sm:px-8">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">
            {isHi ? "आज का कवर" : "Daily cover"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isHi
              ? "अनुपस्थित शिक्षकों के कालांश, और उनके लिए कौन पढ़ाएगा"
              : "Who is absent, which periods need cover, and who covers them"}
          </p>
        </div>
        <CoverBoard />
      </div>
    </PrincipalShell>
  );
}

export default function PrincipalCoverPage() {
  return (
    <RoleGate role={["principal"]}>
      <CoverPageContent />
    </RoleGate>
  );
}
