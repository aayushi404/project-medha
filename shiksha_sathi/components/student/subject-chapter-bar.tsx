"use client";

import { useEffect, useMemo, useState } from "react";
import { Languages } from "lucide-react";
import { toast } from "sonner";

import { Select } from "@/components/ui/select";
import { getChapters, type Chapter } from "@/lib/api";
import { useCopy, useCurriculumT } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { useStudentData, type ContentLanguage } from "@/lib/student-context";

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
  const { subjects, contentLanguage, setContentLanguage } = useStudentData();
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
      {contentLanguage ? (
        <ContentLanguageToggle value={contentLanguage} onChange={setContentLanguage} />
      ) : null}
    </div>
  );
}

/** Hindi/Hinglish pill toggle for the written answer language: notes,
 * practice and the Ask Medha chat all read this from the student's profile
 * (preferred_language). Voice replies aren't affected -- see student-context. */
function ContentLanguageToggle({
  value,
  onChange,
}: {
  value: ContentLanguage;
  onChange: (lang: ContentLanguage) => Promise<void>;
}) {
  const copy = useCopy();
  const [saving, setSaving] = useState(false);

  async function pick(lang: ContentLanguage) {
    if (lang === value || saving) return;
    setSaving(true);
    try {
      await onChange(lang);
      toast.success(copy.student.contentLanguageUpdated);
    } catch {
      toast.error(copy.student.contentLanguageFailed);
    } finally {
      setSaving(false);
    }
  }

  const options: { id: ContentLanguage; label: string }[] = [
    { id: "hi-BiharBoli", label: copy.student.contentLanguageHindi },
    { id: "hinglish", label: copy.student.contentLanguageHinglish },
  ];

  return (
    <div className="ml-auto flex items-center gap-1.5">
      <Languages className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <div
        role="radiogroup"
        aria-label={copy.student.contentLanguageLabel}
        className={cn(
          "flex items-center gap-0.5 rounded-full border border-border bg-muted/40 p-0.5",
          saving && "opacity-70",
        )}
      >
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={value === opt.id}
            disabled={saving}
            onClick={() => void pick(opt.id)}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
              value === opt.id
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
