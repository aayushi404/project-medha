"use client";

import { Download, FileText, NotebookText } from "lucide-react";
import { toast } from "sonner";

import {
  SubjectChapterBar,
  useSubjectChapter,
} from "@/components/student/subject-chapter-bar";
import { Button } from "@/components/ui/button";
import { useCopy, useCurriculumT } from "@/lib/copy";
import { noteFor } from "@/lib/student-content";
import { cn } from "@/lib/utils";

export default function NotesPage() {
  const copy = useCopy();
  const t = useCurriculumT();
  const picker = useSubjectChapter();
  const { subjectId, chapterId, chapters, chapterTitle, setChapterId } = picker;

  const chapterPicked = !!subjectId && !!chapterId;
  const note = noteFor(chapterTitle);

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
            <p className="text-sm text-muted-foreground">
              {copy.student.notesPickSubject}
            </p>
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
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs transition-colors",
                      chapterId === c.id
                        ? "border-transparent bg-accent text-accent-foreground"
                        : "border-border text-muted-foreground hover:bg-muted",
                    )}
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
            ) : note ? (
              <article className="flex flex-col gap-5">
                <header className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-medium">{t.chapter(chapterTitle)}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{note.summary}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => toast(copy.student.pdfSoon)}
                  >
                    <Download className="size-3.5" />
                    PDF
                  </Button>
                </header>

                <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                  <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {copy.student.keyPoints}
                  </h3>
                  <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm">
                    {note.keyPoints.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </section>

                {note.sections.map((s, i) => (
                  <section key={i}>
                    <h3 className="text-sm font-medium">{s.heading}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {s.body}
                    </p>
                  </section>
                ))}

                <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                  <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {copy.student.importantTerms}
                  </h3>
                  <dl className="mt-2 flex flex-col gap-2 text-sm">
                    {note.glossary.map((g, i) => (
                      <div key={i}>
                        <dt className="font-medium">{g.term}</dt>
                        <dd className="text-muted-foreground">{g.meaning}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              </article>
            ) : (
              <div className="flex flex-col items-center gap-3 rounded-xl bg-card p-8 text-center ring-1 ring-foreground/10">
                <FileText className="size-6 text-muted-foreground" />
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
