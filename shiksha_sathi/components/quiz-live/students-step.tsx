"use client";

import { AlertCircle, ArrowLeft, Loader2, Search, Sparkles, Users, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Switch } from "@/components/shared/picker/toggle";
import type { RosterState } from "@/components/quiz-live/types";
import { cn } from "@/lib/utils";

/** Page 3 -- new page (no equivalent in the existing quiz wizard). The real
 *  class roster (getStudentRoster -> GET /teacher/students, the same API the
 *  teacher's own Students page uses) is fetched once by the orchestrator and
 *  handed down here already filtered to the class picked on page 1 -- so the
 *  live page later can reuse the exact same fetch instead of re-querying.
 *  Selection is session-only: it's never written back to the roster, and
 *  defaults to "everyone" the first time the roster loads. */
export function StudentsStep({
  gradeLabel,
  roster,
  onRetry,
  selectedIds,
  onSelectedChange,
  repeatStudents,
  onRepeatChange,
  onBack,
  onGenerate,
  generating,
}: {
  gradeLabel: string;
  roster: RosterState;
  onRetry: () => void;
  selectedIds: Set<string>;
  onSelectedChange: (next: Set<string>) => void;
  repeatStudents: boolean;
  onRepeatChange: (v: boolean) => void;
  onBack: () => void;
  onGenerate: () => void;
  generating: boolean;
}) {
  const [query, setQuery] = useState("");
  const seededRef = useRef(false);

  // A fresh "loading" status means the orchestrator started a new fetch (a
  // different class was picked on page 1) -- allow the pool to be defaulted
  // to "everyone" again for that class.
  useEffect(() => {
    if (roster.status === "loading") seededRef.current = false;
  }, [roster.status]);

  const students = useMemo(() => (roster.status === "ready" ? roster.students : []), [roster]);

  // Default the participant pool to "everyone in the class" the first time
  // the roster arrives -- once only, so it never fights the teacher's own
  // later add/remove choices.
  useEffect(() => {
    if (!seededRef.current && students.length > 0) {
      seededRef.current = true;
      onSelectedChange(new Set(students.map((s) => s.id)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) => s.full_name.toLowerCase().includes(q) || (s.roll_number ?? "").toLowerCase().includes(q),
    );
  }, [students, query]);

  function toggleOne(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectedChange(next);
  }

  const selectedCount = selectedIds.size;
  const canGenerate = selectedCount >= 1 && !generating && roster.status === "ready";

  return (
    <div className="mt-8 flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-medium">Select students</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">Choose who can be picked during the quiz.</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">Students</span>
          <span className="text-xs text-muted-foreground">
            {roster.status === "ready"
              ? students.length === selectedCount
                ? `${students.length} student${students.length === 1 ? "" : "s"}`
                : `${selectedCount} / ${students.length} selected`
              : gradeLabel
                ? gradeLabel
                : ""}
          </span>
        </div>

        {roster.status === "loading" ? (
          <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading students…
          </div>
        ) : roster.status === "error" ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-sm">
            <AlertCircle className="size-5 text-destructive" />
            <p className="text-muted-foreground">We couldn&apos;t load the students for this class.</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-1 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-muted"
            >
              Try again
            </button>
          </div>
        ) : roster.status === "empty" ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-sm">
            <Users className="size-5 text-muted-foreground" />
            <p className="text-muted-foreground">
              No approved students in {gradeLabel || "this class"} yet.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-3 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search students…"
                  className="h-9 w-full rounded-lg border border-border bg-background pr-3 pl-8 text-sm outline-none focus:border-ring"
                />
              </div>
              <button
                type="button"
                onClick={() => onSelectedChange(new Set(students.map((s) => s.id)))}
                className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-muted"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => onSelectedChange(new Set())}
                className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-muted"
              >
                Clear all
              </button>
            </div>

            {query.trim() ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Showing {filtered.length} of {students.length} students
              </p>
            ) : null}

            <ol className="mt-3 flex max-h-80 flex-col gap-1.5 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No students match &ldquo;{query}&rdquo;.
                </p>
              ) : (
                filtered.map((s) => {
                  const isSelected = selectedIds.has(s.id);
                  return (
                    <li key={s.id}>
                      <div
                        className={cn(
                          "flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors",
                          isSelected ? "border-border bg-transparent" : "border-border/60 bg-muted/40",
                        )}
                      >
                        <span
                          className={cn(
                            "w-7 shrink-0 text-xs font-medium tabular-nums",
                            isSelected ? "text-muted-foreground" : "text-muted-foreground/50",
                          )}
                        >
                          {s.roll_number ?? "—"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              "truncate text-sm",
                              !isSelected && "text-muted-foreground/70 line-through decoration-muted-foreground/40",
                            )}
                          >
                            {s.full_name}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground/70">{s.grade_label}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleOne(s.id)}
                          aria-label={isSelected ? `Remove ${s.full_name}` : `Add ${s.full_name} back`}
                          className={cn(
                            "shrink-0 rounded-full p-1.5 transition-colors",
                            isSelected
                              ? "text-sage hover:bg-sage/10"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground",
                          )}
                        >
                          {isSelected ? (
                            <svg viewBox="0 0 20 20" fill="none" className="size-4">
                              <path
                                d="M4 10.5l3.5 3.5L16 6"
                                stroke="currentColor"
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          ) : (
                            <X className="size-4" />
                          )}
                        </button>
                      </div>
                    </li>
                  );
                })
              )}
            </ol>
          </>
        )}

        <div className="mt-4 flex items-start justify-between gap-3 border-t border-border pt-4">
          <div className="flex flex-col gap-0.5">
            <span id="qlive-repeat-label" className="text-sm font-medium">
              Repeat students
            </span>
            <span id="qlive-repeat-hint" className="text-xs text-muted-foreground">
              Allow a student to be picked more than once during this quiz.
            </span>
          </div>
          <Switch
            checked={repeatStudents}
            onChange={onRepeatChange}
            aria-labelledby="qlive-repeat-label"
            aria-describedby="qlive-repeat-hint"
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          disabled={generating}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted disabled:opacity-40"
        >
          <ArrowLeft className="size-4" />
          Back
        </button>
        <button
          type="button"
          onClick={onGenerate}
          disabled={!canGenerate}
          className="inline-flex items-center gap-2 rounded-lg bg-terracotta px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-50"
        >
          {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {generating ? "Generating your quiz…" : "Generate quiz"}
        </button>
      </div>
      {selectedCount === 0 && roster.status === "ready" ? (
        <p className="-mt-3 text-right text-xs text-destructive">Select at least one student.</p>
      ) : null}
    </div>
  );
}
