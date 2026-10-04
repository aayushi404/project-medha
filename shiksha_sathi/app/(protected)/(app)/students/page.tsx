"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import {
  approveStudent,
  getMySections,
  getPendingStudents,
  getStudentRoster,
  rejectStudent,
  type PendingStudent,
  type StudentRosterItem,
  type TeacherSection,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCopy } from "@/lib/copy";
import { ClassChooser } from "@/components/students/class-chooser";
import { PendingStudents } from "@/components/students/pending-students";
import { StudentRoster } from "@/components/students/student-roster";

/**
 * Two steps. With no `?class=` in the URL, the teacher chooses one of their
 * classes. With one, they see that class: waiting registrations first, then
 * the approved students. The class is in the URL, so Back and links behave.
 */
export default function StudentsPage() {
  return (
    <Suspense fallback={null}>
      <StudentsPageContent />
    </Suspense>
  );
}

function StudentsPageContent() {
  const { accessToken } = useAuth();
  const copy = useCopy();
  const router = useRouter();
  const classId = useSearchParams().get("class");

  const [sections, setSections] = useState<TeacherSection[] | null>(null);
  const [pending, setPending] = useState<PendingStudent[]>([]);
  const [roster, setRoster] = useState<StudentRosterItem[]>([]);
  // the class whose lists have finished loading; "loading" is just "not this one yet"
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const classLoading = !!classId && loadedFor !== classId;
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => (sections ?? []).find((s) => s.id === classId) ?? null,
    [sections, classId],
  );

  const loadSections = useCallback(() => {
    if (!accessToken) return Promise.resolve();
    return getMySections(accessToken)
      .then(setSections)
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : copy.students.loadFailed));
  }, [accessToken, copy.students.loadFailed]);

  const loadClass = useCallback(() => {
    if (!accessToken || !classId) return Promise.resolve();
    return Promise.all([getPendingStudents(accessToken, classId), getStudentRoster(accessToken, classId)])
      .then(([p, r]) => {
        setPending(p);
        setRoster(r);
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : copy.students.loadFailed))
      .finally(() => setLoadedFor(classId));
  }, [accessToken, classId, copy.students.loadFailed]);

  useEffect(() => {
    void loadSections();
  }, [loadSections]);

  useEffect(() => {
    if (!classId) return;
    void loadClass();
  }, [classId, loadClass]);

  async function decide(id: string, run: () => Promise<unknown>, ok: string) {
    setBusyId(id);
    try {
      await run();
      toast.success(ok);
      // the class lists and the counts on the chooser both change
      await Promise.all([loadClass(), loadSections()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : copy.students.loadFailed);
      throw e; // keeps the reject dialog open on failure
    } finally {
      setBusyId(null);
    }
  }

  const visibleRoster = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return roster;
    return roster.filter(
      (s) => s.full_name.toLowerCase().includes(q) || String(s.roll_number ?? "").includes(q),
    );
  }, [roster, query]);

  const header = (
    <div className="border-b border-border px-5 py-4">
      {classId ? (
        <button
          type="button"
          onClick={() => router.push("/students")}
          className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-3.5" aria-hidden />
          {copy.students.allClasses}
        </button>
      ) : null}
      <h1 className="text-[15px] font-semibold text-foreground">
        {selected ? `${selected.grade_label} · ${selected.section}` : copy.students.title}
      </h1>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {selected
          ? `${copy.students.studentCount(selected.students)}${selected.pending_students ? ` · ${copy.students.waitingCount(selected.pending_students)}` : ""}`
          : copy.students.subtitle}
      </p>
    </div>
  );

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      {header}

      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          {!classId && (
            <section>
              {sections === null ? (
                <Spinner />
              ) : sections.length === 0 ? (
                <p className="rounded-xl bg-card p-6 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
                  {copy.students.noClasses}
                </p>
              ) : (
                <>
                  <h2 className="mb-3 text-sm font-semibold text-foreground">{copy.students.classesTitle}</h2>
                  <ClassChooser
                    sections={sections}
                    onPick={(s) => {
                      setQuery("");
                      router.push(`/students?class=${s.id}`);
                    }}
                  />
                </>
              )}
            </section>
          )}

          {classId && sections !== null && !selected && (
            <p className="rounded-xl bg-card p-6 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
              {copy.students.notYourClass}
            </p>
          )}

          {classId && selected && classLoading && <Spinner />}

          {classId && selected && !classLoading && (
            <>
              <section>
                <h2 className="mb-3 text-sm font-semibold text-foreground">
                  {copy.students.waiting}
                  {pending.length > 0 && <span className="ml-2 text-amber-700 dark:text-amber-400">{pending.length}</span>}
                </h2>
                <PendingStudents
                  students={pending}
                  profileHref="/students"
                  busyId={busyId}
                  onApprove={(id) => void decide(id, () => approveStudent(accessToken, id), copy.students.approved)}
                  onReject={(id, reason) => decide(id, () => rejectStudent(accessToken, id, reason), copy.students.rejected)}
                />
              </section>

              <section>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-foreground">{copy.students.enrolled}</h2>
                </div>
                {roster.length > 0 && (
                  <label className="mb-3 flex items-center gap-2 rounded-xl bg-card px-3 py-2 ring-1 ring-foreground/10 focus-within:ring-2 focus-within:ring-ring">
                    <Search className="size-4 text-muted-foreground" aria-hidden />
                    <input
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={copy.students.search}
                      className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    />
                  </label>
                )}
                {roster.length === 0 ? (
                  <p className="rounded-xl bg-card p-6 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
                    {copy.students.noStudents}
                  </p>
                ) : visibleRoster.length === 0 ? (
                  <p className="rounded-xl bg-card p-6 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
                    {copy.students.noMatch}
                  </p>
                ) : (
                  <StudentRoster students={visibleRoster} profileHref="/students" />
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
    </div>
  );
}
