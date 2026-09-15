"use client";

import { ArrowRight, Layers } from "lucide-react";

import { useContextOptions } from "@/components/app/context-bar";
import { Select } from "@/components/ui/select";
import { useCurriculumT } from "@/lib/copy";
import { cn } from "@/lib/utils";

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-[13px] transition-colors",
        active
          ? "border-transparent bg-violet text-violet-foreground"
          : "border-border text-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

/** Page 1 -- class / subject / chapter, lifted straight from the existing
 *  quiz wizard's step 1 (app/(protected)/(app)/quiz/page.tsx) so the two
 *  flows feel identical up to this point. Reads/writes the same global
 *  lesson context (useContextOptions), so the orchestrator and the Students
 *  step see the same selection without prop-drilling. Renders only the body
 *  -- the shared header/back-link/step-indicator chrome lives in index.tsx. */
export function TopicsStep({ onContinue }: { onContinue: () => void }) {
  const t = useCurriculumT();
  const {
    gradeId,
    subjectId,
    chapterId,
    gradeOptions,
    subjectOptions,
    pickGrade,
    pickSubject,
    setChapter,
    chapters,
  } = useContextOptions();

  const orderedChapters = [...chapters].sort((a, b) => a.chapter_number - b.chapter_number);

  return (
    <div className="mt-8 flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Select Class</span>
          <Select
            ariaLabel="Select Class"
            placeholder="Select Class"
            value={gradeId}
            options={gradeOptions}
            onValueChange={pickGrade}
            className="w-full"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Select Subject</span>
          <Select
            ariaLabel="Select Subject"
            placeholder="Select Subject"
            value={subjectId}
            options={subjectOptions}
            onValueChange={pickSubject}
            className="w-full"
          />
        </label>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-violet-muted/60 text-violet">
            <Layers className="size-4" />
          </span>
          <div>
            <p className="text-sm font-medium">Chapters</p>
            <p className="text-xs text-muted-foreground">Select one chapter.</p>
          </div>
        </div>

        {!gradeId || !subjectId ? (
          <p className="mt-4 text-sm text-muted-foreground">Select Class · Select Subject</p>
        ) : orderedChapters.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No chapters found for this class and subject.
          </p>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            {orderedChapters.map((c) => (
              <Chip
                key={c.id}
                active={chapterId === c.id}
                onClick={() => setChapter(chapterId === c.id ? null : c.id)}
              >
                {t.chapter(c.title)}
              </Chip>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Select one chapter.</span>
        <button
          type="button"
          onClick={onContinue}
          disabled={!chapterId}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-40"
        >
          Continue
          <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
