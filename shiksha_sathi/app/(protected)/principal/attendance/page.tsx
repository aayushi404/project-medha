"use client";

import { useLocale } from "@/lib/copy";
import { RoleGate } from "@/components/auth/role-gate";
import { AttendanceOverview } from "@/components/principal/attendance-overview";
import { PrincipalShell } from "@/components/principal/principal-shell";

function PrincipalAttendancePageContent() {
  const { locale } = useLocale();
  const isHi = locale === "hi";

  return (
    <PrincipalShell activeId="principal-attendance-full">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-8 space-y-4">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">
            {isHi ? "उपस्थिति" : "Attendance"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isHi
              ? "हर कक्षा की वास्तविक उपस्थिति देखें, दिनांक बदलकर पिछले दिन देखें"
              : "Real attendance for every class, any day — switch the date to look back"}
          </p>
        </div>
        <AttendanceOverview />
      </div>
    </PrincipalShell>
  );
}

export default function PrincipalAttendancePage() {
  return (
    <RoleGate role={["principal"]}>
      <PrincipalAttendancePageContent />
    </RoleGate>
  );
}
