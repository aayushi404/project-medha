"use client";

import { Loader2, ListChecks } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { QuizRunner } from "@/components/student/quiz-runner";
import {
  SubjectChapterBar,
  useSubjectChapter,
} from "@/components/student/subject-chapter-bar";
import { Button } from "@/components/ui/button";
import { getPracticeQuestions, type PracticeQuestion } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCopy, useCurriculumT } from "@/lib/copy";

export default function PracticePage() {
  const { accessToken } = useAuth();
  const copy = useCopy();
  const t = useCurriculumT();
  const picker = useSubjectChapter();
  const { subjectId, chapterId, subjectName, chapterTitle } = picker;

  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  // Tracks which chapter's questions are currently loaded, rather than a
  // plain boolean, so "loading" is derived instead of toggled from inside
  // the effect.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!accessToken || !chapterId) return;
    let active = true;
    getPracticeQuestions(accessToken, chapterId)
      .then((q) => active && setQuestions(q))
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not load."))
      .finally(() => {
        if (active) setLoadedFor(chapterId);
      });
    return () => {
      active = false;
    };
  }, [accessToken, chapterId]);

  const chapterPicked = !!subjectId && !!chapterId;
  const loading = chapterPicked && chapterId !== loadedFor;

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <h1 className="text-[15px]">{copy.student.practiceTitle}</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">{copy.student.practiceSub}</p>
      </div>

      {!running && <SubjectChapterBar picker={picker} />}

      <div className="flex-1 overflow-y-auto">
        {running ? (
          <QuizRunner
            title={t.chapter(chapterTitle ?? "")}
            subtitle={t.subject(subjectName ?? "")}
            questions={questions}
            onExit={() => setRunning(false)}
          />
        ) : !chapterPicked ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-20 text-center">
            <ListChecks className="size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{copy.student.practicePickToStart}</p>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : questions.length === 0 ? (
          <div className="mx-auto w-full max-w-2xl px-5 py-16 text-center">
            <p className="text-sm text-muted-foreground">{copy.student.practiceEmpty}</p>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-2xl px-5 py-5">
            <div
              className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <span className="font-medium text-foreground">{t.chapter(chapterTitle ?? "")}</span>
                <p className="mt-1 text-xs text-muted-foreground">
                  {copy.student.questionsCount(questions.length)}
                </p>
              </div>
              <Button size="sm" className="shrink-0" onClick={() => setRunning(true)}>
                {copy.student.startBtn}
              </Button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
