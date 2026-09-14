"use client";

import { Dialog } from "@base-ui/react/dialog";
import { PartyPopper } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const CONFETTI_COLORS = ["var(--terracotta)", "var(--gold)", "var(--sage)", "var(--earth)"];

function randomPieces() {
  return Array.from({ length: 16 }, (_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * 260,
    rotate: Math.random() * 360,
    delay: Math.random() * 0.15,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    size: 5 + Math.random() * 4,
    round: Math.random() > 0.5,
  }));
}

/** A restrained confetti burst -- ~16 small pieces, not a screenful. Built by
 *  hand with a few Motion elements rather than pulling in a confetti library
 *  the project doesn't otherwise need. Mount this keyed by pick attempt (see
 *  below) so every reveal gets its own fresh random burst, not a rerun of the
 *  first one -- a lazy useState initializer, not useMemo, is where "run this
 *  impure randomiser exactly once per mount" belongs. */
function Confetti({ reducedMotion }: { reducedMotion: boolean }) {
  const [pieces] = useState(randomPieces);

  if (reducedMotion) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-6 flex justify-center overflow-visible" aria-hidden>
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
          animate={{ x: p.x, y: 140, opacity: 0, rotate: p.rotate }}
          transition={{ duration: 1.1, delay: p.delay, ease: "easeOut" }}
          className="absolute"
          style={{
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: p.round ? "9999px" : "2px",
          }}
        />
      ))}
    </div>
  );
}

export function WinnerDialog({
  open,
  onOpenChange,
  winnerName,
  pickAttempt,
  roundComplete,
  reducedMotion,
  onPickAgain,
  onStartNewRound,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  winnerName: string | null;
  /** Identifies this specific pick -- used to key the confetti burst so each
   *  reveal gets a fresh random scatter instead of replaying the last one. */
  pickAttempt: number;
  /** True when this pick used up the last remaining student in a no-repeat round. */
  roundComplete: boolean;
  reducedMotion: boolean;
  onPickAgain: () => void;
  onStartNewRound: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/45 transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup
          className={cn(
            "fixed top-1/2 left-1/2 z-50 w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2",
            "overflow-hidden rounded-2xl border border-border bg-card p-7 text-center text-card-foreground shadow-lg outline-none",
            "transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
            "data-[starting-style]:translate-y-2 data-[starting-style]:scale-90 data-[starting-style]:opacity-0",
            "data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
          )}
        >
          {winnerName ? <Confetti key={pickAttempt} reducedMotion={reducedMotion} /> : null}

          <span className="relative mx-auto flex size-11 items-center justify-center rounded-full bg-terracotta/10 text-terracotta">
            <PartyPopper className="size-5" />
          </span>

          <p className="relative mt-4 text-[11px] font-semibold tracking-[0.18em] text-terracotta uppercase">
            We have a winner!
          </p>
          <p className="relative mt-1 text-sm text-muted-foreground">It&apos;s time for…</p>

          <Dialog.Title className="relative mt-2 text-4xl font-medium text-balance break-words text-foreground">
            {winnerName ?? ""}
          </Dialog.Title>

          <div className="relative mt-6 flex flex-col gap-2">
            <Button
              onClick={roundComplete ? onStartNewRound : onPickAgain}
              className="w-full bg-terracotta text-primary-foreground hover:bg-terracotta/90"
              size="lg"
            >
              {roundComplete ? "Start new round" : "Pick again"}
            </Button>
            <Dialog.Close
              render={
                <Button variant="ghost" size="sm">
                  Close
                </Button>
              }
            />
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
