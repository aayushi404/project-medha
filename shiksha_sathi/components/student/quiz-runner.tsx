"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Circle, RotateCcw, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PracticeQuestion } from "@/lib/api";
import { useCopy } from "@/lib/copy";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  subtitle: string;
  questions: PracticeQuestion[];
  onExit: () => void;
};

/** Multiple-choice questions are picked and scored on Submit; a question
 * with no options (short-answer/true-false) has no pick interaction --
 * just a tap-to-reveal answer, excluded from the score tally. */
export function QuizRunner({ title, subtitle, questions, onExit }: Props) {
  const copy = useCopy();
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const [revealed, setRevealed] = useState<boolean[]>(() => questions.map(() => false));
  const [submitted, setSubmitted] = useState(false);

  const scorable = questions.filter((q) => q.options && q.options.length > 0);
  const score = useMemo(
    () =>
      questions.reduce<number>((n, q, i) => {
        if (!q.options) return n;
        const chosen = answers[i];
        const correctIndex = q.options.indexOf(q.answer);
        return n + (chosen != null && chosen === correctIndex ? 1 : 0);
      }, 0),
    [answers, questions],
  );
  const answeredCount = questions.filter((q, i) => (q.options ? answers[i] != null : revealed[i])).length;

  function pick(qi: number, oi: number) {
    if (submitted) return;
    setAnswers((prev) => prev.map((a, i) => (i === qi ? oi : a)));
  }

  function reveal(qi: number) {
    setRevealed((prev) => prev.map((r, i) => (i === qi ? true : r)));
  }

  function retry() {
    setAnswers(questions.map(() => null));
    setRevealed(questions.map(() => false));
    setSubmitted(false);
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-5 py-5">
      <button
        type="button"
        onClick={onExit}
        className="inline-flex items-center gap-1.5 self-start text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        {copy.back}
      </button>

      <div>
        <h2 className="text-base font-medium">{title}</h2>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>

      {submitted && scorable.length > 0 && (
        <div className="rounded-xl bg-card p-4 text-center ring-1 ring-foreground/10">
          <div className="text-2xl font-semibold text-foreground">
            {score}
            <span className="text-base font-normal text-muted-foreground"> / {scorable.length}</span>
          </div>
          <div className="mt-3 flex justify-center gap-2">
            <Button size="sm" variant="outline" onClick={retry}>
              <RotateCcw className="size-3.5" />
              Retry
            </Button>
            <Button size="sm" onClick={onExit}>
              Done
            </Button>
          </div>
        </div>
      )}

      <ol className="flex flex-col gap-3">
        {questions.map((q, qi) => {
          const chosen = answers[qi];
          const hasOptions = !!q.options && q.options.length > 0;
          const correctIndex = hasOptions ? q.options!.indexOf(q.answer) : -1;
          return (
            <li key={q.id} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
              <div className="flex gap-2 text-sm font-medium">
                <span className="text-muted-foreground">{qi + 1}.</span>
                <span>{q.question}</span>
              </div>

              {hasOptions ? (
                <div className="mt-3 flex flex-col gap-1.5">
                  {q.options!.map((opt, oi) => {
                    const isChosen = chosen === oi;
                    const isCorrect = correctIndex === oi;
                    const showState = submitted && (isChosen || isCorrect);
                    return (
                      <button
                        key={oi}
                        type="button"
                        onClick={() => pick(qi, oi)}
                        disabled={submitted}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                          !submitted && isChosen && "border-terracotta bg-accent/60",
                          !submitted && !isChosen && "border-border hover:bg-muted",
                          submitted && !showState && "border-border opacity-70",
                          showState && isCorrect && "border-sage/60 bg-sage/10 text-earth",
                          showState &&
                            isChosen &&
                            !isCorrect &&
                            "border-destructive/50 bg-destructive/10 text-destructive",
                        )}
                      >
                        {submitted ? (
                          isCorrect ? (
                            <CheckCircle2 className="size-4 shrink-0 text-sage" />
                          ) : isChosen ? (
                            <XCircle className="size-4 shrink-0 text-destructive" />
                          ) : (
                            <Circle className="size-4 shrink-0 text-muted-foreground/40" />
                          )
                        ) : (
                          <Circle
                            className={cn(
                              "size-4 shrink-0",
                              isChosen ? "text-terracotta" : "text-muted-foreground/40",
                            )}
                          />
                        )}
                        {opt}
                      </button>
                    );
                  })}
                </div>
              ) : revealed[qi] ? (
                <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">{q.answer}</p>
              ) : (
                <Button size="sm" variant="outline" className="mt-3" onClick={() => reveal(qi)}>
                  {copy.showAnswer}
                </Button>
              )}
            </li>
          );
        })}
      </ol>

      {!submitted && scorable.length > 0 && (
        <div className="sticky bottom-0 -mx-5 border-t border-border bg-background/90 px-5 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              {answeredCount} / {questions.length}
            </span>
            <Button size="sm" onClick={() => setSubmitted(true)}>
              {copy.send}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
