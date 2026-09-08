"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  getChapterNotes,
  getChapters,
  getProfile,
  upsertChapterNote,
  type ChapterNote,
  type Chapter,
  type Profile,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCopy } from "@/lib/copy";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

export default function TeacherNotesPage() {
  const { accessToken } = useAuth();
  const copy = useCopy();
  const t = copy.notesPage;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [gradeId, setGradeId] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [note, setNote] = useState<ChapterNote | null>(null);
  const [summary, setSummary] = useState("");
  const [keyPoints, setKeyPoints] = useState("");
  const [importantTerms, setImportantTerms] = useState("");
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

  // Fetches chapters for the picked grade+subject; while either is unset,
  // `chapters` just holds whatever it last held -- `chapterOptions` below is
  // what actually gates on both being set, so stale data is never shown.
  useEffect(() => {
    if (!gradeId || !subjectId) return;
    let active = true;
    getChapters(gradeId, subjectId)
      .then((c) => active && setChapters(c))
      .catch(() => active && setChapters([]));
    return () => {
      active = false;
    };
  }, [gradeId, subjectId]);

  const chapterOptions = useMemo(
    () =>
      gradeId && subjectId
        ? chapters.map((c) => ({ value: c.id, label: `${c.chapter_number}. ${c.title}` }))
        : [],
    [gradeId, subjectId, chapters],
  );

  const loadNote = useCallback(() => {
    if (!accessToken || !chapterId) return;
    getChapterNotes(accessToken, chapterId)
      .then((n) => {
        setNote(n);
        setSummary(n?.summary ?? "");
        setKeyPoints((n?.key_points ?? []).join("\n"));
        setImportantTerms((n?.important_terms ?? []).join(", "));
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not load."));
  }, [accessToken, chapterId]);

  useEffect(() => {
    loadNote();
  }, [loadNote]);

  async function submit() {
    if (!chapterId || summary.trim().length === 0) return;
    setSaving(true);
    try {
      await upsertChapterNote(accessToken, {
        chapter_id: chapterId,
        summary: summary.trim(),
        key_points: keyPoints.split("\n").map((s) => s.trim()).filter(Boolean),
        important_terms: importantTerms.split(",").map((s) => s.trim()).filter(Boolean),
      });
      toast.success(t.savedToast);
      loadNote();
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
              <div className="flex flex-wrap gap-2">
                <Select
                  value={gradeId}
                  onValueChange={(v) => {
                    setGradeId(v);
                    setSubjectId(null);
                    setChapterId(null);
                  }}
                  options={grades}
                  placeholder={copy.selectClass}
                />
                <Select
                  value={subjectId}
                  onValueChange={(v) => {
                    setSubjectId(v);
                    setChapterId(null);
                  }}
                  options={subjectOptions}
                  placeholder={copy.selectSubject}
                />
                <Select
                  value={chapterId}
                  onValueChange={setChapterId}
                  options={chapterOptions}
                  placeholder={t.pickChapter}
                />
              </div>

              {chapterId && (
                <div className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      {t.summaryLabel}
                    </label>
                    <textarea
                      value={summary}
                      onChange={(e) => setSummary(e.target.value)}
                      rows={4}
                      className="w-full resize-none rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      {t.keyPointsLabel}
                    </label>
                    <textarea
                      value={keyPoints}
                      onChange={(e) => setKeyPoints(e.target.value)}
                      rows={4}
                      className="w-full resize-none rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      {t.importantTermsLabel}
                    </label>
                    <textarea
                      value={importantTerms}
                      onChange={(e) => setImportantTerms(e.target.value)}
                      rows={2}
                      className="w-full resize-none rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                  </div>
                  <Button
                    onClick={() => void submit()}
                    disabled={summary.trim().length === 0 || saving}
                    className="self-start"
                  >
                    {saving ? t.saving : t.saveBtn}
                  </Button>
                </div>
              )}

              {chapterId && !note && (
                <p className="text-center text-xs text-muted-foreground">{t.empty}</p>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
