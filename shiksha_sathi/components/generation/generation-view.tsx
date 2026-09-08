"use client";

import { Plus, X } from "lucide-react";
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
  QuizContent,
} from "@/lib/generation-types";
import { cn } from "@/lib/utils";

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card p-4">
      {children}
    </div>
  );
}

/** Textarea that grows with its content — used across the editable views. */
function GrowArea({
  value,
  onChange,
  rows = 3,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  className?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      className={cn(
        "w-full resize-y rounded-md border border-border bg-background px-2 py-1.5 text-[13px] outline-none focus:border-ring",
        className,
      )}
    />
  );
}

type PeriodKey = keyof LessonPlanContent["periods_detail"][number];

function blankPeriod(period_no: number): LessonPlanContent["periods_detail"][number] {
  return {
    period_no,
    concept: "",
    learning_objective: "",
    learning_outcomes: "",
    teacher_learning_process: "",
    assessment: "",
    resources: "",
  };
}

function LessonPlanView({
  content,
  title,
  editing = false,
  onChange,
}: {
  content: LessonPlanContent;
  title: string;
  editing?: boolean;
  onChange?: (next: LessonPlanContent) => void;
}) {
  const copy = useCopy().generation.viewer.lessonPlan;
  const periods = content.periods_detail ?? [];
  const cols: [string, PeriodKey][] = [
    [copy.concept, "concept"],
    [copy.objective, "learning_objective"],
    [copy.outcomes, "learning_outcomes"],
    [copy.process, "teacher_learning_process"],
    [copy.assessment, "assessment"],
    [copy.resources, "resources"],
  ];

  function patch(next: Partial<LessonPlanContent>) {
    onChange?.({ ...content, ...next });
  }
  function patchPeriod(i: number, key: PeriodKey, value: string) {
    patch({ periods_detail: periods.map((p, idx) => (idx === i ? { ...p, [key]: value } : p)) });
  }
  function renumber(rows: LessonPlanContent["periods_detail"]) {
    return rows.map((p, idx) => ({ ...p, period_no: idx + 1 }));
  }
  function addPeriod() {
    const rows = renumber([...periods, blankPeriod(periods.length + 1)]);
    patch({ periods_detail: rows, periods: rows.length });
  }
  function removePeriod(i: number) {
    if (periods.length <= 1) return;
    const rows = renumber(periods.filter((_, idx) => idx !== i));
    patch({ periods_detail: rows, periods: rows.length });
  }

  return (
    <Card>
      <div className="mb-3">
        {editing ? (
          <input
            value={content.topic}
            onChange={(e) => patch({ topic: e.target.value })}
            placeholder={copy.topic}
            className="w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm font-medium outline-none focus:border-ring"
          />
        ) : (
          <p className="text-sm font-medium">{content.topic || title}</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
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
              {editing ? <th className="w-8" /> : null}
            </tr>
          </thead>
          <tbody>
            {periods.map((p, i) => (
              <tr key={i} className="border-b border-border/60 align-top">
                <td className="sticky left-0 z-10 bg-card px-2 py-2 text-sm font-medium tabular-nums">
                  {p.period_no}
                </td>
                {cols.map(([label, key]) => (
                  <td key={label} className="max-w-[240px] px-3 py-2 align-top">
                    {editing ? (
                      <GrowArea
                        value={String(p[key] ?? "")}
                        onChange={(v) => patchPeriod(i, key, v)}
                        rows={5}
                        className="min-w-[200px]"
                      />
                    ) : (
                      <span className="block whitespace-pre-wrap text-muted-foreground">
                        {String(p[key] ?? "")}
                      </span>
                    )}
                  </td>
                ))}
                {editing ? (
                  <td className="px-1 py-2 align-top">
                    <button
                      type="button"
                      onClick={() => removePeriod(i)}
                      disabled={periods.length <= 1}
                      aria-label={copy.removePeriod}
                      className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-30"
                    >
                      <X className="size-4" />
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing ? (
        <button
          type="button"
          onClick={addPeriod}
          disabled={periods.length >= 8}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-40"
        >
          <Plus className="size-3.5" />
          {copy.addPeriod}
        </button>
      ) : null}

      {editing ? (
        <div className="mt-3">
          <p className="mb-1 text-xs font-medium text-muted-foreground">{copy.homework}</p>
          <GrowArea
            value={content.homework ?? ""}
            onChange={(v) => patch({ homework: v || null })}
            rows={2}
          />
        </div>
      ) : content.homework ? (
        <div className="mt-3 rounded-lg border border-border/70 bg-muted/40 p-2.5 text-xs">
          <span className="font-medium text-foreground">{copy.homework}. </span>
          <span className="text-muted-foreground">{content.homework}</span>
        </div>
      ) : null}
    </Card>
  );
}

// --- question paper ------------------------------------------------------------

type PaperSection = QuestionPaperContent["sections"][number];
type PaperQuestion = PaperSection["questions"][number];

const OPT_LETTERS = ["A", "B", "C", "D", "E", "F"];

function blankPaperQuestion(): PaperQuestion {
  return { text: "", marks: 1, type: "short", options: [] };
}
function blankPaperSection(n: number): PaperSection {
  return { name: `Section ${String.fromCharCode(64 + n)}`, instructions: "", questions: [blankPaperQuestion()] };
}

function QuestionPaperView({
  content,
  editing = false,
  onChange,
}: {
  content: QuestionPaperContent;
  editing?: boolean;
  onChange?: (next: QuestionPaperContent) => void;
}) {
  const copy = useCopy().generation.viewer.questionPaper;
  const sections = content.sections ?? [];

  function patch(next: Partial<QuestionPaperContent>) {
    onChange?.({ ...content, ...next });
  }
  function patchSection(si: number, next: Partial<PaperSection>) {
    patch({ sections: sections.map((s, i) => (i === si ? { ...s, ...next } : s)) });
  }
  function patchQuestion(si: number, qi: number, next: Partial<PaperQuestion>) {
    patchSection(si, {
      questions: sections[si].questions.map((q, i) => (i === qi ? { ...q, ...next } : q)),
    });
  }

  if (editing) {
    return (
      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-muted-foreground">{copy.totalMarksLabel}</span>
            <input
              type="number"
              min={0}
              value={content.total_marks}
              onChange={(e) => patch({ total_marks: Number(e.target.value) || 0 })}
              className="w-24 rounded-md border border-border bg-background px-2 py-1.5 text-[13px] outline-none focus:border-ring"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-muted-foreground">{copy.durationMin}</span>
            <input
              type="number"
              min={0}
              value={content.duration_min}
              onChange={(e) => patch({ duration_min: Number(e.target.value) || 0 })}
              className="w-24 rounded-md border border-border bg-background px-2 py-1.5 text-[13px] outline-none focus:border-ring"
            />
          </label>
        </div>

        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">{copy.generalInstructions}</p>
            <button
              type="button"
              onClick={() => patch({ general_instructions: [...(content.general_instructions ?? []), ""] })}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted"
            >
              <Plus className="size-3" />
              {copy.addInstruction}
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            {(content.general_instructions ?? []).map((line, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input
                  value={line}
                  onChange={(e) =>
                    patch({
                      general_instructions: (content.general_instructions ?? []).map((l, idx) =>
                        idx === i ? e.target.value : l,
                      ),
                    })
                  }
                  className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-[13px] outline-none focus:border-ring"
                />
                <button
                  type="button"
                  onClick={() =>
                    patch({
                      general_instructions: (content.general_instructions ?? []).filter((_, idx) => idx !== i),
                    })
                  }
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-4">
          {sections.map((s, si) => (
            <div key={si} className="rounded-xl border border-border p-3">
              <div className="flex items-center gap-2">
                <input
                  value={s.name}
                  onChange={(e) => patchSection(si, { name: e.target.value })}
                  placeholder={copy.sectionName}
                  className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-[13px] font-medium outline-none focus:border-ring"
                />
                <button
                  type="button"
                  onClick={() => patch({ sections: sections.filter((_, i) => i !== si) })}
                  disabled={sections.length <= 1}
                  aria-label={copy.removeSection}
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-30"
                >
                  <X className="size-4" />
                </button>
              </div>
              <input
                value={s.instructions}
                onChange={(e) => patchSection(si, { instructions: e.target.value })}
                placeholder={copy.sectionInstructions}
                className="mt-2 w-full rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground outline-none focus:border-ring"
              />
              <ol className="mt-2 flex flex-col gap-2">
                {s.questions.map((q, qi) => (
                  <li key={qi} className="flex items-start gap-2">
                    <span className="mt-2 text-[11px] font-medium tabular-nums text-muted-foreground">
                      {qi + 1}.
                    </span>
                    <div className="flex-1">
                      <GrowArea
                        value={q.text}
                        onChange={(v) => patchQuestion(si, qi, { text: v })}
                        rows={2}
                      />
                      {q.type === "mcq" ? (
                        <div className="mt-1.5 flex flex-col gap-1">
                          {(q.options ?? []).map((opt, oi) => (
                            <div key={oi} className="flex items-center gap-1.5">
                              <span className="text-[11px] font-medium text-muted-foreground">
                                {OPT_LETTERS[oi]}
                              </span>
                              <input
                                value={opt}
                                onChange={(e) =>
                                  patchQuestion(si, qi, {
                                    options: (q.options ?? []).map((o, idx) =>
                                      idx === oi ? e.target.value : o,
                                    ),
                                  })
                                }
                                className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:border-ring"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  patchQuestion(si, qi, {
                                    options: (q.options ?? []).filter((_, idx) => idx !== oi),
                                  })
                                }
                                disabled={(q.options ?? []).length <= 2}
                                aria-label={copy.removeOption}
                                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-30"
                              >
                                <X className="size-3" />
                              </button>
                            </div>
                          ))}
                          {(q.options ?? []).length < 6 ? (
                            <button
                              type="button"
                              onClick={() =>
                                patchQuestion(si, qi, { options: [...(q.options ?? []), ""] })
                              }
                              className="inline-flex items-center gap-1 self-start rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted"
                            >
                              <Plus className="size-3" />
                              {copy.addOption}
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                      <div className="mt-1 flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          value={q.marks}
                          onChange={(e) => patchQuestion(si, qi, { marks: Number(e.target.value) || 0 })}
                          aria-label={copy.marks}
                          className="w-16 rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:border-ring"
                        />
                        <select
                          value={q.type}
                          onChange={(e) =>
                            patchQuestion(si, qi, { type: e.target.value as PaperQuestion["type"] })
                          }
                          aria-label={copy.type}
                          className="rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:border-ring"
                        >
                          <option value="mcq">{copy.typeMcq}</option>
                          <option value="short">{copy.typeShort}</option>
                          <option value="long">{copy.typeLong}</option>
                        </select>
                        <button
                          type="button"
                          onClick={() =>
                            patchSection(si, { questions: s.questions.filter((_, i) => i !== qi) })
                          }
                          disabled={s.questions.length <= 1}
                          aria-label={copy.removeQuestion}
                          className="ml-auto rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-30"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
              <button
                type="button"
                onClick={() => patchSection(si, { questions: [...s.questions, blankPaperQuestion()] })}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
              >
                <Plus className="size-3.5" />
                {copy.addQuestion}
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => patch({ sections: [...sections, blankPaperSection(sections.length + 1)] })}
            className="inline-flex items-center gap-1.5 self-start rounded-lg border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
          >
            <Plus className="size-3.5" />
            {copy.addSection}
          </button>
        </div>
      </Card>
    );
  }

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
                <li key={qi} className="rounded-xl border border-border/70 p-2.5 text-[13px]">
                  <div className="flex items-start gap-2.5">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium tabular-nums">
                      {qi + 1}
                    </span>
                    <span className="flex-1 whitespace-pre-wrap">{q.text}</span>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                      {copy.marksLabel(q.marks)}
                    </span>
                  </div>
                  {q.options?.length ? (
                    <div className="mt-1.5 grid grid-cols-1 gap-x-6 gap-y-1 pl-7 sm:grid-cols-2">
                      {q.options.map((opt, oi) => (
                        <span key={oi} className="text-muted-foreground">
                          ({OPT_LETTERS[oi]}) {opt}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </Card>
  );
}

// --- quiz editor -------------------------------------------------------------

type QuizQ = QuizContent["questions"][number];

function blankQuizQuestion(): QuizQ {
  return { q: "", type: "mcq", options: ["", "", "", ""], answer: "", difficulty: "medium", explanation: "" };
}

function QuizEditor({
  content,
  onChange,
}: {
  content: QuizContent;
  onChange?: (next: QuizContent) => void;
}) {
  const copy = useCopy().generation.viewer.quiz;
  const questions = content.questions ?? [];

  function patchQ(i: number, next: Partial<QuizQ>) {
    onChange?.({ questions: questions.map((q, idx) => (idx === i ? { ...q, ...next } : q)) });
  }
  function setQuestions(next: QuizQ[]) {
    onChange?.({ questions: next });
  }

  return (
    <Card>
      <ol className="flex flex-col gap-3">
        {questions.map((q, i) => (
          <li key={i} className="rounded-xl border border-border/70 p-3">
            <div className="flex items-start gap-2">
              <span className="mt-2 text-[11px] font-medium tabular-nums text-muted-foreground">{i + 1}.</span>
              <div className="min-w-0 flex-1">
                <GrowArea value={q.q} onChange={(v) => patchQ(i, { q: v })} rows={2} />

                <div className="mt-2 flex flex-col gap-1.5">
                  {(q.options ?? []).map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-1.5">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {String.fromCharCode(65 + oi)}
                      </span>
                      <input
                        value={opt}
                        onChange={(e) =>
                          patchQ(i, {
                            options: (q.options ?? []).map((o, idx) => (idx === oi ? e.target.value : o)),
                          })
                        }
                        className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-[13px] outline-none focus:border-ring"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          patchQ(i, { options: (q.options ?? []).filter((_, idx) => idx !== oi) })
                        }
                        disabled={(q.options ?? []).length <= 2}
                        aria-label={copy.removeOption}
                        className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-30"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                  {(q.options ?? []).length < 6 ? (
                    <button
                      type="button"
                      onClick={() => patchQ(i, { options: [...(q.options ?? []), ""] })}
                      className="inline-flex items-center gap-1 self-start rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted"
                    >
                      <Plus className="size-3" />
                      {copy.addOption}
                    </button>
                  ) : null}
                </div>

                <div className="mt-2 flex flex-wrap items-end gap-3">
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium text-muted-foreground">{copy.answer}</span>
                    {(q.options ?? []).length ? (
                      <select
                        value={q.answer}
                        onChange={(e) => patchQ(i, { answer: e.target.value })}
                        className="rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:border-ring"
                      >
                        <option value="">—</option>
                        {(q.options ?? []).map((o, oi) => (
                          <option key={oi} value={o}>
                            {String.fromCharCode(65 + oi)}. {o}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={q.answer}
                        onChange={(e) => patchQ(i, { answer: e.target.value })}
                        className="rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:border-ring"
                      />
                    )}
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium text-muted-foreground">{copy.difficulty}</span>
                    <select
                      value={q.difficulty}
                      onChange={(e) => patchQ(i, { difficulty: e.target.value as QuizQ["difficulty"] })}
                      className="rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:border-ring"
                    >
                      <option value="easy">{copy.diffEasy}</option>
                      <option value="medium">{copy.diffMedium}</option>
                      <option value="hard">{copy.diffHard}</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => setQuestions(questions.filter((_, idx) => idx !== i))}
                    disabled={questions.length <= 1}
                    aria-label={copy.removeQuestion}
                    className="ml-auto rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-30"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                <label className="mt-2 flex flex-col gap-1 text-xs">
                  <span className="font-medium text-muted-foreground">{copy.explanation}</span>
                  <GrowArea
                    value={q.explanation ?? ""}
                    onChange={(v) => patchQ(i, { explanation: v })}
                    rows={2}
                  />
                </label>
              </div>
            </div>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={() => setQuestions([...questions, blankQuizQuestion()])}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
      >
        <Plus className="size-3.5" />
        {copy.addQuestion}
      </button>
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

/** Renders any generation type's `content_json`. Read-only quiz + presentation
 * reuse `ArtifactCard` (the chat/module artifact viewer) since the shapes match;
 * lesson_plan / question_paper / quiz get an inline editor when `editing`. */
export function GenerationView({
  type,
  title,
  content,
  generationId,
  editing,
  onContentChange,
}: {
  type: GenerationType;
  title: string;
  content: unknown;
  generationId: string;
  /** lesson_plan / question_paper / quiz only: render as an editable form */
  editing?: boolean;
  onContentChange?: (next: unknown) => void;
}) {
  if (type === "quiz") {
    if (editing) {
      return (
        <QuizEditor content={content as QuizContent} onChange={(n) => onContentChange?.(n)} />
      );
    }
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
    return (
      <LessonPlanView
        content={content as LessonPlanContent}
        title={title}
        editing={editing}
        onChange={(n) => onContentChange?.(n)}
      />
    );
  }
  if (type === "question_paper") {
    return (
      <QuestionPaperView
        content={content as QuestionPaperContent}
        editing={editing}
        onChange={(n) => onContentChange?.(n)}
      />
    );
  }
  return <NotesView content={content as NotesContent} />;
}
