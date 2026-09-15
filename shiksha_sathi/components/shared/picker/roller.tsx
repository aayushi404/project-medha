"use client";

import { motion } from "motion/react";
import { useMemo } from "react";

import { cn } from "@/lib/utils";

export type RollerPhase = "idle" | "picking" | "landed";

const ITEM_HEIGHT = 56; // px, matches the h-14 rows below
const VISIBLE_COUNT = 5; // odd, so there's a clean single center row
const CENTER_INDEX = Math.floor(VISIBLE_COUNT / 2);

const SPIN_STEPS = 26; // constant regardless of class size -- a big roster
// just means more filler *choices*, not a longer reel to render
const SPIN_DURATION = 3.9; // seconds, within the 3-4.5s target
const REDUCED_SPIN_STEPS = 2;
const REDUCED_DURATION = 0.32;

/** Vertical offset that centers `index` in the viewport. */
function yFor(index: number): number {
  return (CENTER_INDEX - index) * ITEM_HEIGHT;
}

/** A short, deterministic preview loop for the idle roller -- just enough to
 *  read as "this is a wheel of names", not an actual selection. */
function buildIdlePreview(names: string[]): string[] {
  if (names.length === 0) return [];
  return Array.from({ length: VISIBLE_COUNT }, (_, i) => names[i % names.length]);
}

/** The animated sequence for one spin: `steps` cosmetic filler names, then the
 *  real winner as the final (and only meaningful) entry. Consecutive fillers
 *  are nudged to avoid repeating so the cycling reads as lively, not stuck. */
function buildReel(names: string[], winnerName: string, steps: number): string[] {
  const reel: string[] = [];
  let previous: string | null = null;
  for (let i = 0; i < steps; i++) {
    let candidate = names[Math.floor(Math.random() * names.length)];
    let guard = 0;
    while (candidate === previous && names.length > 1 && guard < 5) {
      candidate = names[Math.floor(Math.random() * names.length)];
      guard += 1;
    }
    reel.push(candidate);
    previous = candidate;
  }
  reel.push(winnerName);
  return reel;
}

export function Roller({
  phase,
  pickAttempt,
  poolNames,
  winnerName,
  reducedMotion,
  onSpinComplete,
}: {
  phase: RollerPhase;
  /** Bumped once per pick attempt; remounts the animated strip so every spin
   *  starts clean rather than interpolating from wherever the last one left off. */
  pickAttempt: number;
  /** Display names available at pick time, used only as cosmetic filler. */
  poolNames: string[];
  winnerName: string | null;
  reducedMotion: boolean;
  onSpinComplete: () => void;
}) {
  const idlePreview = useMemo(() => buildIdlePreview(poolNames), [poolNames]);

  // The reel *data* for the current/most recent pick attempt -- built once
  // per attempt (keyed on pickAttempt alone, deliberately not on poolNames)
  // so a no-repeat pick shrinking the pool at reveal time never rebuilds this
  // with a fresh random filler set mid-reveal. May be stale after a reset
  // (winnerName back to null); that's fine, `reel` below never uses it then.
  const builtReel = useMemo(() => {
    if (winnerName === null) return null;
    const steps = reducedMotion ? REDUCED_SPIN_STEPS : SPIN_STEPS;
    return buildReel(poolNames.length > 0 ? poolNames : [winnerName], winnerName, steps);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickAttempt]);

  // Whether to actually *show* that reel right now vs. the calm idle preview.
  // True through BOTH "picking" and "landed" -- not just "picking" -- because
  // the parent still holds `phase: "landed"` for a beat before the dialog
  // opens, and picking a student (no-repeat) removes them from `poolNames` at
  // that same moment; if the reel dropped back to the idle preview here it
  // would visibly "reset" to an unrelated set of names right as the winner is
  // revealed. Only once fully idle (dialog closed) does it go back to calm.
  const reel = (phase === "picking" || phase === "landed") && winnerName !== null ? builtReel : null;

  const sequence = reel ?? idlePreview;
  const restIndex = reel ? reel.length - 1 : CENTER_INDEX;

  // Full choreography: quick spin-up, a fast cruise, then a long, weighty
  // deceleration that lands exactly on the winner -- the anticipation beat.
  const rampSteps = reel ? Math.min(3, reel.length - 1) : 0;
  const cruiseSteps = reel ? Math.max(rampSteps, reel.length - 1 - 6) : 0;

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        // Fixed width, not w-full: everything below is position:absolute, so
        // this box has no intrinsic content size of its own to fall back on,
        // and it sits inside more than one shrink-to-fit flex/items-center
        // ancestor -- a percentage width here resolves against an
        // indeterminate chain and collapses to 0 in exactly that combination.
        className="relative w-72 max-w-full overflow-hidden"
        style={{
          height: VISIBLE_COUNT * ITEM_HEIGHT,
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent 0%, black 22%, black 78%, transparent 100%)",
          maskImage:
            "linear-gradient(to bottom, transparent 0%, black 22%, black 78%, transparent 100%)",
        }}
        aria-hidden
      >
        {/* center selection band -- makes the "landing zone" obvious even at rest */}
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 z-10 rounded-lg border transition-colors duration-300",
            phase === "landed"
              ? "border-terracotta/60 bg-terracotta/[0.07]"
              : "border-border bg-accent/40",
          )}
          style={{ top: CENTER_INDEX * ITEM_HEIGHT, height: ITEM_HEIGHT }}
        />

        <motion.div
          key={reel ? pickAttempt : "idle"}
          initial={{ y: yFor(0) }}
          animate={
            reel
              ? reducedMotion
                ? { y: yFor(restIndex) }
                : { y: [yFor(0), yFor(rampSteps), yFor(cruiseSteps), yFor(restIndex)] }
              : { y: yFor(CENTER_INDEX) }
          }
          transition={
            reel
              ? reducedMotion
                ? { duration: REDUCED_DURATION, ease: "easeOut" }
                : {
                    duration: SPIN_DURATION,
                    times: [0, 0.12, 0.55, 1],
                    ease: ["easeIn", "linear", "circOut"],
                  }
              : { duration: 0 }
          }
          onAnimationComplete={() => {
            if (reel) onSpinComplete();
          }}
          className="absolute inset-x-0 top-0"
        >
          {sequence.map((name, i) => {
            // Only the *stationary* center row gets emphasis -- never a row
            // mid-flight past the band, even if it happens to share the
            // winner's array index, so nothing looks "sized wrong" mid-spin.
            const isCenter = i === restIndex && phase !== "picking";
            const justLanded = isCenter && phase === "landed";
            return (
              <div
                key={i}
                style={{ height: ITEM_HEIGHT }}
                className="flex items-center justify-center px-3"
              >
                <motion.span
                  key={justLanded ? `landed-${pickAttempt}` : "static"}
                  initial={justLanded && !reducedMotion ? { scale: 0.8, opacity: 0.5 } : false}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 420, damping: 20 }}
                  className={cn(
                    "block max-w-[15rem] truncate text-center",
                    isCenter
                      ? "text-2xl font-medium text-foreground"
                      : "text-base text-muted-foreground/70",
                  )}
                >
                  {name}
                </motion.span>
              </div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}
