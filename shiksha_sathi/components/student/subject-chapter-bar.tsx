"use client";

import { useEffect, useMemo, useState } from "react";

import { Select } from "@/components/ui/select";
import { getChapters, type Chapter } from "@/lib/api";
import { useCopy, useCurriculumT } from "@/lib/copy";
import { useStudentData } from "@/lib/student-context";

export type SubjectChapter = {
  subjectId: string | null;
  chapterId: string | null;
  subjectName: string | null;
  chapterTitle: string | null;
  chapters: Chapter[];
  setSubjectId: (id: string) => void;
  setChapterId: (id: string | null) => void;
};

/** Shared subject -> chapter picker state for the student screens. Class is
 *  fixed to the student's own, so only subject + chapter are chosen. */
export function useSubjectChapter(): SubjectChapter {
  const { gradeId, subjects } = useStudentData();
  const [subjectId, setSubjectIdState] = useState<string | null>(null);
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [chaptersFetched, setChaptersFetched] = useState<Chapter[]>([]);

  useEffect(() => {
    if (!gradeId || !subjectId) return;
    let cancelled = false;
    getChapters(gradeId, subjectId)
      .then((c) => !cancelled && setChaptersFetched(c))
      .catch(() => !cancelled && setChaptersFetched([]));
    return () => {
      cancelled = true;
    };
  }, [gradeId, subjectId]);

  const chapters = gradeId && subjectId ? chaptersFetched : [];

  const setSubjectId = (id: string) => {
    setSubjectIdState(id);
    setChapterId(null);
  };

  const subjectName = subjects.find((s) => s.id === subjectId)?.name ?? null;
  const chapterTitle = chapters.find((c) => c.id === chapterId)?.title ?? null;

  return {
    subjectId,
    chapterId,
    subjectName,
    chapterTitle,
    chapters,
    setSubjectId,
    setChapterId,
  };
}

export function SubjectChapterBar({
  picker,
  className,
}: {
  picker: SubjectChapter;
  className?: string;
}) {
  const copy = useCopy();
  const t = useCurriculumT();
  const { subjects } = useStudentData();
  const { subjectId, chapterId, chapters, setSubjectId, setChapterId } = picker;

  const subjectOptions = useMemo(
    () => subjects.map((s) => ({ value: s.id, label: t.subject(s.name) })),
    [subjects, t],
  );
  const chapterOptions = useMemo(
    () => chapters.map((c) => ({ value: c.id, label: t.chapter(c.title) })),
    [chapters, t],
  );

  return (
    <div
      className={
        className ??
        "flex flex-wrap items-center gap-2 border-b border-border px-5 py-3"
      }
    >
      <Select
        ariaLabel={copy.selectSubject}
        placeholder={copy.selectSubject}
        value={subjectId}
        options={subjectOptions}
        onValueChange={setSubjectId}
      />
      <Select
        ariaLabel={copy.selectChapter}
        placeholder={copy.selectChapter}
        value={chapterId}
        options={chapterOptions}
        onValueChange={(v) => setChapterId(v)}
        className="max-w-[16rem]"
      />
    </div>
  );
}
