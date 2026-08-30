"use client";

import { useState } from "react";
import { Clock, ListChecks } from "lucide-react";

import { QuizRunner } from "@/components/student/quiz-runner";
import {
  SubjectChapterBar,
  useSubjectChapter,
} from "@/components/student/subject-chapter-bar";
import { Button } from "@/components/ui/button";
import { useCopy, useCurriculumT } from "@/lib/copy";
import {
  PRACTICE_SETS,
  hasRealPractice,
  questionsFor,
  type PracticeSetSlug,
} from "@/lib/student-content";

export default function PracticePage() {
  const copy = useCopy();
  const t = useCurriculumT();
  const picker = useSubjectChapter();
  const { subjectId, chapterId, subjectName, chapterTitle } = picker;
  const [running, setRunning] = useState<PracticeSetSlug | null>(null);

  const chapterPicked = !!subjectId && !!chapterId;
  const sample = chapterPicked && !hasRealPractice(chapterTitle);

  const active = running ? PRACTICE_SETS.find((s) => s.slug === running) : null;

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <h1 className="text-[15px]">{copy.student.practiceTitle}</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">{copy.student.practiceSub}</p>
      </div>

      {!running && <SubjectChapterBar picker={picker} />}

      <div className="flex-1 overflow-y-auto">
        {running && active ? (
          <QuizRunner
            title={active.title}
            subtitle={`${t.subject(subjectName ?? "")} · ${t.chapter(chapterTitle ?? "")}`}
            questions={questionsFor(chapterTitle, running)}
            minutes={active.minutes}
            onExit={() => setRunning(null)}
          />
        ) : !chapterPicked ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-20 text-center">
            <ListChecks className="size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {copy.student.practicePickToStart}
            </p>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-2xl px-5 py-5">
            {sample && (
              <p className="mb-4 rounded-lg bg-gold/10 px-3 py-2 text-xs text-earth">
                {copy.student.practiceSampleNote}
              </p>
            )}
            <div className="flex flex-col gap-3">
              {PRACTICE_SETS.map((set) => {
                const n = questionsFor(chapterTitle, set.slug).length;
                return (
                  <div
                    key={set.slug}
                    className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">{set.title}</span>
                        <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-accent-foreground">
                          {set.tag}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{set.blurb}</p>
                      <div className="mt-1.5 flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
                        <span>{copy.student.questionsCount(n)}</span>
                        {set.minutes != null && (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="size-3" />
                            {set.minutes} min
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="shrink-0"
                      onClick={() => setRunning(set.slug)}
                    >
                      {copy.student.startBtn}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
