"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  Loader2,
  Search,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";

import {
  getClassSection,
  getPrincipalTeachers,
  getSectionRoster,
  getSectionTeachingAssignments,
  getSubjects,
  setSubjectTeacher,
  updateClassSection,
  type ClassSectionSummary,
  type RosterStudentItem,
  type Subject,
  type TeacherRosterItem,
  type TeachingAssignment,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/copy";
import { Button } from "@/components/ui/button";
import { ProfileImage } from "@/components/ui/profile-image";
import { TeacherAssignmentDrawer } from "@/components/principal/teacher-assignment-drawer";

/** The principal's "Class Section Management" workspace for one class:
 * overview, class teacher, subject teachers, then the student roster --
 * replaces the old bare class-teacher dropdown + a disconnected assignment
 * dialog with one page and one reusable assignment drawer. */
export function ClassDetail({ sectionId }: { sectionId: string }) {
  const { accessToken } = useAuth();
  const { locale } = useLocale();
  const isHi = locale === "hi";

  const [section, setSection] = useState<ClassSectionSummary | null>(null);
  const [sectionError, setSectionError] = useState(false);
  const [roster, setRoster] = useState<RosterStudentItem[] | null>(null);
  const [teachers, setTeachers] = useState<TeacherRosterItem[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [assignments, setAssignments] = useState<TeachingAssignment[] | null>(null);
  const [query, setQuery] = useState("");
  const [classTeacherDrawerOpen, setClassTeacherDrawerOpen] = useState(false);
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);

  function loadSection() {
    if (!accessToken) return;
    getClassSection(accessToken, sectionId)
      .then(setSection)
      .catch((e: unknown) => {
        setSectionError(true);
        toast.error(e instanceof Error ? e.message : "Could not load this class.");
      });
  }

  function reloadTeachers() {
    // Workload counts / "class teacher of" flags shift after any assignment
    // change (this section's or another's, via the auto-unassign rule), so
    // refresh the whole roster rather than patch one row.
    if (!accessToken) return;
    getPrincipalTeachers(accessToken).then(setTeachers).catch(() => {});
  }

  function loadAssignments() {
    if (!accessToken) return;
    getSectionTeachingAssignments(accessToken, sectionId)
      .then(setAssignments)
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not load subject teachers."));
  }

  useEffect(() => {
    if (!accessToken) return;
    loadSection();
    getSectionRoster(accessToken, sectionId)
      .then(setRoster)
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not load roster."));
    reloadTeachers();
    getSubjects().then(setSubjects).catch(() => {});
    loadAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, sectionId]);

  async function pickClassTeacher(teacherId: string | null) {
    if (!section) return;
    const teacherName = teacherId ? teachers.find((t) => t.id === teacherId)?.full_name : null;
    try {
      const updated = await updateClassSection(accessToken, sectionId, { class_teacher_id: teacherId });
      setSection(updated);
      reloadTeachers();
      toast.success(
        teacherName
          ? `${teacherName} is now the class teacher of ${section.grade_label} · ${section.section}.`
          : "Class teacher removed.",
      );
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Couldn't update the class teacher. Please try again.",
      );
      throw e;
    }
  }

  async function pickSubjectTeacher(subjectId: string, teacherId: string | null) {
    if (!section) return;
    const subject = subjects.find((s) => s.id === subjectId);
    const teacherName = teacherId ? teachers.find((t) => t.id === teacherId)?.full_name : null;
    try {
      const updated = await setSubjectTeacher(accessToken, sectionId, subjectId, teacherId);
      setAssignments(updated);
      reloadTeachers();
      toast.success(
        teacherName && subject
          ? `${teacherName} is now teaching ${subject.name} in ${section.grade_label} · ${section.section}.`
          : `${subject?.name ?? "Subject"} is now unassigned.`,
      );
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Couldn't update the subject teacher. Please try again.",
      );
      throw e;
    }
  }

  const filteredRoster = useMemo(() => {
    if (!roster) return roster;
    const q = query.trim().toLowerCase();
    if (!q) return roster;
    return roster.filter(
      (s) => s.full_name.toLowerCase().includes(q) || String(s.roll_number ?? "").includes(q),
    );
  }, [roster, query]);

  const classTeacher = useMemo(
    () => (section?.class_teacher_id ? teachers.find((t) => t.id === section.class_teacher_id) ?? null : null),
    [section, teachers],
  );

  const assignedSubjectsCount = assignments?.length ?? 0;
  const teachersInvolvedCount = useMemo(() => {
    const ids = new Set((assignments ?? []).map((a) => a.teacher_id));
    if (section?.class_teacher_id) ids.add(section.class_teacher_id);
    return ids.size;
  }, [assignments, section]);

  if (sectionError) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-sm text-muted-foreground">
          {isHi ? "यह कक्षा नहीं मिली।" : "This class couldn't be found."}
        </p>
        <Link href="/principal/classes" className="text-xs font-medium text-terracotta hover:underline">
          {isHi ? "कक्षाओं पर वापस जाएं" : "Back to Classes"}
        </Link>
      </div>
    );
  }

  if (section === null) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/principal/classes"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={isHi ? "वापस" : "Back to Classes"}
          >
            <ChevronLeft className="size-4" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              {section.grade_label} · {section.section}
            </h1>
            <p className="text-xs text-muted-foreground">
              {section.student_count} {isHi ? "छात्र" : section.student_count === 1 ? "student" : "students"}
              {" · "}
              {isHi ? "शैक्षणिक सत्र" : "Academic year"} {section.academic_year_label}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            document.getElementById("subject-teachers")?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
        >
          <Settings2 className="size-3.5" /> {isHi ? "असाइनमेंट प्रबंधित करें" : "Manage assignments"}
        </Button>
      </div>

      {/* Overview */}
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-3 gap-3">
          <OverviewCard label={isHi ? "छात्र" : "Students"} value={section.student_count} />
          <OverviewCard label={isHi ? "विषय" : "Subjects"} value={subjects.length} />
          <OverviewCard label={isHi ? "शिक्षक" : "Teachers"} value={teachersInvolvedCount} />
        </div>
        {subjects.length > 0 && (
          <div
            className={
              assignedSubjectsCount === subjects.length
                ? "flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400"
                : "flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400"
            }
          >
            {assignedSubjectsCount === subjects.length ? (
              <>
                <CheckCircle2 className="size-3.5" />
                {isHi ? "सभी विषय असाइन किए गए" : "All subjects assigned"}
              </>
            ) : (
              <>
                <AlertTriangle className="size-3.5" />
                {assignedSubjectsCount}/{subjects.length}{" "}
                {isHi
                  ? "विषय असाइन किए गए"
                  : `subjects assigned — ${subjects.length - assignedSubjectsCount} ${
                      subjects.length - assignedSubjectsCount === 1 ? "subject needs" : "subjects need"
                    } a teacher`}
              </>
            )}
          </div>
        )}
      </div>

      {/* Class teacher */}
      <div className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">{isHi ? "कक्षा शिक्षक" : "Class teacher"}</h2>
          <Button size="sm" variant="outline" onClick={() => setClassTeacherDrawerOpen(true)}>
            {classTeacher ? (isHi ? "बदलें" : "Change") : isHi ? "असाइन करें" : "Assign teacher"}
          </Button>
        </div>

        {classTeacher ? (
          <div className="flex items-center gap-3">
            <Link href={`/principal/teachers/${classTeacher.id}`} className="shrink-0">
              <ProfileImage url={classTeacher.photo_url} name={classTeacher.full_name} size="lg" />
            </Link>
            <div className="min-w-0 flex-1">
              <Link
                href={`/principal/teachers/${classTeacher.id}`}
                className="truncate text-sm font-semibold text-foreground hover:underline"
              >
                {classTeacher.full_name}
              </Link>
              <p className="truncate text-xs text-muted-foreground">
                {classTeacher.primary_subject_name ?? "—"}
              </p>
              <p className="text-xs text-muted-foreground">
                {isHi ? "कक्षा शिक्षक" : "Class teacher"} · {section.grade_label} · {section.section}
              </p>
              <Link
                href={`/principal/teachers/${classTeacher.id}`}
                className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-terracotta hover:underline"
              >
                {isHi ? "शिक्षक प्रोफ़ाइल देखें" : "View teacher profile"} <ArrowRight className="size-3" />
              </Link>
            </div>
          </div>
        ) : (
          <p className="py-2 text-sm text-muted-foreground">
            {isHi ? "अभी कोई कक्षा शिक्षक नहीं है।" : "No class teacher assigned."}
          </p>
        )}
      </div>

      {/* Subject teachers */}
      <div id="subject-teachers" className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            {isHi ? "विषय शिक्षक" : "Subject teachers"}
          </h2>
          {subjects.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {subjects.length} {isHi ? "विषय" : "subjects"} · {assignedSubjectsCount} {isHi ? "असाइन" : "assigned"}
            </span>
          )}
        </div>

        {assignments === null ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : subjects.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {isHi ? "कोई विषय उपलब्ध नहीं है।" : "No subjects available."}
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {subjects.map((subject) => {
              const assignment = assignments.find((a) => a.subject_id === subject.id);
              const teacher = assignment ? teachers.find((t) => t.id === assignment.teacher_id) : null;
              return (
                <li key={subject.id} className="flex items-center gap-3 py-2.5">
                  <span className="w-28 shrink-0 truncate text-sm font-medium text-foreground sm:w-36">
                    {subject.name}
                  </span>
                  <div className="min-w-0 flex-1">
                    {teacher ? (
                      <Link
                        href={`/principal/teachers/${teacher.id}`}
                        className="flex min-w-0 items-center gap-2 hover:underline"
                      >
                        <ProfileImage url={teacher.photo_url} name={teacher.full_name} size="sm" />
                        <span className="truncate text-sm text-foreground">{teacher.full_name}</span>
                      </Link>
                    ) : (
                      <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                        — {isHi ? "अनसाइन्ड" : "Unassigned"}
                      </span>
                    )}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setActiveSubjectId(subject.id)}>
                    {teacher ? (isHi ? "बदलें" : "Change") : isHi ? "असाइन करें" : "Assign"}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Students */}
      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
        <div className="flex items-center justify-between border-b border-border p-3">
          <h2 className="text-sm font-semibold text-foreground">{isHi ? "छात्र" : "Students"}</h2>
          <span className="text-xs text-muted-foreground">{section.student_count}</span>
        </div>
        <div className="border-b border-border p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isHi ? "नाम या रोल नंबर से खोजें…" : "Search by name or roll number…"}
              className="h-9 w-full rounded-lg border border-border bg-background pr-3 pl-8 text-sm outline-none focus:border-ring"
            />
          </div>
        </div>

        {filteredRoster === null ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : filteredRoster.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {roster && roster.length > 0
              ? isHi
                ? "कोई मेल खाता छात्र नहीं मिला।"
                : "No students match your search."
              : isHi
                ? "इस कक्षा में अभी कोई छात्र नहीं है।"
                : "No students are enrolled in this class."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {filteredRoster.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/principal/students/${s.id}`}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/50"
                >
                  <span className="w-6 shrink-0 text-xs text-muted-foreground">{s.roll_number ?? ""}</span>
                  <ProfileImage url={s.photo_url} name={s.full_name} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">{s.full_name}</span>
                  <span className="shrink-0 truncate text-xs text-muted-foreground">{s.guardian_name ?? ""}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <TeacherAssignmentDrawer
        open={classTeacherDrawerOpen}
        onOpenChange={setClassTeacherDrawerOpen}
        title={isHi ? "कक्षा शिक्षक असाइन करें" : "Assign class teacher"}
        subtitle={`${section.grade_label} · ${section.section}`}
        teachers={teachers}
        currentTeacherId={section.class_teacher_id}
        currentSectionId={sectionId}
        mode="class_teacher"
        onPick={pickClassTeacher}
      />

      {activeSubjectId && (
        <TeacherAssignmentDrawer
          key={activeSubjectId}
          open
          onOpenChange={(o) => !o && setActiveSubjectId(null)}
          title={
            isHi
              ? `${subjects.find((s) => s.id === activeSubjectId)?.name ?? ""} शिक्षक असाइन करें`
              : `Assign ${subjects.find((s) => s.id === activeSubjectId)?.name ?? ""} teacher`
          }
          subtitle={`${section.grade_label} · ${section.section}`}
          teachers={teachers}
          currentTeacherId={
            assignments?.find((a) => a.subject_id === activeSubjectId)?.teacher_id ?? null
          }
          currentSectionId={sectionId}
          mode="subject"
          onPick={(teacherId) => pickSubjectTeacher(activeSubjectId, teacherId)}
        />
      )}
    </div>
  );
}

function OverviewCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-card p-4 text-center ring-1 ring-foreground/10">
      <div className="text-2xl font-semibold tabular-nums text-foreground">{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
