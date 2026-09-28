"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Loader2, Phone, User } from "lucide-react";
import { toast } from "sonner";

import { getStudentProfile, type StudentProfile } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/copy";
import { ProfileImage } from "@/components/ui/profile-image";

/** A student's full record, read-only from the principal's side -- enrolment,
 * class teacher, and guardian contact. Promoted from what used to be a quick
 * modal (student-profile-dialog.tsx) into a real route so it's linkable and
 * bookmarkable, per the "make a separate route" ask. */
export function StudentDetail({ studentId }: { studentId: string }) {
  const { accessToken } = useAuth();
  const { locale } = useLocale();
  const isHi = locale === "hi";
  const router = useRouter();

  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    getStudentProfile(accessToken, studentId)
      .then(setProfile)
      .catch((e: unknown) => {
        setNotFound(true);
        toast.error(e instanceof Error ? e.message : "Could not load this student.");
      });
  }, [accessToken, studentId]);

  if (notFound) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-sm text-muted-foreground">
          {isHi ? "यह छात्र नहीं मिला।" : "This student couldn't be found."}
        </p>
        <Link href="/principal" className="text-xs font-medium text-terracotta hover:underline">
          {isHi ? "वापस जाएं" : "Back to dashboard"}
        </Link>
      </div>
    );
  }

  if (profile === null) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={isHi ? "वापस" : "Back"}
        >
          <ChevronLeft className="size-4" />
        </button>
        <h1 className="text-lg font-semibold text-foreground">
          {isHi ? "छात्र प्रोफ़ाइल" : "Student Profile"}
        </h1>
      </div>

      <div className="rounded-2xl bg-card p-6 ring-1 ring-foreground/10">
        <div className="flex items-center gap-4">
          <ProfileImage url={profile.photo_url} name={profile.full_name} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-foreground">{profile.full_name}</h2>
            <p className="truncate text-sm text-muted-foreground">
              {profile.grade_label && profile.section
                ? `${profile.grade_label} · ${profile.section}`
                : ""}
              {profile.roll_number ? ` — Roll ${profile.roll_number}` : ""}
            </p>
          </div>
          <span className="shrink-0 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 capitalize dark:text-emerald-400">
            {profile.status}
          </span>
        </div>

        <div className="mt-5 border-t border-border pt-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            {isHi ? "नामांकन" : "Enrolment"}
          </p>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">{isHi ? "प्रवेश संख्या" : "Admission no."}</dt>
              <dd className="text-foreground">{profile.admission_number ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{isHi ? "सत्र" : "Academic year"}</dt>
              <dd className="text-foreground">{profile.academic_year_label ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{isHi ? "कक्षा शिक्षक" : "Class teacher"}</dt>
              <dd className="text-foreground">{profile.class_teacher_name ?? "—"}</dd>
            </div>
          </dl>
        </div>

        <div className="mt-5 border-t border-border pt-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            {isHi ? "अभिभावक" : "Guardian"}
          </p>
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <User className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="text-foreground">
                {profile.guardian_name ?? "—"}
                {profile.guardian_relation ? ` (${profile.guardian_relation})` : ""}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="text-terracotta">{profile.guardian_phone ?? "—"}</span>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
