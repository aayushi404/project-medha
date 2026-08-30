"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Circle, Clock, RotateCcw, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PracticeQuestion } from "@/lib/student-content";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  subtitle: string;
  questions: PracticeQuestion[];
  minutes: number | null;
  onExit: () => void;
};

function fmt(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function QuizRunner({ title, subtitle, questions, minutes, onExit }: Props) {
  const [answers, setAnswers] = useState<(number | null)[]>(() =>
    questions.map(() => null),
  );
  const [submitted, setSubmitted] = useState(false);
  const [left, setLeft] = useState<number | null>(minutes ? minutes * 60 : null);

  useEffect(() => {
    if (submitted || left == null || left <= 0) return;
    const t = setTimeout(() => {
      // async callback, not the effect body -- auto-submit when time runs out
      setLeft(left - 1);
      if (left - 1 <= 0) setSubmitted(true);
    }, 1000);
    return () => clearTimeout(t);
  }, [left, submitted]);

  const score = useMemo(
    () =>
      answers.reduce<number>(
        (n, a, i) => n + (a === questions[i].answer ? 1 : 0),
        0,
      ),
    [answers, questions],
  );
  const answeredCount = answers.filter((a) => a != null).length;

  function pick(qi: number, oi: number) {
    if (submitted) return;
    setAnswers((prev) => prev.map((a, i) => (i === qi ? oi : a)));
  }

  function retry() {
    setAnswers(questions.map(() => null));
    setSubmitted(false);
    setLeft(minutes ? minutes * 60 : null);
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-5 py-5">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onExit}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Practice sets
        </button>
        {left != null && !submitted && (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium tabular-nums",
              left <= 30
                ? "bg-destructive/10 text-destructive"
                : "bg-muted text-muted-foreground",
            )}
          >
            <Clock className="size-3.5" />
            {fmt(left)}
          </span>
        )}
      </div>

      <div>
        <h2 className="text-base font-medium">{title}</h2>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>

      {submitted && (
        <div className="rounded-xl bg-card p-4 text-center ring-1 ring-foreground/10">
          <div className="text-2xl font-semibold text-foreground">
            {score}
            <span className="text-base font-normal text-muted-foreground">
              {" "}
              / {questions.length}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {score === questions.length
              ? "Perfect! Every answer correct."
              : score >= questions.length * 0.6
                ? "Good work. Review the ones you missed below."
                : "Keep practising -- check the explanations below."}
          </p>
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
          return (
            <li
              key={qi}
              className="rounded-xl bg-card p-4 ring-1 ring-foreground/10"
            >
              <div className="flex gap-2 text-sm font-medium">
                <span className="text-muted-foreground">{qi + 1}.</span>
                <span>{q.q}</span>
              </div>
              <div className="mt-3 flex flex-col gap-1.5">
                {q.options.map((opt, oi) => {
                  const isChosen = chosen === oi;
                  const isCorrect = q.answer === oi;
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
              {submitted && q.explanation && (
                <p className="mt-2.5 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                  {q.explanation}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      {!submitted && (
        <div className="sticky bottom-0 -mx-5 border-t border-border bg-background/90 px-5 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              {answeredCount} of {questions.length} answered
            </span>
            <Button size="sm" onClick={() => setSubmitted(true)}>
              Submit
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
