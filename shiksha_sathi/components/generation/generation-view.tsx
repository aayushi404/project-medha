"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { ArtifactCard } from "@/components/dashboard/artifact-card";
import type {
  DeckContent,
  QuizContent as LegacyQuizContent,
} from "@/lib/api";
import { generationExportUrl } from "@/lib/api";
import { MARKDOWN_CLASS } from "@/lib/artifact";
import { useCopy } from "@/lib/copy";
import type {
  GenerationType,
  LessonPlanContent,
  NotesContent,
  QuestionPaperContent,
} from "@/lib/generation-types";
import { cn } from "@/lib/utils";

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card p-4">
      {children}
    </div>
  );
}

function LessonPlanView({ content, title }: { content: LessonPlanContent; title: string }) {
  const copy = useCopy().generation.viewer.lessonPlan;
  const periods = content.periods_detail ?? [];
  const cols: [string, keyof LessonPlanContent["periods_detail"][number]][] = [
    [copy.concept, "concept"],
    [copy.objective, "learning_objective"],
    [copy.outcomes, "learning_outcomes"],
    [copy.process, "teacher_learning_process"],
    [copy.assessment, "assessment"],
    [copy.resources, "resources"],
  ];
  return (
    <Card>
      <div className="mb-3">
        <p className="text-sm font-medium">{content.topic || title}</p>
        <p className="text-xs text-muted-foreground">
          {copy.period} 1–{content.periods || periods.length}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-border">
              <th className="sticky left-0 z-10 bg-card px-2 py-2 text-xs font-medium text-muted-foreground">
                {copy.period}
              </th>
              {cols.map(([label]) => (
                <th key={label} className="px-3 py-2 text-xs font-medium text-muted-foreground">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map((p) => (
              <tr key={p.period_no} className="border-b border-border/60 align-top">
                <td className="sticky left-0 z-10 bg-card px-2 py-2 text-sm font-medium tabular-nums">
                  {p.period_no}
                </td>
                {cols.map(([label, key]) => (
                  <td key={label} className="max-w-[220px] px-3 py-2 whitespace-pre-wrap text-muted-foreground">
                    {String(p[key] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {content.homework ? (
        <div className="mt-3 rounded-lg border border-border/70 bg-muted/40 p-2.5 text-xs">
          <span className="font-medium text-foreground">{copy.homework}. </span>
          <span className="text-muted-foreground">{content.homework}</span>
        </div>
      ) : null}
    </Card>
  );
}

function QuestionPaperView({ content }: { content: QuestionPaperContent }) {
  const copy = useCopy().generation.viewer.questionPaper;
  const sections = content.sections ?? [];
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{copy.totalMarks(content.total_marks)}</span>
        <span>·</span>
        <span>{copy.duration(content.duration_min)}</span>
      </div>
      {content.general_instructions?.length ? (
        <div className="mb-3 rounded-lg border border-border/70 bg-muted/40 p-2.5 text-xs">
          <p className="mb-1 font-medium text-foreground">{copy.instructions}</p>
          <ul className="list-disc pl-4 text-muted-foreground">
            {content.general_instructions.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="flex flex-col gap-4">
        {sections.map((s, si) => (
          <div key={si}>
            <p className="text-sm font-medium">{s.name}</p>
            {s.instructions ? (
              <p className="mb-2 text-xs text-muted-foreground">{s.instructions}</p>
            ) : null}
            <ol className="flex flex-col gap-2">
              {s.questions.map((q, qi) => (
                <li key={qi} className="flex items-start gap-2.5 rounded-xl border border-border/70 p-2.5 text-[13px]">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium tabular-nums">
                    {qi + 1}
                  </span>
                  <span className="flex-1 whitespace-pre-wrap">{q.text}</span>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                    {copy.marksLabel(q.marks)}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </Card>
  );
}

function NotesView({ content }: { content: NotesContent }) {
  const copy = useCopy().generation.viewer.notes;
  return (
    <Card>
      <div className="flex flex-col gap-4">
        {(content.sections ?? []).map((s, i) => (
          <div key={i}>
            <p className="text-sm font-medium">{s.heading}</p>
            <div className={cn(MARKDOWN_CLASS, "mt-1")}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{s.body_md}</ReactMarkdown>
            </div>
            {s.key_points?.length ? (
              <div className="mt-2 rounded-lg bg-muted/40 p-2.5">
                <p className="mb-1 text-[11px] font-medium text-muted-foreground">
                  {copy.keyPoints}
                </p>
                <ul className="list-disc pl-4 text-[13px]">
                  {s.key_points.map((k, j) => (
                    <li key={j}>{k}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ))}
      </div>
      {content.summary ? (
        <div className="mt-4 rounded-lg border border-border/70 bg-muted/40 p-2.5 text-xs">
          <p className="mb-1 font-medium text-foreground">{copy.summary}</p>
          <p className="text-muted-foreground">{content.summary}</p>
        </div>
      ) : null}
      {content.important_terms?.length ? (
        <div className="mt-3">
          <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
            {copy.importantTerms}
          </p>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-[13px] sm:grid-cols-2">
            {content.important_terms.map((t, i) => (
              <div key={i} className="flex gap-1.5">
                <dt className="font-medium">{t.term}:</dt>
                <dd className="text-muted-foreground">{t.meaning}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </Card>
  );
}

/** Renders any generation type's `content_json`. Quiz + presentation reuse
 * `ArtifactCard` (the chat/module artifact viewer) since the shapes match. */
export function GenerationView({
  type,
  title,
  content,
  generationId,
}: {
  type: GenerationType;
  title: string;
  content: unknown;
  generationId: string;
}) {
  if (type === "quiz") {
    return <ArtifactCard type="quiz" content={content as LegacyQuizContent} />;
  }
  if (type === "presentation") {
    return (
      <ArtifactCard
        type="ppt"
        content={content as DeckContent}
        downloadUrl={generationExportUrl(generationId, "pptx")}
        filename={title}
      />
    );
  }
  if (type === "lesson_plan") {
    return <LessonPlanView content={content as LessonPlanContent} title={title} />;
  }
  if (type === "question_paper") {
    return <QuestionPaperView content={content as QuestionPaperContent} />;
  }
  return <NotesView content={content as NotesContent} />;
}
