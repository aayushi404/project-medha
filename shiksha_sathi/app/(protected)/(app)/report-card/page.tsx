"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  getProfile,
  getReportCard,
  getStudentRoster,
  upsertReportCardMark,
  type Profile,
  type ReportCard,
  type StudentRosterItem,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCopy } from "@/lib/copy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ReportCardView } from "@/components/report-card/report-card-view";

export default function TeacherReportCardPage() {
  const { accessToken } = useAuth();
  const copy = useCopy();
  const t = copy.reportCardPage;

  const [roster, setRoster] = useState<StudentRosterItem[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [card, setCard] = useState<ReportCard | null>(null);
  const [loading, setLoading] = useState(true);

  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [term, setTerm] = useState("");
  const [marks, setMarks] = useState("");
  const [maxMarks, setMaxMarks] = useState("100");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    Promise.all([getStudentRoster(accessToken), getProfile(accessToken)])
      .then(([r, p]) => {
        if (!active) return;
        setRoster(r);
        setProfile(p);
        setStudentId(r[0]?.id ?? null);
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not load."))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [accessToken]);

  const loadCard = useCallback(() => {
    if (!accessToken || !studentId) return;
    getReportCard(accessToken, studentId)
      .then(setCard)
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not load report card."));
  }, [accessToken, studentId]);

  useEffect(() => {
    loadCard();
  }, [loadCard]);

  const selectedStudent = roster.find((s) => s.id === studentId) ?? null;
  const subjectOptions = useMemo(
    () =>
      (profile?.subjects ?? [])
        .filter((s) => s.grade_id === selectedStudent?.grade_id)
        .map((s) => ({ value: s.subject_id, label: s.subject_name })),
    [profile, selectedStudent],
  );

  const studentOptions = roster.map((s) => ({
    value: s.id,
    label: `${s.full_name} (${s.grade_label})`,
  }));

  async function submit() {
    if (!studentId || !subjectId || term.trim().length === 0 || marks.trim().length === 0) return;
    setSaving(true);
    try {
      await upsertReportCardMark(accessToken, {
        student_id: studentId,
        subject_id: subjectId,
        term: term.trim(),
        marks_obtained: Number(marks),
        max_marks: maxMarks.trim() ? Number(maxMarks) : 100,
        remarks: remarks.trim() || null,
      });
      toast.success(t.savedToast);
      setMarks("");
      setRemarks("");
      loadCard();
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
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <Select
                value={studentId}
                onValueChange={setStudentId}
                options={studentOptions}
                placeholder={t.pickStudent}
              />

              {studentId && (
                <div className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                  <div className="flex flex-wrap gap-2">
                    <Select
                      value={subjectId}
                      onValueChange={setSubjectId}
                      options={subjectOptions}
                      placeholder={t.subjectLabel}
                    />
                    <Input
                      value={term}
                      onChange={(e) => setTerm(e.target.value)}
                      placeholder={t.termLabel}
                      className="w-32"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      type="number"
                      value={marks}
                      onChange={(e) => setMarks(e.target.value)}
                      placeholder={t.marksLabel}
                      className="w-32"
                    />
                    <span className="text-xs text-muted-foreground">{t.maxMarksLabel}</span>
                    <Input
                      type="number"
                      value={maxMarks}
                      onChange={(e) => setMaxMarks(e.target.value)}
                      className="w-24"
                    />
                  </div>
                  <Input
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder={t.remarksLabel}
                  />
                  <Button
                    onClick={() => void submit()}
                    disabled={!subjectId || term.trim().length === 0 || marks.trim().length === 0 || saving}
                    className="self-start"
                  >
                    {saving ? t.saving : t.saveBtn}
                  </Button>
                </div>
              )}

              <ReportCardView card={card} />
            </>
          )}
        </div>
      </div>
    </main>
  );
}
