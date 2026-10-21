"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, TrendingUp } from "lucide-react";

import { getSyllabusCoverage, type SyllabusCoverageApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const SYLLABUS_BAR_COLORS = ["bg-emerald-500", "bg-blue-500", "bg-amber-500", "bg-purple-500", "bg-rose-500"];

/** Live at launch (unlike the rest of the Analytics Hub): per-subject
 * syllabus progress derived from teachers' work updates against the real
 * chapter count for this school's current grades. */
export function PrincipalSyllabusCoverage() {
  const { accessToken } = useAuth();
  const [coverage, setCoverage] = useState<SyllabusCoverageApi[] | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    getSyllabusCoverage(accessToken)
      .then((result) => {
        if (active) setCoverage(result);
      })
      .catch(() => {
        // quiet -- this is a glance card, a real failure shouldn't block the page
      });
    return () => {
      active = false;
    };
  }, [accessToken]);

  const syllabusData = useMemo(() => {
    if (!coverage) return null;
    return coverage.map((s, i) => ({
      subject: s.subject_name,
      progress: s.progress_percent,
      chaptersCovered: s.chapters_covered,
      totalChapters: s.total_chapters,
      color: SYLLABUS_BAR_COLORS[i % SYLLABUS_BAR_COLORS.length],
    }));
  }, [coverage]);

  const avgSyllabusProgress = useMemo(() => {
    if (!coverage || coverage.length === 0) return null;
    return Math.round(coverage.reduce((sum, s) => sum + s.progress_percent, 0) / coverage.length);
  }, [coverage]);

  return (
    <div className="space-y-4">
      {/* Avg. Syllabus Coverage */}
      <div className="flex items-center gap-3.5 rounded-xl border border-border bg-card p-4 shadow-xs">
        <div className="flex size-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
          <BookOpen className="size-5" />
        </div>
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Avg. Syllabus Coverage
          </div>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">
              {avgSyllabusProgress !== null ? `${avgSyllabusProgress}%` : "…"}
            </span>
            <span className="text-xs text-blue-600 font-medium dark:text-blue-400">Across all subjects</span>
          </div>
        </div>
      </div>

      {/* Subject Syllabus Coverage Progress */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-4 text-blue-500" />
            <h3 className="text-xs font-semibold text-foreground">Curriculum & Syllabus Completion</h3>
          </div>
          <span className="text-[11px] text-muted-foreground">Academic Year 2026-27</span>
        </div>

        <div className="mt-4 space-y-3">
          {!syllabusData ? (
            <p className="py-4 text-center text-xs text-muted-foreground">Loading…</p>
          ) : syllabusData.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              No classes set up yet for this academic year.
            </p>
          ) : (
            syllabusData.map((s) => (
              <div key={s.subject} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-foreground">{s.subject}</span>
                  <span className="text-muted-foreground">
                    {s.chaptersCovered} of {s.totalChapters} Chapters ({s.progress}%)
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${s.color} transition-all duration-500`}
                    style={{ width: `${s.progress}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
