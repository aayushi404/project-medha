"use client";

import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/copy";
import { RoleGate } from "@/components/auth/role-gate";
import { PrincipalShell } from "@/components/principal/principal-shell";
import { StudentImportDialog } from "@/components/principal/student-import-dialog";
import { AdmitStudentForm } from "@/components/principal/admission/admit-student-form";
import { StudentSearch } from "@/components/principal/admission/student-search";

function AdmissionPageContent() {
  const { accessToken } = useAuth();
  const { locale } = useLocale();
  const isHi = locale === "hi";

  return (
    <PrincipalShell activeId="principal-admission">
      <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">
              {isHi ? "प्रवेश" : "Admission"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isHi
                ? "विद्यार्थी का प्रवेश करें या किसी भी विद्यार्थी का प्रोफ़ाइल खोजें"
                : "Admit a student, or find any student's profile"}
            </p>
          </div>
          <StudentImportDialog token={accessToken} onImported={() => {}} />
        </div>

        <section aria-labelledby="admit-title" className="rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6">
          <div className="mb-5">
            <h2 id="admit-title" className="text-sm font-semibold text-foreground">
              {isHi ? "एक विद्यार्थी का प्रवेश" : "Admit a student"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {isHi
                ? "प्रवेश तुरंत स्वीकृत होता है। विद्यार्थी फ़ोन नंबर और पासवर्ड से लॉग इन करता है।"
                : "Approved straight away. The student logs in with the phone number and password you set."}
            </p>
          </div>
          <AdmitStudentForm token={accessToken} />
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6">
          <StudentSearch token={accessToken} />
        </section>
      </div>
    </PrincipalShell>
  );
}

export default function PrincipalAdmissionPage() {
  return (
    <RoleGate role={["principal"]}>
      <AdmissionPageContent />
    </RoleGate>
  );
}
