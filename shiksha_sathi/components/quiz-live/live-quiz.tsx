"use client";

import { ArrowLeft, ArrowRight, Check, Dices, PartyPopper, RotateCcw, X } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Roller } from "@/components/shared/picker/roller";
import { selectRandomStudent } from "@/components/shared/picker/selection";
import { usePrefersReducedMotion } from "@/components/shared/picker/use-reduced-motion";
import type { Participant, QuizQ } from "@/components/quiz-live/types";
import { cn } from "@/lib/utils";

const LETTERS = "ABCDEFGH";
type Phase = "idle" | "picking" | "landed";

// Beat between the roller landing and the inline "it's your turn" panel
// popping in -- an emphasis pause, not a real delay (mirrors the Random
// Picker tool's REVEAL_DELAY_MS, just shorter since there's no modal here).
const REVEAL_DELAY_MS = 450;
const REVEAL_DELAY_REDUCED_MS = 100;

/** Page 5 -- the live classroom activity. Owns the picker state machine and
 *  the question cursor; the question set and participant pool are handed
 *  down from the orchestrator (index.tsx) and never mutated here. */
export function LiveQuiz({
  questions,
  participants,
  repeatStudents,
  gradeLabel,
  subjectLabel,
  chapterLabel,
  onExit,
}: {
  questions: QuizQ[];
  participants: Participant[];
  repeatStudents: boolean;
  gradeLabel: string;
  subjectLabel: string;
  chapterLabel: string;
  onExit: () => void;
}) {
  const reducedMotion = usePrefersReducedMotion();

  const [questionIndex, setQuestionIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [pickAttempt, setPickAttempt] = useState(0);
  const [poolExclusion, setPoolExclusion] = useState<Set<string>>(new Set());
  const [calledIds, setCalledIds] = useState<Set<string>>(new Set());
  // The option text the teacher tapped on the picked student's behalf, keyed
  // by question index -- scoping it this way means moving to a new question
  // naturally shows no answer yet, with no separate reset to remember.
  const [answeredOptions, setAnsweredOptions] = useState<Map<number, string>>(new Map());
  const [liveMessage, setLiveMessage] = useState("");
  const [finished, setFinished] = useState(false);

  const busyRef = useRef(false);
  const total = questions.length;
  const question = questions[questionIndex] ?? null;
  const isLastQuestion = questionIndex === total - 1;
  const submittedAnswer = answeredOptions.get(questionIndex) ?? null;
  const isCorrect = submittedAnswer !== null && question ? submittedAnswer === question.answer : null;
  const answeredCount = answeredOptions.size;
  const correctCount = useMemo(
    () => [...answeredOptions.entries()].filter(([qi, opt]) => questions[qi]?.answer === opt).length,
    [answeredOptions, questions],
  );

  const pool = useMemo(
    () => participants.filter((p) => repeatStudents || !poolExclusion.has(p.id)),
    [participants, repeatStudents, poolExclusion],
  );
  const poolNames = useMemo(() => pool.map((p) => p.name), [pool]);
  const poolExhausted = !repeatStudents && participants.length > 0 && pool.length === 0;
  const winner = winnerId ? (participants.find((p) => p.id === winnerId) ?? null) : null;

  const canPick = phase === "idle" && !poolExhausted && pool.length > 0;

  // Warn on an accidental reload/close while a session is actually running --
  // there's no server session to resume, so this is the only guard against
  // losing progress the doc's "unexpected navigation/reload" state calls for.
  useEffect(() => {
    if (finished) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [finished]);

  const pick = useCallback(() => {
    if (busyRef.current || pool.length === 0) return;
    busyRef.current = true;
    const chosen = selectRandomStudent(pool);
    setWinnerId(chosen.id);
    setPickAttempt((n) => n + 1);
    setPhase("picking");
    setRevealed(false);
    // A fresh pick means nobody has answered this question yet -- clear any
    // mark left over from a previous student called on the same question.
    setAnsweredOptions((prev) => {
      if (!prev.has(questionIndex)) return prev;
      const next = new Map(prev);
      next.delete(questionIndex);
      return next;
    });
    setLiveMessage("Picking a student…");
  }, [pool, questionIndex]);

  function submitAnswer(option: string) {
    if (!winner || !question) return;
    setAnsweredOptions((prev) => new Map(prev).set(questionIndex, option));
    const correct = option === question.answer;
    setLiveMessage(
      correct ? `Correct! ${winner.name} got it right.` : `Not quite. The correct answer is ${question.answer}.`,
    );
  }

  const handleSpinComplete = useCallback(() => {
    setPhase("landed");
    window.setTimeout(
      () => {
        setRevealed(true);
        if (winner) {
          setLiveMessage(`${winner.name} has been selected to answer question ${questionIndex + 1}.`);
          setCalledIds((prev) => new Set(prev).add(winner.id));
          if (!repeatStudents) setPoolExclusion((prev) => new Set(prev).add(winner.id));
        }
      },
      reducedMotion ? REVEAL_DELAY_REDUCED_MS : REVEAL_DELAY_MS,
    );
  }, [winner, questionIndex, repeatStudents, reducedMotion]);

  function pickAgain() {
    // Undo this question's pick (put the student back in the pool if
    // no-repeat took them out) and immediately roll again.
    if (winner && !repeatStudents) {
      setPoolExclusion((prev) => {
        const next = new Set(prev);
        next.delete(winner.id);
        return next;
      });
      setCalledIds((prev) => {
        const next = new Set(prev);
        next.delete(winner.id);
        return next;
      });
    }
    setPhase("idle");
    setRevealed(false);
    setWinnerId(null);
    busyRef.current = false;
    // Let state settle, then start the next spin fresh.
    queueMicrotask(() => pick());
  }

  function goToNext() {
    if (isLastQuestion) {
      setFinished(true);
      return;
    }
    setQuestionIndex((i) => i + 1);
    setPhase("idle");
    setRevealed(false);
    setWinnerId(null);
    busyRef.current = false;
  }

  function startAnotherRound() {
    setPoolExclusion(new Set());
  }

  const exitTrigger = (
    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" />
      Exit quiz
    </span>
  );

  if (finished) {
    return (
      <main className="flex flex-1 items-center justify-center overflow-y-auto bg-ivory px-4 py-10">
        <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl border border-border bg-card p-8 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-terracotta/10 text-terracotta">
            <PartyPopper className="size-6" />
          </span>
          <h1 className="text-xl font-medium">Quiz complete</h1>
          <div className="mt-1 flex flex-col gap-0.5 text-sm text-muted-foreground">
            <span>{total} question{total === 1 ? "" : "s"}</span>
            <span>
              {calledIds.size} student{calledIds.size === 1 ? "" : "s"} participated
            </span>
            {answeredCount > 0 ? (
              <span>
                {correctCount} of {answeredCount} answered correctly
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm font-medium text-foreground">Great job!</p>
          <Button onClick={onExit} className="mt-3 w-full">
            Finish
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-ivory">
      {/* Announces the two moments that matter -- not every cycling name. */}
      <div role="status" aria-live="polite" className="sr-only">
        {liveMessage}
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-3">
        <ConfirmDialog
          trigger={exitTrigger}
          title="Exit quiz?"
          description="Your current classroom session will end."
          confirmLabel="Exit"
          cancelLabel="Continue quiz"
          onConfirm={onExit}
        />
        <div className="min-w-0 flex-1 text-center text-sm font-medium text-foreground">
          {[subjectLabel, chapterLabel].filter(Boolean).join(" · ")}
          {gradeLabel ? (
            <span className="ml-2 hidden text-xs font-normal text-muted-foreground sm:inline">
              {gradeLabel}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {answeredCount > 0 ? (
            <span className="rounded-full bg-sage/10 px-2 py-0.5 text-xs font-medium text-sage">
              {correctCount}/{answeredCount} correct
            </span>
          ) : null}
          <span className="text-sm text-muted-foreground">
            Question {questionIndex + 1} / {total}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 justify-center gap-1 px-5 pt-3">
        {questions.map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1 flex-1 max-w-10 rounded-full transition-colors",
              i < questionIndex ? "bg-terracotta/50" : i === questionIndex ? "bg-terracotta" : "bg-border",
            )}
          />
        ))}
      </div>

      <div className="grid flex-1 grid-cols-1 gap-5 overflow-y-auto p-5 md:grid-cols-[11fr_9fr] lg:grid-cols-[3fr_2fr]">
        {/* -- question panel -------------------------------------------- */}
        <div className="flex flex-col justify-center rounded-2xl border border-border bg-card px-6 py-8 sm:px-10 sm:py-12">
          {question ? (
            <>
              <span className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                Question {questionIndex + 1} of {total}
              </span>
              <p className="mt-4 text-2xl leading-snug font-medium text-balance sm:text-3xl">
                {question.q}
              </p>
              <div className="mt-8 flex flex-col gap-3">
                {(question.options ?? []).map((opt, oi) => {
                  const canAnswer = revealed && !!winner;
                  const isPicked = submittedAnswer === opt;
                  const isCorrectOption = opt === question.answer;
                  const showResult = submittedAnswer !== null;
                  return (
                    <button
                      key={oi}
                      type="button"
                      disabled={!canAnswer}
                      aria-pressed={isPicked}
                      onClick={() => submitAnswer(opt)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                        showResult && isPicked && isCorrectOption && "border-sage bg-sage/[0.08]",
                        showResult && isPicked && !isCorrectOption && "border-destructive bg-destructive/[0.06]",
                        showResult && !isPicked && isCorrectOption && "border-sage/40 bg-sage/[0.04]",
                        !showResult && "border-border/70",
                        canAnswer && "cursor-pointer hover:border-terracotta/40 hover:bg-terracotta/5",
                        !canAnswer && "cursor-default",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-medium",
                          showResult && isPicked && isCorrectOption && "bg-sage text-white",
                          showResult && isPicked && !isCorrectOption && "bg-destructive text-white",
                          showResult && !isPicked && isCorrectOption && "bg-sage/15 text-sage",
                          !(showResult && isCorrectOption) && !(showResult && isPicked) && "bg-muted text-muted-foreground",
                        )}
                      >
                        {showResult && isPicked && isCorrectOption ? (
                          <Check className="size-4" />
                        ) : showResult && isPicked && !isCorrectOption ? (
                          <X className="size-4" />
                        ) : (
                          (LETTERS[oi] ?? "?")
                        )}
                      </span>
                      <span className="text-base">{opt}</span>
                    </button>
                  );
                })}
              </div>

              {submittedAnswer !== null ? (
                <div
                  className={cn(
                    "mt-4 rounded-lg px-4 py-2.5 text-sm font-medium",
                    isCorrect ? "bg-sage/10 text-sage" : "bg-destructive/10 text-destructive",
                  )}
                >
                  {isCorrect ? "Correct!" : `Not quite — the correct answer is "${question.answer}".`}
                </div>
              ) : revealed && winner ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  Tap the option {winner.name} answered.
                </p>
              ) : null}
            </>
          ) : null}
        </div>

        {/* -- picker panel ------------------------------------------------ */}
        <div className="flex flex-col rounded-2xl border border-border bg-card p-5">
          {revealed && winner ? (
            <WinnerPanel
              name={winner.name}
              reducedMotion={reducedMotion}
              pickAttempt={pickAttempt}
              onPickAgain={pickAgain}
              onNext={goToNext}
              isLast={isLastQuestion}
              isCorrect={isCorrect}
            />
          ) : poolExhausted ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <span className="flex size-11 items-center justify-center rounded-full bg-terracotta/10 text-terracotta">
                <RotateCcw className="size-5" />
              </span>
              <p className="text-sm font-medium">Everyone has had a turn.</p>
              <Button onClick={startAnotherRound} variant="outline" size="sm">
                <RotateCcw className="size-3.5" />
                Start another round
              </Button>
            </div>
          ) : (
            <>
              <div className="text-center text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                Who&apos;s answering?
              </div>
              <div className="flex flex-1 items-center justify-center py-2">
                <Roller
                  phase={phase}
                  pickAttempt={pickAttempt}
                  poolNames={poolNames}
                  winnerName={winner?.name ?? null}
                  reducedMotion={reducedMotion}
                  onSpinComplete={handleSpinComplete}
                />
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <Button onClick={pick} disabled={!canPick} size="lg" className="w-full">
                  <Dices className={cn("size-4", phase === "picking" && !reducedMotion && "animate-spin")} />
                  {phase !== "idle" ? "Picking…" : "Pick a student"}
                </Button>
                <span className="text-xs text-muted-foreground">
                  {repeatStudents
                    ? "Students may be picked more than once"
                    : `${pool.length} student${pool.length === 1 ? "" : "s"} remaining`}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function WinnerPanel({
  name,
  reducedMotion,
  pickAttempt,
  onPickAgain,
  onNext,
  isLast,
  isCorrect,
}: {
  name: string;
  reducedMotion: boolean;
  pickAttempt: number;
  onPickAgain: () => void;
  onNext: () => void;
  isLast: boolean;
  isCorrect: boolean | null;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <span className="text-[11px] font-semibold tracking-[0.16em] text-terracotta uppercase">
        It&apos;s your turn!
      </span>
      <motion.div
        key={pickAttempt}
        initial={reducedMotion ? false : { scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 22 }}
        className="max-w-full truncate text-3xl font-medium text-foreground"
      >
        {name}
      </motion.div>
      {isCorrect === null ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-sage/10 px-2.5 py-1 text-xs font-medium text-sage">
          <Check className="size-3.5" />
          Selected
        </span>
      ) : (
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
            isCorrect ? "bg-sage/10 text-sage" : "bg-destructive/10 text-destructive",
          )}
        >
          {isCorrect ? <Check className="size-3.5" /> : <X className="size-3.5" />}
          {isCorrect ? "Correct" : "Incorrect"}
        </span>
      )}

      <div className="mt-4 flex w-full flex-col gap-2">
        <Button onClick={onNext} className="w-full bg-terracotta text-primary-foreground hover:bg-terracotta/90">
          {isLast ? "Finish quiz" : "Next question"}
          <ArrowRight className="size-4" />
        </Button>
        <button
          type="button"
          onClick={onPickAgain}
          className="inline-flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          <X className="size-3" />
          Pick again
        </button>
      </div>
    </div>
  );
}
