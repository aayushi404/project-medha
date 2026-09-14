"use client";

import { Check, Dices, PartyPopper, RotateCcw } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ToolPanel } from "@/components/tools/form-kit";
import { Roller } from "@/components/tools/name-picker/roller";
import { parseStudents, selectRandomStudent, type PickableStudent } from "@/components/tools/name-picker/selection";
import { Switch } from "@/components/tools/name-picker/toggle";
import { usePrefersReducedMotion } from "@/components/tools/name-picker/use-reduced-motion";
import { WinnerDialog } from "@/components/tools/name-picker/winner-dialog";
import { cn } from "@/lib/utils";

type Phase = "idle" | "picking" | "landed";

// How long the winner sits emphasized in the roller before the celebration
// dialog opens -- a beat of anticipation, not a real delay.
const REVEAL_DELAY_MS = 550;
const REVEAL_DELAY_REDUCED_MS = 120;

export function NamePicker() {
  const [raw, setRaw] = useState("");
  const [noRepeat, setNoRepeat] = useState(true);
  const [pickedIds, setPickedIds] = useState<Set<string>>(new Set());
  const [phase, setPhase] = useState<Phase>("idle");
  const [winner, setWinner] = useState<PickableStudent | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pickAttempt, setPickAttempt] = useState(0);
  const [liveMessage, setLiveMessage] = useState("");

  // A ref, not state: pick() needs an always-current "is a pick in flight"
  // check that's readable synchronously even within the same event handler
  // that just changed phase (e.g. "Pick again" closing then re-picking) --
  // state from the same render pass would still read stale there.
  const busyRef = useRef(false);
  const reducedMotion = usePrefersReducedMotion();

  const students = useMemo(() => parseStudents(raw), [raw]);
  const pool = useMemo(
    () => (noRepeat ? students.filter((s) => !pickedIds.has(s.id)) : students),
    [students, noRepeat, pickedIds],
  );
  const poolNames = useMemo(() => pool.map((s) => s.name), [pool]);

  const roundComplete = noRepeat && students.length > 0 && pool.length === 0;
  // students.length >= 2, not pool.length >= 2: a no-repeat round legitimately
  // narrows the pool to a single remaining student right before it completes,
  // and that last pick must still be pickable.
  const canPick = phase === "idle" && students.length >= 2 && pool.length > 0 && !roundComplete;

  const validationMessage =
    students.length === 0
      ? "Add at least 2 students to use Random Picker."
      : students.length === 1
        ? "Add at least one more student."
        : null;

  const pick = useCallback(() => {
    if (busyRef.current || pool.length === 0) return;
    busyRef.current = true;

    // Winner is decided right now, before any animation -- but NOT marked
    // "picked" yet. That happens at reveal time (handleSpinComplete), so the
    // roster checklist and progress bar can't spoil the result while the
    // roller is still spinning.
    const chosen = selectRandomStudent(pool);
    setWinner(chosen);
    setPickAttempt((n) => n + 1);
    setPhase("picking");
    setLiveMessage("Picking a student…");
  }, [pool]);

  const handleSpinComplete = useCallback(() => {
    setPhase("landed");
    const chosen = winner;
    window.setTimeout(
      () => {
        setDialogOpen(true);
        if (chosen) {
          setLiveMessage(`${chosen.name} has been selected.`);
          // The reveal, not the selection: this is when the student is
          // actually marked picked, in step with the dialog announcing them.
          if (noRepeat) {
            setPickedIds((prev) => new Set(prev).add(chosen.id));
          }
        }
      },
      reducedMotion ? REVEAL_DELAY_REDUCED_MS : REVEAL_DELAY_MS,
    );
  }, [winner, reducedMotion, noRepeat]);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setPhase("idle");
    busyRef.current = false;
  }, []);

  const handlePickAgain = useCallback(() => {
    closeDialog();
    pick();
  }, [closeDialog, pick]);

  const resetRound = useCallback(() => {
    setPickedIds(new Set());
    setDialogOpen(false);
    setPhase("idle");
    setWinner(null);
    busyRef.current = false;
  }, []);

  return (
    <div className="flex flex-col gap-6">
      {/* Announces the two moments that matter -- not every cycling name. */}
      <div role="status" aria-live="polite" className="sr-only">
        {liveMessage}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(280px,360px)_1fr] lg:items-start">
        {/* -- Students panel ------------------------------------------------ */}
        <ToolPanel>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="np-students" className="text-sm font-medium">
              Students
            </label>
            <p className="text-xs text-muted-foreground">
              Add or paste student names, one per line.
            </p>
          </div>

          <textarea
            id="np-students"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={8}
            placeholder={"Aarav\nDiya\nKabir\n…"}
            className="w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              {students.length} student{students.length === 1 ? "" : "s"}
            </span>
            {validationMessage && (
              <span className="text-right text-xs text-destructive">{validationMessage}</span>
            )}
          </div>

          <div className="flex items-start justify-between gap-3 border-t border-border pt-4">
            <div className="flex flex-col gap-0.5">
              <span id="np-no-repeat-label" className="text-sm font-medium">
                No repeats
              </span>
              <span id="np-no-repeat-hint" className="text-xs text-muted-foreground">
                Each student is picked once before the round starts again.
              </span>
            </div>
            <Switch
              checked={noRepeat}
              onChange={setNoRepeat}
              aria-labelledby="np-no-repeat-label"
              aria-describedby="np-no-repeat-hint"
            />
          </div>

          {noRepeat && students.length > 0 && (
            <div className="flex flex-col gap-1.5 border-t border-border pt-4">
              <ol className="flex max-h-44 flex-col gap-0.5 overflow-y-auto">
                {students.map((s) => {
                  const isPicked = pickedIds.has(s.id);
                  return (
                    <li
                      key={s.id}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-md px-2 py-1 text-sm transition-colors",
                        isPicked && "text-muted-foreground/55",
                      )}
                    >
                      <span className="truncate">{s.name}</span>
                      {isPicked && (
                        <motion.span
                          initial={reducedMotion ? false : { scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: "spring", stiffness: 500, damping: 24 }}
                        >
                          <Check className="size-3.5 shrink-0 text-sage" aria-hidden />
                        </motion.span>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </ToolPanel>

        {/* -- Progress banner -- full width, below both panels on desktop --- */}
        {noRepeat && students.length > 0 && (
          <div className="flex flex-col items-center gap-2 lg:col-span-2 lg:row-start-2">
            <span className="text-xs text-muted-foreground">
              {pickedIds.size} / {students.length} picked
            </span>
            <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-terracotta transition-[width] duration-500 ease-out"
                style={{ width: `${(pickedIds.size / students.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* -- Picker hero ----------------------------------------------------- */}
        <div className="flex flex-col items-center gap-6 rounded-xl border border-border bg-card px-5 py-8 text-center lg:col-start-2 lg:row-start-1 lg:min-h-[26rem] lg:justify-center">
          {students.length === 0 && phase === "idle" ? (
            <div className="flex flex-col items-center gap-3">
              <span className="flex size-14 items-center justify-center rounded-full bg-accent text-terracotta">
                <Dices className="size-6" />
              </span>
              <div className="text-base font-medium">Ready to pick?</div>
              <p className="max-w-56 text-sm text-muted-foreground">
                Add some student names to get started.
              </p>
            </div>
          ) : roundComplete && phase === "idle" ? (
            <div className="flex flex-col items-center gap-3">
              <span className="flex size-14 items-center justify-center rounded-full bg-terracotta/10 text-terracotta">
                <PartyPopper className="size-6" />
              </span>
              <div className="text-base font-medium">Everyone has been picked!</div>
              <p className="max-w-64 text-sm text-muted-foreground">
                Every student has had a turn. Start a new round to go again.
              </p>
              <Button onClick={resetRound} className="mt-1">
                <RotateCcw className="size-4" /> Start new round
              </Button>
            </div>
          ) : (
            <>
              <div className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                Who&apos;s up next?
              </div>

              <Roller
                phase={phase}
                pickAttempt={pickAttempt}
                poolNames={poolNames}
                winnerName={winner?.name ?? null}
                reducedMotion={reducedMotion}
                onSpinComplete={handleSpinComplete}
              />

              <div className="flex flex-col items-center gap-2">
                <Button onClick={pick} disabled={!canPick} size="lg" className="min-w-44">
                  <Dices
                    className={cn("size-4", phase === "picking" && !reducedMotion && "animate-spin")}
                  />
                  {/* Stays "Picking…" through "landed" too, not just while the
                      reel is spinning -- it shouldn't look ready-to-go-again
                      before the dialog has actually revealed the winner. */}
                  {phase !== "idle" ? "Picking…" : "Pick a student"}
                </Button>
                {validationMessage && students.length === 1 && (
                  <p className="text-xs text-muted-foreground">{validationMessage}</p>
                )}
                {noRepeat && pickedIds.size > 0 && (
                  <button
                    type="button"
                    onClick={resetRound}
                    disabled={phase !== "idle"}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:pointer-events-none disabled:opacity-50"
                  >
                    <RotateCcw className="size-3" /> Reset round
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <WinnerDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
        winnerName={winner?.name ?? null}
        pickAttempt={pickAttempt}
        roundComplete={roundComplete}
        reducedMotion={reducedMotion}
        onPickAgain={handlePickAgain}
        onStartNewRound={resetRound}
      />
    </div>
  );
}
