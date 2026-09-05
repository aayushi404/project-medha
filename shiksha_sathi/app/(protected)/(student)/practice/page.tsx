"use client";

import { useState } from "react";
import Link from "next/link";
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
          <div className="mx-auto w-full max-w-4xl px-5 py-6 space-y-6">
            <div className="rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 p-5 text-white shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-md">
                    Instant Quiz Runner
                  </span>
                  <h2 className="text-lg font-bold mt-1">
                    Daily Practice & Chapter Quizzes
                  </h2>
                  <p className="text-xs text-white/90">
                    Pick a subject and chapter above, or start one of the featured board quizzes below.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRunning("quick")}
                  className="rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-emerald-800 hover:bg-emerald-50 transition-colors shadow-xs shrink-0"
                >
                  ⚡ Start Quick Quiz Now
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-800">
                Featured Bihar Board Practice Quizzes
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRunning("quick")}
                  className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-xs hover:border-emerald-400 hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                      10 Questions · 10 Mins
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 mt-2">
                      Mathematics & Science Rapid Fire
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Formula applications, mental math shortcuts, and science definitions.
                    </p>
                  </div>
                  <span className="text-xs font-bold text-emerald-600 mt-3 flex items-center gap-1">
                    Start Practice Quiz →
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setRunning("mock")}
                  className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-xs hover:border-blue-400 hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                      20 Questions · 20 Mins
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 mt-2">
                      Bihar Board Full Chapter Mock
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Objective MCQs with negative-marking practice and step-by-step solutions.
                    </p>
                  </div>
                  <span className="text-xs font-bold text-blue-600 mt-3 flex items-center gap-1">
                    Start Mock Test →
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setRunning("pyq")}
                  className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-xs hover:border-amber-400 hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                      Previous Years Questions (PYQs)
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 mt-2">
                      BSEB Matric 5-Year Question Bank
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Real exam questions from 2021–2025 matriculation papers.
                    </p>
                  </div>
                  <span className="text-xs font-bold text-amber-700 mt-3 flex items-center gap-1">
                    Practice PYQs →
                  </span>
                </button>

                <Link
                  href="/open-test"
                  className="rounded-2xl border border-red-200 bg-red-50/40 p-4 text-left shadow-xs hover:border-red-400 hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    <span className="text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-md">
                      Live State Exam
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 mt-2">
                      Bihar State Open Test Series 2026
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Timed full-length exam with live rank comparison and certificates.
                    </p>
                  </div>
                  <span className="text-xs font-bold text-red-600 mt-3 flex items-center gap-1">
                    Go to Open Tests →
                  </span>
                </Link>
              </div>
            </div>
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
