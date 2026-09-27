"use client";

import { useLocale } from "@/lib/copy";
import { RoleGate } from "@/components/auth/role-gate";
import { PrincipalProfileForm } from "@/components/principal/principal-profile-form";
import { PrincipalShell } from "@/components/principal/principal-shell";

function PrincipalProfilePageContent() {
  const { locale } = useLocale();
  const isHi = locale === "hi";

  return (
    <PrincipalShell activeId="principal-profile">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-8">
        <h1 className="mb-6 font-serif text-2xl font-bold tracking-tight text-foreground">
          {isHi ? "अपनी प्रोफ़ाइल संपादित करें" : "Edit your profile"}
        </h1>
        <PrincipalProfileForm />
      </div>
    </PrincipalShell>
  );
}

export default function PrincipalProfilePage() {
  return (
    <RoleGate role={["principal"]}>
      <PrincipalProfilePageContent />
    </RoleGate>
  );
}
