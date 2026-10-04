"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronLeft, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import {
  addReserveTeacher,
  getReserveTeachers,
  removeReserveTeacher,
  getClassSection,
  getPrincipalTeachers,
  getSectionRoster,
  getSectionTeachingAssignments,
  getSubjects,
  setSubjectTeacher,
  updateClassSection,
  type ClassSectionSummary,
  type ReserveTeacher,
  type RosterStudentItem,
  type Subject,
  type TeacherRosterItem,
  type TeachingAssignment,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/copy";
import { Button } from "@/components/ui/button";
import { ProfileImage } from "@/components/ui/profile-image";
import { TeacherPickerSheet, type PickerOption } from "@/components/principal/teacher-picker-sheet";

/** One class, one screen: who is the class teacher, which teacher takes each
 * subject, and the students. The class teacher can only be someone who already
 * teaches a subject in this class, so the picker lists exactly those people. */
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
  const [classTeacherOpen, setClassTeacherOpen] = useState(false);
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);
  const [reserves, setReserves] = useState<ReserveTeacher[]>([]);
  const [reserveOpen, setReserveOpen] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    getClassSection(accessToken, sectionId)
      .then(setSection)
      .catch((e: unknown) => {
        setSectionError(true);
        toast.error(e instanceof Error ? e.message : "Could not load this class.");
      });
    getSectionRoster(accessToken, sectionId)
      .then(setRoster)
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not load roster."));
    getPrincipalTeachers(accessToken).then(setTeachers).catch(() => {});
    getSubjects().then(setSubjects).catch(() => {});
    getReserveTeachers(accessToken, sectionId).then(setReserves).catch(() => {});
    getSectionTeachingAssignments(accessToken, sectionId)
      .then(setAssignments)
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not load subject teachers."));
  }, [accessToken, sectionId]);

  function refreshTeachers() {
    if (accessToken) getPrincipalTeachers(accessToken).then(setTeachers).catch(() => {});
  }

  const teacherById = useMemo(() => new Map(teachers.map((t) => [t.id, t])), [teachers]);
  const label = section ? `${section.grade_label} · ${section.section}` : "";

  // Teachers who teach something in this class, with the subjects they teach here.
  const taughtHere = useMemo(() => {
    const byTeacher = new Map<string, { teacher: TeacherRosterItem | undefined; subjects: string[] }>();
    for (const a of assignments ?? []) {
      const entry = byTeacher.get(a.teacher_id) ?? { teacher: teacherById.get(a.teacher_id), subjects: [] };
      entry.subjects.push(a.subject_name);
      byTeacher.set(a.teacher_id, entry);
    }
    return byTeacher;
  }, [assignments, teacherById]);

  const classTeacherId = section?.class_teacher_id ?? null;
  const classTeacher = classTeacherId ? teacherById.get(classTeacherId) ?? null : null;
  const classTeacherTeachesHere = classTeacherId ? taughtHere.has(classTeacherId) : false;
  const classTeacherSubjects = classTeacherId ? taughtHere.get(classTeacherId)?.subjects ?? [] : [];

  const assignedCount = assignments?.length ?? 0;
  const subjectCount = subjects.length;

  async function pickClassTeacher(teacherId: string | null) {
    try {
      const updated = await updateClassSection(accessToken, sectionId, { class_teacher_id: teacherId });
      setSection(updated);
      refreshTeachers();
      const name = teacherId ? teacherById.get(teacherId)?.full_name : null;
      toast.success(name ? `${name} is now the class teacher of ${label}.` : "Class teacher removed.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update the class teacher.");
      throw e;
    }
  }

  async function pickSubjectTeacher(subjectId: string, teacherId: string | null) {
    const subject = subjects.find((s) => s.id === subjectId);
    try {
      const updated = await setSubjectTeacher(accessToken, sectionId, subjectId, teacherId);
      setAssignments(updated);
      refreshTeachers();
      // a subject change can release the class teacher seat, so reload the class too
      getClassSection(accessToken, sectionId).then(setSection).catch(() => {});
      const name = teacherId ? teacherById.get(teacherId)?.full_name : null;
      toast.success(
        name && subject
          ? `${name} now teaches ${subject.name} in ${label}.`
          : `${subject?.name ?? "Subject"} is now unassigned.`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update the subject teacher.");
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

  const classTeacherOptions: PickerOption[] = [...taughtHere.entries()]
    .filter(([, v]) => v.teacher)
    .map(([id, v]) => {
      const t = v.teacher!;
      const elsewhere =
        t.class_teacher_of_section_id && t.class_teacher_of_section_id !== sectionId
          ? `Class teacher of ${t.class_teacher_of_label} — moves here`
          : null;
      return {
        id,
        name: t.full_name,
        photoUrl: t.photo_url,
        detail: v.subjects.join(", "),
        note: elsewhere,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const reserveIds = new Set(reserves.map((r) => r.teacher_id));
  const reserveOptions: PickerOption[] = teachers
    .filter((t) => !reserveIds.has(t.id))
    .map((t) => ({
      id: t.id,
      name: t.full_name,
      photoUrl: t.photo_url,
      detail: t.primary_subject_name ?? (isHi ? "विषय तय नहीं" : "No subject set"),
      note: t.classes_count >= 5 ? `${isHi ? "पहले से" : "Already teaches"} ${t.classes_count} ${isHi ? "कक्षाएँ" : "classes"}` : null,
    }));

  async function addReserve(teacherId: string | null) {
    if (!teacherId) return;
    try {
      setReserves(await addReserveTeacher(accessToken, sectionId, teacherId));
      refreshTeachers();
      toast.success(isHi ? "आरक्षित शिक्षक जोड़ा गया।" : "Reserve teacher added.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't add the reserve teacher.");
      throw e;
    }
  }

  async function dropReserve(teacherId: string) {
    try {
      setReserves(await removeReserveTeacher(accessToken, sectionId, teacherId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't remove the reserve teacher.");
    }
  }

  const activeSubject = subjects.find((s) => s.id === activeSubjectId) ?? null;
  const subjectOptions: PickerOption[] = teachers.map((t) => ({
    id: t.id,
    name: t.full_name,
    photoUrl: t.photo_url,
    detail: t.primary_subject_name ?? (isHi ? "विषय तय नहीं" : "No subject set"),
    note:
      t.class_teacher_of_section_id && t.class_teacher_of_section_id !== sectionId
        ? `Class teacher of ${t.class_teacher_of_label}`
        : null,
  }));

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/principal/classes"
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={isHi ? "वापस" : "Back to Classes"}
        >
          <ChevronLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-foreground">{label}</h1>
          <p className="text-xs text-muted-foreground">
            {section.student_count}{" "}
            {isHi ? "छात्र" : section.student_count === 1 ? "student" : "students"} · {section.academic_year_label}
          </p>
        </div>
      </div>

      {/* Class teacher */}
      <section className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">{isHi ? "कक्षा शिक्षक" : "Class teacher"}</h2>
            <p className="text-xs text-muted-foreground">
              {isHi
                ? "केवल वे शिक्षक जो इस कक्षा में कोई विषय पढ़ाते हैं"
                : "Only teachers who teach a subject in this class"}
            </p>
          </div>
          <Button size="sm" variant={classTeacher ? "outline" : "default"} onClick={() => setClassTeacherOpen(true)}>
            {classTeacher ? (isHi ? "बदलें" : "Change") : isHi ? "चुनें" : "Choose"}
          </Button>
        </div>

        {classTeacher ? (
          <div className="mt-4 flex items-center gap-3">
            <ProfileImage url={classTeacher.photo_url} name={classTeacher.full_name} size="lg" />
            <div className="min-w-0">
              <Link href={`/principal/teachers/${classTeacher.id}`} className="block truncate text-sm font-semibold text-foreground hover:underline">
                {classTeacher.full_name}
              </Link>
              <p className="truncate text-xs text-muted-foreground">
                {isHi ? "पढ़ाते हैं" : "Teaches"}: {classTeacherSubjects.join(", ") || "—"}
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            {isHi ? "अभी कोई कक्षा शिक्षक नहीं है।" : "No class teacher yet."}
          </p>
        )}

        {classTeacher && !classTeacherTeachesHere ? (
          <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
            <AlertTriangle className="size-3.5 shrink-0" />
            {isHi
              ? "यह शिक्षक इस कक्षा में कोई विषय नहीं पढ़ाते। नया कक्षा शिक्षक चुनें।"
              : "This teacher doesn't teach any subject in this class. Choose another class teacher."}
          </p>
        ) : null}
      </section>

      {/* Subjects */}
      <section id="subject-teachers" className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">{isHi ? "विषय और शिक्षक" : "Subjects and teachers"}</h2>
          {assignments !== null ? (
            <span className="text-xs font-medium text-muted-foreground">
              {assignedCount}/{subjectCount} {isHi ? "असाइन" : "assigned"}
            </span>
          ) : null}
        </div>
        {assignments !== null && subjectCount > 0 ? (
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.round((assignedCount / subjectCount) * 100)}%` }}
            />
          </div>
        ) : null}

        {assignments === null ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : subjects.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {isHi ? "कोई विषय उपलब्ध नहीं है।" : "No subjects available."}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {subjects.map((subject) => {
              const assignment = assignments.find((a) => a.subject_id === subject.id);
              const teacher = assignment ? teacherById.get(assignment.teacher_id) : undefined;
              return (
                <li key={subject.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{subject.name}</p>
                    {assignment ? (
                      <p className="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                        <ProfileImage url={teacher?.photo_url ?? null} name={assignment.teacher_name} size="sm" />
                        <span className="truncate">{assignment.teacher_name}</span>
                      </p>
                    ) : (
                      <p className="mt-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                        {isHi ? "शिक्षक नहीं चुना गया" : "No teacher yet"}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant={assignment ? "outline" : "default"}
                    onClick={() => setActiveSubjectId(subject.id)}
                  >
                    {assignment ? (isHi ? "बदलें" : "Change") : isHi ? "चुनें" : "Choose"}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Reserve teachers: on standby for any period in this class */}
      <section className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">{isHi ? "आरक्षित शिक्षक" : "Reserve teachers"}</h2>
            <p className="text-xs text-muted-foreground">
              {isHi
                ? "किसी शिक्षक के अनुपस्थित होने पर इस कक्षा के किसी भी कालांश में कवर करेंगे"
                : "Cover any period in this class when a teacher is absent"}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setReserveOpen(true)}>
            {isHi ? "जोड़ें" : "Add"}
          </Button>
        </div>
        {reserves.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">{isHi ? "अभी कोई आरक्षित शिक्षक नहीं।" : "No reserve teachers yet."}</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {reserves.map((r) => (
              <li key={r.teacher_id} className="flex items-center gap-3 py-2.5">
                <ProfileImage url={r.photo_url} name={r.full_name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{r.full_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.primary_subject_name ?? (isHi ? "विषय तय नहीं" : "No subject set")} · {r.classes_count}{" "}
                    {isHi ? "कक्षाएँ" : r.classes_count === 1 ? "class" : "classes"}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => dropReserve(r.teacher_id)}>
                  {isHi ? "हटाएँ" : "Remove"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Students */}
      <section className="rounded-xl bg-card ring-1 ring-foreground/10">
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
              ? isHi ? "कोई मेल खाता छात्र नहीं मिला।" : "No students match your search."
              : isHi ? "इस कक्षा में अभी कोई छात्र नहीं है।" : "No students are enrolled in this class."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {filteredRoster.map((s) => (
              <li key={s.id}>
                <Link href={`/principal/students/${s.id}`} className="flex w-full items-center gap-3 px-4 py-2.5 hover:bg-muted/50">
                  <span className="w-6 shrink-0 text-xs text-muted-foreground">{s.roll_number ?? ""}</span>
                  <ProfileImage url={s.photo_url} name={s.full_name} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">{s.full_name}</span>
                  <span className="shrink-0 truncate text-xs text-muted-foreground">{s.guardian_name ?? ""}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <TeacherPickerSheet
        open={reserveOpen}
        onOpenChange={setReserveOpen}
        title={isHi ? "आरक्षित शिक्षक जोड़ें" : "Add reserve teacher"}
        subtitle={label}
        options={reserveOptions}
        currentId={null}
        emptyText={isHi ? "जोड़ने के लिए कोई शिक्षक नहीं बचा।" : "Everyone is already a reserve here."}
        unassignLabel={null}
        onPick={addReserve}
      />

      <TeacherPickerSheet
        open={classTeacherOpen}
        onOpenChange={setClassTeacherOpen}
        title={isHi ? "कक्षा शिक्षक चुनें" : "Choose class teacher"}
        subtitle={label}
        options={classTeacherOptions}
        currentId={classTeacherId}
        emptyText={
          isHi
            ? "इस कक्षा में अभी कोई शिक्षक विषय नहीं पढ़ाता। पहले नीचे विषय के शिक्षक चुनें।"
            : "No one teaches a subject in this class yet. Choose subject teachers below first."
        }
        unassignLabel={isHi ? "कक्षा शिक्षक हटाएँ" : "Remove class teacher"}
        onPick={pickClassTeacher}
      />

      {activeSubject ? (
        <TeacherPickerSheet
          key={activeSubject.id}
          open
          onOpenChange={(o) => !o && setActiveSubjectId(null)}
          title={isHi ? `${activeSubject.name} के शिक्षक चुनें` : `Choose ${activeSubject.name} teacher`}
          subtitle={label}
          options={subjectOptions}
          currentId={assignments?.find((a) => a.subject_id === activeSubject.id)?.teacher_id ?? null}
          emptyText={isHi ? "इस विद्यालय में कोई शिक्षक नहीं है।" : "No approved teachers at this school yet."}
          unassignLabel={isHi ? "विषय से शिक्षक हटाएँ" : "Remove teacher from this subject"}
          onPick={(teacherId) => pickSubjectTeacher(activeSubject.id, teacherId)}
        />
      ) : null}
    </div>
  );
}
