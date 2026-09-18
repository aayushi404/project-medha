"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AttendanceSheet } from "@/components/attendance/attendance-sheet";
import { Select } from "@/components/ui/select";
import {
  type AttendanceDay,
  type AttendanceStatus,
  getAttendance,
  getProfile,
  markAttendance,
  type Profile,
} from "@/lib/api";
import { todayISO } from "@/lib/attendance-store";
import { useAuth } from "@/lib/auth-context";

export default function AttendancePage() {
  const { accessToken } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [gradeId, setGradeId] = useState<string | null>(null);
  const [date, setDate] = useState(todayISO());
  const [day, setDay] = useState<AttendanceDay | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const requestKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    getProfile(accessToken)
      .then((p) => {
        if (!active) return;
        setProfile(p);
        setGradeId((cur) => cur ?? p.subjects[0]?.grade_id ?? null);
      })
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : "Could not load your classes.");
      });
    return () => {
      active = false;
    };
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken || !gradeId) return;
    const key = `${gradeId}:${date}`;
    requestKeyRef.current = key;
    getAttendance(accessToken, gradeId, date)
      .then((result) => {
        if (requestKeyRef.current === key) setDay(result);
      })
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : "Could not load attendance.");
      });
  }, [accessToken, gradeId, date]);

  const loading = !day || day.grade_id !== gradeId || day.date !== date;

  const grades = Array.from(
    new Map((profile?.subjects ?? []).map((s) => [s.grade_id, s.grade_label])).entries(),
  ).map(([value, label]) => ({ value, label }));

  async function mark(studentId: string, status: AttendanceStatus) {
    if (!gradeId) return;
    setBusyId(studentId);
    try {
      const updated = await markAttendance(accessToken, {
        grade_id: gradeId,
        date,
        records: [{ student_id: studentId, status }],
      });
      setDay(updated);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save attendance.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <h1 className="text-[15px]">Attendance</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Mark today&apos;s attendance for a class.
        </p>
        {grades.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Select
              ariaLabel="Class"
              value={gradeId}
              onValueChange={setGradeId}
              options={grades}
              className="h-8"
            />
            <input
              type="date"
              value={date}
              max={todayISO()}
              onChange={(e) => setDate(e.target.value || todayISO())}
              className="h-8 rounded-lg border border-border bg-background px-2 text-xs outline-none focus-visible:border-ring"
            />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="mx-auto w-full max-w-2xl">
          {grades.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No classes assigned to you yet.
            </p>
          ) : loading || !day ? (
            <div className="flex justify-center py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <AttendanceSheet students={day.students} busyId={busyId} onMark={mark} />
          )}
        </div>
      </div>
    </main>
  );
}
