"use client";

import { Lock, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import { useCopy } from "@/lib/copy";
import { cn } from "@/lib/utils";

/**
 * Wraps a real screen/section and shows it as a non-interactive preview under
 * a "locked" card. Nothing is removed -- the actual UI still renders (and
 * still fetches its real data) underneath, just blurred and inert, so people
 * can see what the feature looks like before it's switched on for their
 * school. Used for the early-access rollout: only Ask Medha and Work Update
 * are live at launch, everything else previews like this.
 */
export function FeatureLockOverlay({
  children,
  className,
  compact,
}: {
  children: ReactNode;
  className?: string;
  /** Smaller card for locking an in-page section rather than a whole screen. */
  compact?: boolean;
}) {
  const copy = useCopy();
  const t = copy.featureLock;

  return (
    <div className={cn("relative flex min-h-0 flex-1 flex-col overflow-hidden", className)}>
      <div
        aria-hidden
        inert
        className="pointer-events-none flex min-h-0 flex-1 flex-col overflow-hidden blur-[1px] select-none"
      >
        {children}
      </div>
      <div
        className={cn(
          "absolute inset-0 z-20 flex items-center justify-center bg-background/30 p-4",
          compact && "p-3",
        )}
      >
        <div
          className={cn(
            "flex max-w-sm flex-col items-center gap-2.5 rounded-2xl border border-border bg-card/95 text-center shadow-lg",
            compact ? "px-5 py-5" : "px-6 py-7",
          )}
        >
          <div className="flex size-11 items-center justify-center rounded-full bg-terracotta/15">
            <Lock className="size-5 text-terracotta" />
          </div>
          <h2 className="font-serif text-base font-bold text-foreground sm:text-lg">{t.title}</h2>
          <p className="text-xs text-muted-foreground sm:text-sm">{t.body}</p>
          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            <Sparkles className="size-3" /> {t.badge}
          </span>
        </div>
      </div>
    </div>
  );
}
