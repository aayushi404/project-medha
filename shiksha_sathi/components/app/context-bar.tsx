"use client";

import { Select, type SelectOption } from "@/components/ui/select";
import { useCopy, useCurriculumT } from "@/lib/copy";
import { useLessonContext } from "@/lib/lesson-context";

/** Grade/subject/chapter option-building shared between ContextBar and the
 * /ask empty-state hero cards (components/app/context-hero-cards.tsx). */
export function useContextOptions() {
  const t = useCurriculumT();
  const { gradeId, subjectId, chapterId, options, setGradeSubject, setChapter } =
    useLessonContext();
  const { pairs, chapters } = options;

  const gradeOptions: SelectOption[] = [];
  const gradeSeen = new Map<string, number>();
  for (const p of pairs) {
    if (!gradeSeen.has(p.grade_id)) {
      gradeSeen.set(p.grade_id, p.numeric_level);
      gradeOptions.push({ value: p.grade_id, label: t.grade(p.grade_label) });
    }
  }
  gradeOptions.sort((a, b) => (gradeSeen.get(a.value) ?? 0) - (gradeSeen.get(b.value) ?? 0));

  const subjectOptions: SelectOption[] = [];
  const subjectSeen = new Set<string>();
  for (const p of pairs) {
    if (p.grade_id === gradeId && !subjectSeen.has(p.subject_id)) {
      subjectSeen.add(p.subject_id);
      subjectOptions.push({ value: p.subject_id, label: t.subject(p.subject_name) });
    }
  }

  const chapterOptions: SelectOption[] = chapters.map((c) => ({
    value: c.id,
    label: t.chapter(c.title),
  }));

  function pickGrade(nextGrade: string) {
    const keep = pairs.find((p) => p.grade_id === nextGrade && p.subject_id === subjectId);
    const next = keep ?? pairs.find((p) => p.grade_id === nextGrade);
    if (next) setGradeSubject(next.grade_id, next.subject_id);
  }

  function pickSubject(nextSubject: string) {
    if (gradeId) setGradeSubject(gradeId, nextSubject);
  }

  return {
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
  };
}

export function ContextBar() {
  const copy = useCopy();
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
  } = useContextOptions();

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
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
      <Select
        ariaLabel={copy.selectChapter}
        placeholder={copy.selectChapter}
        value={chapterId}
        options={chapterOptions}
        onValueChange={(c) => setChapter(c)}
        className="max-w-[16rem]"
      />
    </div>
  );
}
