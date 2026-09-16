"use client";

import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Pencil, Play } from "lucide-react";
import { useState } from "react";

import { QuestionEditDialog } from "@/components/quiz-live/question-edit-dialog";
import type { QuizQ } from "@/components/quiz-live/types";
import { cn } from "@/lib/utils";

const LETTERS = "ABCDEFGH";

/** Page 4 -- one question at a time in a carousel (not a long vertical list),
 *  each with an inline Edit action opening QuestionEditDialog. The correct
 *  answer is visible here (the teacher is reviewing) but never on the live
 *  page. */
export function ReviewStep({
  questions,
  onQuestionsChange,
  metaLine,
  onBack,
  onStartQuiz,
  startDisabledReason,
}: {
  questions: QuizQ[];
  onQuestionsChange: (next: QuizQ[]) => void;
  metaLine: string;
  onBack: () => void;
  onStartQuiz: () => void;
  startDisabledReason: string | null;
}) {
  const [index, setIndex] = useState(0);
  const [editing, setEditing] = useState(false);

  const total = questions.length;
  const current = questions[index] ?? null;

  function saveCurrent(next: QuizQ) {
    onQuestionsChange(questions.map((q, i) => (i === index ? next : q)));
  }

  return (
    <div className="mt-8 flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-medium">Review your quiz</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Review and edit the questions before starting the classroom quiz.
        </p>
      </div>

      {metaLine ? (
        <div className="flex flex-wrap gap-1.5">
          {metaLine.split("·").map((part, i) =>
            part.trim() ? (
              <span
                key={i}
                className="rounded-full border border-violet/25 bg-violet-muted/50 px-2.5 py-1 text-xs text-violet"
              >
                {part.trim()}
              </span>
            ) : null,
          )}
        </div>
      ) : null}

      {total === 0 || !current ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          This quiz doesn&apos;t have any questions to review yet.
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Question {index + 1} of {total}
              </span>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-xs text-violet hover:bg-violet-muted/50"
              >
                <Pencil className="size-3.5" />
                Edit
              </button>
            </div>

            <p className="mt-3 text-lg leading-snug font-medium text-balance">{current.q}</p>

            <div className="mt-4 flex flex-col gap-2">
              {(current.options ?? []).map((opt, oi) => {
                const isAnswer = opt === current.answer;
                return (
                  <div
                    key={oi}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm",
                      isAnswer ? "border-sage/40 bg-sage/[0.06]" : "border-border/70",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-medium",
                        isAnswer ? "bg-sage text-white" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {LETTERS[oi] ?? "?"}
                    </span>
                    <span className={cn(isAnswer && "font-medium")}>{opt}</span>
                  </div>
                );
              })}
            </div>

            {current.answer ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Answer: <span className="font-medium text-sage">{current.answer}</span>
              </p>
            ) : (
              <p className="mt-3 text-xs text-destructive">No correct answer set for this question.</p>
            )}
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-muted disabled:opacity-30"
            >
              <ChevronLeft className="size-4" />
              Previous
            </button>

            <div className="flex flex-wrap items-center justify-center gap-1">
              {questions.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Go to question ${i + 1}`}
                  aria-current={i === index}
                  className={cn(
                    "size-2 rounded-full transition-colors",
                    i === index ? "bg-violet" : "bg-border hover:bg-muted-foreground/40",
                  )}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
              disabled={index === total - 1}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-muted disabled:opacity-30"
            >
              Next
              <ChevronRight className="size-4" />
            </button>
          </div>
        </>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
        >
          <ArrowLeft className="size-4" />
          Back
        </button>
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            onClick={onStartQuiz}
            disabled={!!startDisabledReason}
            className="inline-flex items-center gap-2 rounded-lg bg-terracotta px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-50"
          >
            <Play className="size-4" />
            Start quiz
            <ArrowRight className="size-4" />
          </button>
          {startDisabledReason ? (
            <span className="text-xs text-destructive">{startDisabledReason}</span>
          ) : null}
        </div>
      </div>

      <QuestionEditDialog
        open={editing}
        question={current}
        onOpenChange={setEditing}
        onSave={saveCurrent}
      />
    </div>
  );
}
