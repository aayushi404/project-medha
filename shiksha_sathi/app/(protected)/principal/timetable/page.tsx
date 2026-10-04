"use client";

import { useLocale } from "@/lib/copy";
import { RoleGate } from "@/components/auth/role-gate";
import { PrincipalShell } from "@/components/principal/principal-shell";
import { TimetablePlanner } from "@/components/principal/planner/timetable-planner";

function TimetablePageContent() {
  const { locale } = useLocale();
  const isHi = locale === "hi";

  return (
    <PrincipalShell activeId="principal-timetable">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 space-y-4">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">
            {isHi ? "समय-सारणी" : "Timetable"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isHi
              ? "हर दिन के लिए कालांश, विषय और शिक्षक तय करें"
              : "Set the subject and teacher for every period, class by class, day by day"}
          </p>
        </div>
        <TimetablePlanner />
      </div>
    </PrincipalShell>
  );
}

export default function PrincipalTimetablePage() {
  return (
    <RoleGate role={["principal"]}>
      <TimetablePageContent />
    </RoleGate>
  );
}
