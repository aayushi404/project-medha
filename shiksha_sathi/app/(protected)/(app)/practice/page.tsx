"use client";

import { Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  addPracticeQuestion,
  deletePracticeQuestion,
  getChapters,
  getPracticeQuestions,
  getProfile,
  type Chapter,
  type PracticeQuestion,
  type Profile,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCopy } from "@/lib/copy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type QType = "mcq" | "short" | "truefalse";

export default function TeacherPracticePage() {
  const { accessToken } = useAuth();
  const copy = useCopy();
  const t = copy.practicePage;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [gradeId, setGradeId] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [type, setType] = useState<QType>("mcq");
  const [options, setOptions] = useState("");
  const [answer, setAnswer] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
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

  const loadQuestions = useCallback(() => {
    if (!accessToken || !chapterId) return;
    getPracticeQuestions(accessToken, chapterId)
      .then(setQuestions)
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not load."));
  }, [accessToken, chapterId]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  async function submit() {
    if (!chapterId || question.trim().length === 0 || answer.trim().length === 0) return;
    setSaving(true);
    try {
      await addPracticeQuestion(accessToken, {
        chapter_id: chapterId,
        question: question.trim(),
        type,
        options: type === "mcq" ? options.split("\n").map((s) => s.trim()).filter(Boolean) : null,
        answer: answer.trim(),
        difficulty,
      });
      toast.success(t.addedToast);
      setQuestion("");
      setOptions("");
      setAnswer("");
      setFormOpen(false);
      loadQuestions();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add.");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm(t.deleteConfirm)) return;
    setBusyId(id);
    try {
      await deletePracticeQuestion(accessToken, id);
      toast.success(t.deletedToast);
      loadQuestions();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove.");
    } finally {
      setBusyId(null);
    }
  }

  const typeOptions = [
    { value: "mcq", label: t.typeMcq },
    { value: "short", label: t.typeShort },
    { value: "truefalse", label: t.typeTrueFalse },
  ];
  const difficultyOptions = [
    { value: "easy", label: "Easy" },
    { value: "medium", label: "Medium" },
    { value: "hard", label: "Hard" },
  ];

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
              <div className="flex flex-wrap items-center gap-2">
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
                {chapterId && (
                  <Button size="sm" onClick={() => setFormOpen((o) => !o)} className="ml-auto">
                    <Plus className="size-3.5" />
                    {t.newBtn}
                  </Button>
                )}
              </div>

              {formOpen && chapterId && (
                <div className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                  <Input
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder={t.questionLabel}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Select
                      value={type}
                      onValueChange={(v) => setType(v as QType)}
                      options={typeOptions}
                    />
                    <Select
                      value={difficulty}
                      onValueChange={(v) => setDifficulty(v as "easy" | "medium" | "hard")}
                      options={difficultyOptions}
                    />
                  </div>
                  {type === "mcq" && (
                    <textarea
                      value={options}
                      onChange={(e) => setOptions(e.target.value)}
                      placeholder={t.optionsLabel}
                      rows={3}
                      className="w-full resize-none rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                  )}
                  <Input value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder={t.answerLabel} />
                  <Button
                    onClick={() => void submit()}
                    disabled={question.trim().length === 0 || answer.trim().length === 0 || saving}
                    className="self-start"
                  >
                    {saving ? t.adding : t.addBtn}
                  </Button>
                </div>
              )}

              {chapterId &&
                (questions.length === 0 ? (
                  <p className="rounded-xl bg-card p-6 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
                    {t.empty}
                  </p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {questions.map((q) => (
                      <li
                        key={q.id}
                        className="flex items-start justify-between gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
                      >
                        <div className="min-w-0">
                          <span className="text-sm font-medium text-foreground">{q.question}</span>
                          {q.options && (
                            <p className="mt-1 text-xs text-muted-foreground">{q.options.join(" · ")}</p>
                          )}
                          <p className="mt-1 text-xs text-muted-foreground">{t.answerLabel}: {q.answer}</p>
                        </div>
                        <Button
                          variant="destructive"
                          size="icon-sm"
                          onClick={() => void onDelete(q.id)}
                          disabled={busyId === q.id}
                          className="shrink-0"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                ))}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
