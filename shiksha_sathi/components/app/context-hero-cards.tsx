"use client";

import { BookMarked, School } from "lucide-react";

import { useContextOptions } from "@/components/app/context-bar";
import { Select } from "@/components/ui/select";
import { useCopy, useCurriculumT } from "@/lib/copy";

/**
 * SAVRA-style hero cards for /ask's empty state -- stands in for SAVRA's own
 * task-shortcut cards (Rubric / Short report), which don't apply here. Hosts
 * this app's grade/subject/chapter selection instead, sharing option-building
 * with the compact ContextBar via useContextOptions().
 */
export function ContextHeroCards() {
  const copy = useCopy();
  const t = useCurriculumT();
  const {
    gradeId,
    subjectId,
    chapterId,
    gradeOptions,
    subjectOptions,
    chapterOptions,
    pickGrade,
    pickSubject,
    setChapter,
    pairs,
    chapters,
  } = useContextOptions();

  const pickedPair = pairs.find((p) => p.grade_id === gradeId && p.subject_id === subjectId);
  const classSubjectDesc = pickedPair
    ? `${t.grade(pickedPair.grade_label)} • ${t.subject(pickedPair.subject_name)}`
    : copy.askHero.classSubjectPlaceholder;

  const pickedChapter = chapters.find((c) => c.id === chapterId);
  const chapterDesc = pickedChapter
    ? t.chapter(pickedChapter.title)
    : copy.askHero.chapterPlaceholder;

  return (
    <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
      <div className="rounded-3xl border border-violet/20 bg-violet-muted/40 p-4">
        <span className="flex size-10 items-center justify-center rounded-2xl bg-violet/15 text-violet">
          <School className="size-5" />
        </span>
        <div className="mt-3">
          <p className="text-sm font-medium">{copy.askHero.classSubjectTitle}</p>
          <p className="truncate text-xs text-muted-foreground">{classSubjectDesc}</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Select
            ariaLabel={copy.selectClass}
            placeholder={copy.selectClass}
            value={gradeId}
            options={gradeOptions}
            onValueChange={pickGrade}
          />
          <Select
            ariaLabel={copy.selectSubject}
            placeholder={copy.selectSubject}
            value={subjectId}
            options={subjectOptions}
            onValueChange={pickSubject}
          />
        </div>
      </div>

      <div className="rounded-3xl border border-violet/20 bg-violet-muted/40 p-4">
        <span className="flex size-10 items-center justify-center rounded-2xl bg-violet/15 text-violet">
          <BookMarked className="size-5" />
        </span>
        <div className="mt-3">
          <p className="text-sm font-medium">{copy.askHero.chapterTitle}</p>
          <p className="truncate text-xs text-muted-foreground">{chapterDesc}</p>
        </div>
        <div className="mt-3">
          <Select
            ariaLabel={copy.selectChapter}
            placeholder={copy.selectChapter}
            value={chapterId}
            options={chapterOptions}
            onValueChange={(c) => setChapter(c)}
            className="max-w-full"
          />
        </div>
      </div>
    </div>
  );
}
