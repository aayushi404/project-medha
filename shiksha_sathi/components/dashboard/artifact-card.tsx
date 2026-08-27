"use client";

import type { ActivityContent, QuizContent } from "@/lib/api";
import { copy } from "@/lib/copy";

function QuizView({ content }: { content: QuizContent }) {
  const questions = content.questions ?? [];
  return (
    <div className="rounded-xl border border-border bg-card p-3 text-sm">
      <div className="mb-2 text-[11px] font-medium tracking-wide text-muted-foreground">
        QUIZ · {questions.length} QUESTIONS
      </div>
      <ol className="space-y-3">
        {questions.map((q, i) => (
          <li key={i} className="space-y-1">
            <div className="flex gap-1.5">
              <span className="text-muted-foreground">{i + 1}.</span>
              <span className="flex-1">{q.q}</span>
              <span className="h-fit rounded bg-muted px-1.5 text-[10px] text-muted-foreground">
                {q.difficulty}
              </span>
            </div>
            {q.options?.length ? (
              <ul className="pl-5 text-muted-foreground">
                {q.options.map((o, j) => (
                  <li key={j}>
                    {String.fromCharCode(65 + j)}) {o}
                  </li>
                ))}
              </ul>
            ) : null}
            <details className="pl-5">
              <summary className="cursor-pointer text-xs text-primary">{copy.answerLabel}</summary>
              <div className="mt-0.5 text-xs">{q.answer}</div>
            </details>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ActivityView({ content }: { content: ActivityContent }) {
  const materials = content.materials ?? [];
  const noMaterials =
    materials.length === 0 ||
    (materials.length === 1 && materials[0].toLowerCase() === "none");
  return (
    <div className="rounded-xl border border-border bg-card p-3 text-sm">
      <div className="mb-1 text-[11px] font-medium tracking-wide text-muted-foreground">
        CLASS ACTIVITY
      </div>
      <div className="font-medium">{content.title}</div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {noMaterials ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">
            {copy.materialsNone}
          </span>
        ) : (
          materials.map((m, i) => (
            <span key={i} className="rounded-full bg-muted px-2 py-0.5 text-[11px]">
              {m}
            </span>
          ))
        )}
      </div>
      <div className="mt-1.5 text-xs text-muted-foreground">
        {content.group_size} students · {content.duration_min} min
      </div>
      <ol className="mt-2 list-decimal space-y-1 pl-5">
        {(content.steps ?? []).map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      {content.variation ? (
        <div className="mt-2 rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground">
          {content.variation}
        </div>
      ) : null}
    </div>
  );
}

export function ArtifactCard({
  type,
  content,
}: {
  type: "quiz" | "activity";
  content: QuizContent | ActivityContent;
}) {
  return type === "quiz" ? (
    <QuizView content={content as QuizContent} />
  ) : (
    <ActivityView content={content as ActivityContent} />
  );
}
