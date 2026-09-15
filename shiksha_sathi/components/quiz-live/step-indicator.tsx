"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

const STEP_LABELS = ["Topics", "Quiz settings", "Students", "Review"] as const;

/** The ✓ Topics → 2 Quiz settings → 3 Students → 4 Review pill row shown on
 *  pages 1-4 (the live page, 5, has its own compact header instead). */
export function StepIndicator({ active }: { active: 1 | 2 | 3 | 4 }) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm">
      {STEP_LABELS.map((label, i) => {
        const n = i + 1;
        const state = n < active ? "done" : n === active ? "active" : "pending";
        return (
          <div key={label} className="flex items-center gap-3">
            {i > 0 ? <span aria-hidden className="h-px w-8 bg-border" /> : null}
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-xs font-medium",
                  state === "active" && "bg-violet text-violet-foreground",
                  state === "done" && "bg-violet/15 text-violet",
                  state === "pending" && "bg-muted text-muted-foreground",
                )}
              >
                {state === "done" ? <Check className="size-3.5" /> : n}
              </span>
              <span
                className={cn(
                  state === "active" && "font-medium text-foreground",
                  state === "done" && "text-violet",
                  state === "pending" && "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
