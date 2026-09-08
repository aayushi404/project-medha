"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  getProfile,
  getTimetable,
  setTimetable,
  type Profile,
  type TimetableSlot,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCopy } from "@/lib/copy";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { TimetableGrid } from "@/components/timetable/timetable-grid";

export default function TeacherTimetablePage() {
  const { accessToken } = useAuth();
  const copy = useCopy();
  const t = copy.timetablePage;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [gradeId, setGradeId] = useState<string | null>(null);
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    getProfile(accessToken)
      .then((p) => {
        if (!active) return;
        setProfile(p);
        setGradeId(p.subjects[0]?.grade_id ?? null);
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not load."))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken || !gradeId) return;
    let active = true;
    getTimetable(accessToken, gradeId)
      .then((tt) => active && setSlots(tt.slots))
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not load timetable."));
    return () => {
      active = false;
    };
  }, [accessToken, gradeId]);

  const grades = Array.from(
    new Map((profile?.subjects ?? []).map((s) => [s.grade_id, s.grade_label])).entries(),
  ).map(([value, label]) => ({ value, label }));

  const subjectOptions = useMemo(
    () =>
      (profile?.subjects ?? [])
        .filter((s) => s.grade_id === gradeId)
        .map((s) => ({ value: s.subject_id, label: s.subject_name })),
    [profile, gradeId],
  );

  function onChange(day: number, period: number, subjectId: string | null) {
    setSlots((prev) => {
      const others = prev.filter((s) => !(s.day_of_week === day && s.period_number === period));
      if (subjectId === null) return others;
      const subject = subjectOptions.find((o) => o.value === subjectId);
      return [
        ...others,
        {
          day_of_week: day,
          period_number: period,
          subject_id: subjectId,
          subject_name: subject?.label ?? null,
          teacher_id: null,
          teacher_name: null,
        },
      ];
    });
  }

  async function save() {
    if (!gradeId) return;
    setSaving(true);
    try {
      const updated = await setTimetable(accessToken, {
        grade_id: gradeId,
        slots: slots
          .filter((s) => s.subject_id)
          .map((s) => ({
            day_of_week: s.day_of_week,
            period_number: s.period_number,
            subject_id: s.subject_id,
          })),
      });
      setSlots(updated.slots);
      toast.success(t.savedToast);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <h1 className="text-[15px]">{t.title}</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">{t.sub}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <Select
                  value={gradeId}
                  onValueChange={setGradeId}
                  options={grades}
                  placeholder={t.pickClass}
                />
                <Button onClick={() => void save()} disabled={!gradeId || saving}>
                  {saving ? t.saving : t.saveBtn}
                </Button>
              </div>
              {gradeId && (
                <TimetableGrid
                  slots={slots}
                  editable
                  subjectOptions={subjectOptions}
                  onChange={onChange}
                />
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
