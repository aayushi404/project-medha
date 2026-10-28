"use client";

import { TrendingUp } from "lucide-react";

import type { SyllabusCoverageApi } from "@/lib/api";

/** Horizontal strip of "your" syllabus progress, one chip per subject you
 * teach -- the direct, visible payoff of marking a chapter complete, right
 * where that action happens. */
export function MySyllabusProgress({
  isHi,
  coverage,
}: {
  isHi: boolean;
  coverage: SyllabusCoverageApi[] | null;
}) {
  if (coverage === null) return null;
  if (coverage.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <TrendingUp className="size-3.5 text-terracotta" />
        {isHi ? "आपकी पाठ्यक्रम प्रगति" : "Your syllabus progress"}
      </div>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
        {coverage.map((c) => (
          <div
            key={c.subject_id}
            className="flex shrink-0 flex-col gap-1 rounded-lg border border-border bg-background px-3 py-2 text-xs"
          >
            <span className="font-medium text-foreground">{c.subject_name}</span>
            <span className="text-muted-foreground">
              {c.chapters_covered}/{c.total_chapters} {isHi ? "अध्याय पूर्ण" : "chapters complete"} ({c.progress_percent}%)
            </span>
            <div className="h-1.5 w-28 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${c.progress_percent}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
