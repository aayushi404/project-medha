"use client";

import { CheckCheck, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AttendanceSheet } from "@/components/attendance/attendance-sheet";
import { GuardianCallsPanel } from "@/components/attendance/guardian-calls-panel";
import { LiveCallModal } from "@/components/attendance/live-call-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  type AbsenceCall,
  type AttendanceDay,
  type AttendanceStatus,
  getAbsenceCalls,
  getAttendance,
  getMySections,
  markAttendance,
  type TeacherSection,
} from "@/lib/api";
import { todayISO } from "@/lib/attendance-store";
import { useAuth } from "@/lib/auth-context";

const DEMO_CALLS = process.env.NEXT_PUBLIC_DEMO_CALLS === "true";

export default function AttendancePage() {
  const { accessToken } = useAuth();

  const [sections, setSections] = useState<TeacherSection[] | null>(null);
  const [classSectionId, setClassSectionId] = useState<string | null>(null);
  const [date, setDate] = useState(todayISO());
  const [day, setDay] = useState<AttendanceDay | null>(null);
  const [drafts, setDrafts] = useState<Record<string, AttendanceStatus>>({});
  const [saving, setSaving] = useState(false);
  const [savedSummary, setSavedSummary] = useState<{ present: number; total: number } | null>(null);
  const [calls, setCalls] = useState<AbsenceCall[]>([]);
  const [activeCallStudent, setActiveCallStudent] = useState<{
    id: string;
    name: string;
    phone?: string | null;
  } | null>(null);
  const requestKeyRef = useRef<string | null>(null);

  // Only the sections this teacher is the homeroom/class teacher of --
  // marking attendance is class-teacher-exclusive (see backend
  // assert_is_class_teacher_of_section), so a subject-only assignment has no
  // business showing up as an option to "take" on this page.
  const classTeacherSections = useMemo(
    () => (sections ?? []).filter((s) => s.is_class_teacher),
    [sections],
  );

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    getMySections(accessToken)
      .then((rows) => {
        if (!active) return;
        setSections(rows);
        const mine = rows.filter((s) => s.is_class_teacher);
        setClassSectionId((cur) => cur ?? mine[0]?.id ?? null);
      })
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : "Could not load your classes.");
      });
    return () => {
      active = false;
    };
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken || !classSectionId) return;
    const key = `${classSectionId}:${date}`;
    requestKeyRef.current = key;
    getAttendance(accessToken, classSectionId, date)
      .then((result) => {
        if (requestKeyRef.current !== key) return;
        setDay(result);
        setSavedSummary(null);
        const seeded: Record<string, AttendanceStatus> = {};
        for (const s of result.students) {
          if (s.status) seeded[s.student_id] = s.status;
        }
        setDrafts(seeded);
      })
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : "Could not load attendance.");
      });
  }, [accessToken, classSectionId, date]);

  const loading = !day || day.class_section_id !== classSectionId || day.date !== date;

  // Guardian calls only ever fire for today's absences (see
  // attendance/service.py::mark_day) -- polling on other dates would just
  // show an empty list forever, so skip it entirely there.
  useEffect(() => {
    if (!accessToken || !classSectionId || date !== todayISO()) {
      return;
    }
    let active = true;
    const load = () => {
      getAbsenceCalls(accessToken, classSectionId)
        .then((rows) => {
          if (active) setCalls(rows.filter((c) => c.attendance_date === date));
        })
        .catch(() => {
          // quiet -- this panel is a bonus view, not the primary flow
        });
    };
    load();
    const interval = setInterval(load, 4000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [accessToken, classSectionId, date]);

  const sectionOptions = classTeacherSections.map((s) => ({
    value: s.id,
    label: `${s.grade_label} · ${s.section}`,
  }));

  function toggle(studentId: string, status: AttendanceStatus) {
    setDrafts((prev) => ({ ...prev, [studentId]: status }));
    setSavedSummary(null);
  }

  function markAllPresent() {
    if (!day) return;
    const next: Record<string, AttendanceStatus> = {};
    for (const s of day.students) next[s.student_id] = "present";
    setDrafts(next);
    setSavedSummary(null);
  }

  const allMarked = !!day && day.students.length > 0 && day.students.every((s) => drafts[s.student_id]);

  async function save() {
    if (!classSectionId || !day || !allMarked) return;
    setSaving(true);
    // Only a student who's *newly* absent (wasn't already, before this save)
    // gets the simulated-call demo -- matches the real backend's own
    // newly_absent rule, so the demo never fires louder than reality would.
    const newlyAbsentId = day.students.find(
      (s) => drafts[s.student_id] === "absent" && s.status !== "absent",
    )?.student_id;
    try {
      const records = day.students.map((s) => ({
        student_id: s.student_id,
        status: drafts[s.student_id],
      }));
      const updated = await markAttendance(accessToken, {
        class_section_id: classSectionId,
        date,
        records,
      });
      setDay(updated);
      const present = updated.students.filter((s) => s.status === "present").length;
      setSavedSummary({ present, total: updated.students.length });
      toast.success(
        `Attendance saved — ${present}/${updated.students.length} present (${Math.round((present / updated.students.length) * 100)}%).`,
      );

      if (DEMO_CALLS && newlyAbsentId) {
        const student = updated.students.find((s) => s.student_id === newlyAbsentId);
        if (student) {
          setActiveCallStudent({ id: student.student_id, name: student.full_name, phone: null });
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save attendance.");
    } finally {
      setSaving(false);
    }
  }

  function handleCallComplete(reasonText: string, transcriptText: string) {
    if (!activeCallStudent) return;
    const newCall: AbsenceCall = {
      id: `sim-${activeCallStudent.id}-${Date.now()}`,
      student_id: activeCallStudent.id,
      student_name: activeCallStudent.name,
      guardian_phone: activeCallStudent.phone ?? null,
      status: "completed",
      reason_text: reasonText,
      failure_reason: null,
      transcript: transcriptText,
      attendance_date: date,
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    };

    setCalls((prev) => [newCall, ...prev.filter((c) => c.student_id !== activeCallStudent.id)]);
  }

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <h1 className="text-[15px]">Attendance</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Mark today&apos;s attendance for your class.
        </p>
        {sectionOptions.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Select
              ariaLabel="Class"
              value={classSectionId}
              onValueChange={setClassSectionId}
              options={sectionOptions}
              className="h-8"
            />
            <Input
              type="date"
              value={date}
              max={todayISO()}
              onChange={(e) => setDate(e.target.value || todayISO())}
              className="w-auto text-xs"
              aria-label="Date"
            />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="mx-auto w-full max-w-2xl">
          {sections === null ? (
            <div className="flex justify-center py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : classTeacherSections.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              You aren&apos;t the class teacher of any section yet. Attendance is taken by
              each class&apos;s homeroom teacher — ask your principal if you should be
              assigned one.
            </p>
          ) : loading || !day ? (
            <div className="flex justify-center py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {savedSummary && (
                <div className="mb-3 rounded-xl bg-sage/10 px-4 py-2.5 text-sm font-medium text-sage">
                  Saved — {savedSummary.present}/{savedSummary.total} present (
                  {Math.round((savedSummary.present / savedSummary.total) * 100)}%)
                </div>
              )}

              <div className="mb-3 flex items-center justify-between gap-2">
                <Button size="sm" variant="outline" onClick={markAllPresent} disabled={saving}>
                  <CheckCheck className="size-3.5" /> Mark all present
                </Button>
                <Button size="sm" onClick={() => void save()} disabled={saving || !allMarked}>
                  {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
                  Save Attendance
                </Button>
              </div>

              <AttendanceSheet students={day.students} drafts={drafts} onToggle={toggle} />
              <div className="mt-3">
                <GuardianCallsPanel calls={date === todayISO() ? calls : []} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Simulated Automated Calling Modal */}
      <LiveCallModal
        isOpen={!!activeCallStudent}
        onClose={() => setActiveCallStudent(null)}
        studentName={activeCallStudent?.name || ""}
        guardianPhone={activeCallStudent?.phone}
        onCompleteCall={handleCallComplete}
      />
    </main>
  );
}
