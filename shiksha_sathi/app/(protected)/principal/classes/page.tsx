"use client";

import { useLocale } from "@/lib/copy";
import { RoleGate } from "@/components/auth/role-gate";
import { ClassesList } from "@/components/principal/classes-list";
import { PrincipalShell } from "@/components/principal/principal-shell";

function ClassesPageContent() {
  const { locale } = useLocale();
  const isHi = locale === "hi";

  return (
    <PrincipalShell activeId="principal-classes">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-8 space-y-4">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">
            {isHi ? "कक्षाएँ" : "Classes"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isHi
              ? "शैक्षणिक सत्र चुनें, कक्षाएँ देखें और नई कक्षा जोड़ें"
              : "Pick an academic year, browse its classes, and add new ones"}
          </p>
        </div>
        <ClassesList />
      </div>
    </PrincipalShell>
  );
}

export default function PrincipalClassesPage() {
  return (
    <RoleGate role={["principal"]}>
      <ClassesPageContent />
    </RoleGate>
  );
}
