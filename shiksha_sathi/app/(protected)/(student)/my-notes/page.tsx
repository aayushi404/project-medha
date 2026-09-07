"use client";

import { Loader2, NotebookText } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  SubjectChapterBar,
  useSubjectChapter,
} from "@/components/student/subject-chapter-bar";
import { getChapterNotes, type ChapterNote } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCopy, useCurriculumT } from "@/lib/copy";

export default function NotesPage() {
  const { accessToken } = useAuth();
  const copy = useCopy();
  const t = useCurriculumT();
  const picker = useSubjectChapter();
  const { subjectId, chapterId, chapters, chapterTitle, setChapterId } = picker;

  const [note, setNote] = useState<ChapterNote | null>(null);
  // Tracks which chapter's note is currently loaded, rather than a plain
  // boolean, so "loading" is derived (chapterId !== loadedFor) instead of
  // toggled from inside the effect.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken || !chapterId) return;
    let active = true;
    getChapterNotes(accessToken, chapterId)
      .then((n) => active && setNote(n))
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not load."))
      .finally(() => {
        if (active) setLoadedFor(chapterId);
      });
    return () => {
      active = false;
    };
  }, [accessToken, chapterId]);

  const chapterPicked = !!subjectId && !!chapterId;
  const loading = chapterPicked && chapterId !== loadedFor;

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <h1 className="text-[15px]">{copy.student.notesTitle}</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">{copy.student.notesSub}</p>
      </div>

      <SubjectChapterBar picker={picker} />

      <div className="flex-1 overflow-y-auto">
        {!subjectId ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-20 text-center">
            <NotebookText className="size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{copy.student.notesPickSubject}</p>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-2xl px-5 py-5">
            {chapters.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {chapters.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setChapterId(c.id)}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      chapterId === c.id
                        ? "border-transparent bg-accent text-accent-foreground"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {c.chapter_number}. {t.chapter(c.title)}
                  </button>
                ))}
              </div>
            )}

            {!chapterPicked ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                {copy.student.notesChooseChapter}
              </p>
            ) : loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : note ? (
              <article className="flex flex-col gap-5">
                <header>
                  <h2 className="text-lg font-medium">{t.chapter(chapterTitle ?? "")}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{note.summary}</p>
                </header>

                {note.key_points.length > 0 && (
                  <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                    <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      {copy.student.keyPoints}
                    </h3>
                    <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm">
                      {note.key_points.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </section>
                )}

                {note.important_terms.length > 0 && (
                  <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                    <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      {copy.student.importantTerms}
                    </h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {note.important_terms.map((term, i) => (
                        <span
                          key={i}
                          className="rounded-full bg-muted px-2.5 py-1 text-xs text-foreground"
                        >
                          {term}
                        </span>
                      ))}
                    </div>
                  </section>
                )}
              </article>
            ) : (
              <div className="flex flex-col items-center gap-3 rounded-xl bg-card p-8 text-center ring-1 ring-foreground/10">
                <NotebookText className="size-6 text-muted-foreground" />
                <p className="text-sm font-medium">
                  {copy.student.notesPreparing(t.chapter(chapterTitle ?? ""))}
                </p>
                <p className="max-w-sm text-xs text-muted-foreground">
                  {copy.student.notesPreparingBody}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
