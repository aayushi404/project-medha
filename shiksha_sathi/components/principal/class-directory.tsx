"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { ChevronLeft, Loader2, Phone, User } from "lucide-react";
import { toast } from "sonner";

import {
  getClassSections,
  getSectionRoster,
  getStudentProfile,
  type ClassSectionSummary,
  type RosterStudentItem,
  type StudentProfile,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/copy";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function ClassDirectory() {
  const { accessToken } = useAuth();
  const { locale } = useLocale();
  const isHi = locale === "hi";

  const [sections, setSections] = useState<ClassSectionSummary[] | null>(null);
  const [activeSection, setActiveSection] = useState<ClassSectionSummary | null>(null);
  const [roster, setRoster] = useState<RosterStudentItem[] | null>(null);

  const [profileId, setProfileId] = useState<string | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    getClassSections(accessToken)
      .then((r) => active && setSections(r))
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not load classes."));
    return () => {
      active = false;
    };
  }, [accessToken]);

  function openSection(section: ClassSectionSummary) {
    setActiveSection(section);
    setRoster(null);
    getSectionRoster(accessToken, section.id)
      .then(setRoster)
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not load roster."));
  }

  function openProfile(studentId: string) {
    setProfileId(studentId);
    setProfile(null);
    getStudentProfile(accessToken, studentId)
      .then(setProfile)
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not load student."));
  }

  if (sections === null) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <p className="rounded-xl bg-card p-6 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
        {isHi ? "अभी कोई कक्षा नहीं जोड़ी गई है।" : "No classes set up yet."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {!activeSection ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => openSection(s)}
              className="rounded-xl bg-card p-4 text-left ring-1 ring-foreground/10 transition-colors hover:ring-terracotta/40"
            >
              <div className="text-sm font-medium text-foreground">
                {s.grade_label} · {s.section}
              </div>
              <div className="mt-1.5 text-xs text-muted-foreground">
                {s.student_count} {isHi ? "छात्र" : s.student_count === 1 ? "student" : "students"}
              </div>
              {s.class_teacher_name && (
                <div className="mt-1 truncate text-xs text-muted-foreground">
                  {s.class_teacher_name}
                </div>
              )}
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-xl bg-card ring-1 ring-foreground/10">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <button
              type="button"
              onClick={() => {
                setActiveSection(null);
                setRoster(null);
              }}
              className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={isHi ? "वापस" : "Back"}
            >
              <ChevronLeft className="size-4" />
            </button>
            <div className="text-sm font-medium text-foreground">
              {activeSection.grade_label} · {activeSection.section}
            </div>
            <div className="text-xs text-muted-foreground">
              {activeSection.student_count} {isHi ? "छात्र" : "students"}
            </div>
          </div>

          {roster === null ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : roster.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              {isHi ? "इस कक्षा में अभी कोई छात्र नहीं है।" : "No students enrolled in this class yet."}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {roster.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => openProfile(s.id)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/50"
                  >
                    <span className="w-6 shrink-0 text-xs text-muted-foreground">
                      {s.roll_number ?? ""}
                    </span>
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-terracotta/15 text-[11px] font-medium text-terracotta">
                      {initials(s.full_name)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                      {s.full_name}
                    </span>
                    <span className="shrink-0 truncate text-xs text-muted-foreground">
                      {s.guardian_name ?? ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Dialog.Root open={profileId !== null} onOpenChange={(open) => !open && setProfileId(null)}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0" />
          <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[min(92vw,380px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-card p-5 shadow-xl ring-1 ring-foreground/10 transition-all data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            {profile === null ? (
              <div className="flex justify-center py-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-terracotta/15 text-sm font-medium text-terracotta">
                    {initials(profile.full_name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Dialog.Title className="truncate text-sm font-medium text-foreground">
                      {profile.full_name}
                    </Dialog.Title>
                    <p className="truncate text-xs text-muted-foreground">
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

                <div className="border-t border-border pt-3">
                  <p className="mb-2 text-xs text-muted-foreground">
                    {isHi ? "नामांकन" : "Enrolment"}
                  </p>
                  <dl className="flex flex-col gap-1.5 text-xs">
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">
                        {isHi ? "प्रवेश संख्या" : "Admission no."}
                      </dt>
                      <dd className="truncate text-foreground">{profile.admission_number ?? "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">{isHi ? "सत्र" : "Academic year"}</dt>
                      <dd className="truncate text-foreground">{profile.academic_year_label ?? "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">{isHi ? "कक्षा शिक्षक" : "Class teacher"}</dt>
                      <dd className="truncate text-foreground">{profile.class_teacher_name ?? "—"}</dd>
                    </div>
                  </dl>
                </div>

                <div className="border-t border-border pt-3">
                  <p className="mb-2 text-xs text-muted-foreground">
                    {isHi ? "अभिभावक" : "Guardian"}
                  </p>
                  <dl className="flex flex-col gap-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <dt className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
                        <User className="size-3.5" /> {isHi ? "नाम" : "Name"}
                      </dt>
                      <dd className="truncate text-foreground">
                        {profile.guardian_name ?? "—"}
                        {profile.guardian_relation ? ` (${profile.guardian_relation})` : ""}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
                        <Phone className="size-3.5" /> {isHi ? "संपर्क" : "Contact"}
                      </dt>
                      <dd className="truncate text-terracotta">{profile.guardian_phone ?? "—"}</dd>
                    </div>
                  </dl>
                </div>

                <button
                  type="button"
                  onClick={() => setProfileId(null)}
                  className="self-end text-xs text-muted-foreground hover:text-foreground"
                >
                  {isHi ? "बंद करें" : "Close"}
                </button>
              </div>
            )}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
