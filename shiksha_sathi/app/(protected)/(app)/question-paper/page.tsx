"use client";

import { ArrowLeft, ArrowRight, Check, FileText, Layers, Loader2, Plus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useRef, useState } from "react";
import { toast } from "sonner";

import { useContextOptions } from "@/components/app/context-bar";
import { Popover, PopoverItem } from "@/components/ui/popover";
import { Select } from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { useCopy, useCurriculumT } from "@/lib/copy";
import { PAPER_TYPES, type PaperType } from "@/lib/generation-types";
import { useLessonContext } from "@/lib/lesson-context";
import { useProfile } from "@/lib/profile-context";
import { streamGeneration } from "@/lib/sse";
import { cn } from "@/lib/utils";

const DEFAULT_MARKS: Record<PaperType, number> = {
  mcq: 1,
  very_short: 2,
  short: 3,
  long: 5,
  case_study: 4,
};
const START_ACTIVE: PaperType[] = ["mcq", "short", "long"];
const START_COUNT: Partial<Record<PaperType, number>> = { mcq: 5, short: 3, long: 2 };

type Row = { count: number; marks: number };

function StepPills({ step, stepTopics, stepSetup }: { step: 1 | 2; stepTopics: string; stepSetup: string }) {
  return (
    <div className="mt-4 flex items-center justify-center gap-3 text-sm">
      <span className="flex items-center gap-2">
        <span
          className={cn(
            "flex size-6 items-center justify-center rounded-full text-xs font-medium",
            step === 1 ? "bg-violet text-violet-foreground" : "bg-violet/15 text-violet",
          )}
        >
          {step === 1 ? "1" : <Check className="size-3.5" />}
        </span>
        <span className={cn(step === 1 ? "font-medium text-foreground" : "text-violet")}>{stepTopics}</span>
      </span>
      <span className="h-px w-10 bg-border" />
      <span className="flex items-center gap-2">
        <span
          className={cn(
            "flex size-6 items-center justify-center rounded-full text-xs font-medium",
            step === 2 ? "bg-violet text-violet-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          2
        </span>
        <span className={cn(step === 2 ? "font-medium text-foreground" : "text-muted-foreground")}>
          {stepSetup}
        </span>
      </span>
    </div>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-medium text-muted-foreground">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value) || min)))}
        className="w-28 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-ring"
      />
    </label>
  );
}

function QuestionPaperWizard() {
  const copy = useCopy();
  const w = copy.questionPaperWizard;
  const t = useCurriculumT();
  const router = useRouter();
  const { accessToken } = useAuth();
  const { profile } = useProfile();
  const { topicId } = useLessonContext();
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

  const [step, setStep] = useState<1 | 2>(1);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard" | "mixed">("mixed");
  const [objective, setObjective] = useState("");
  const [rows, setRows] = useState<Partial<Record<PaperType, Row>>>(() =>
    Object.fromEntries(
      START_ACTIVE.map((k) => [k, { count: START_COUNT[k] ?? 1, marks: DEFAULT_MARKS[k] }]),
    ),
  );
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const gradeLabel = gradeOptions.find((o) => o.value === gradeId)?.label ?? "";
  const subjectLabel = subjectOptions.find((o) => o.value === subjectId)?.label ?? "";
  const orderedChapters = [...chapters].sort((a, b) => a.chapter_number - b.chapter_number);

  const typeLabel: Record<PaperType, string> = {
    mcq: w.typeMcq,
    very_short: w.typeVeryShort,
    short: w.typeShort,
    long: w.typeLong,
    case_study: w.typeCaseStudy,
  };
  const activeTypes = PAPER_TYPES.filter((k) => rows[k]);
  const inactiveTypes = PAPER_TYPES.filter((k) => !rows[k]);
  const totalQuestions = activeTypes.reduce((s, k) => s + (rows[k]?.count ?? 0), 0);
  const totalMarks = activeTypes.reduce((s, k) => s + (rows[k]?.count ?? 0) * (rows[k]?.marks ?? 0), 0);
  const canGenerate = totalQuestions > 0;

  function setRow(kind: PaperType, patch: Partial<Row>) {
    setRows((r) => ({ ...r, [kind]: { ...(r[kind] ?? { count: 1, marks: DEFAULT_MARKS[kind] }), ...patch } }));
  }
  function addType(kind: PaperType) {
    setRows((r) => ({ ...r, [kind]: { count: 1, marks: DEFAULT_MARKS[kind] } }));
  }
  function removeType(kind: PaperType) {
    setRows((r) => {
      const next = { ...r };
      delete next[kind];
      return next;
    });
  }

  async function onGenerate() {
    if (!gradeId || !subjectId || !chapterId) {
      toast.error(copy.generation.create.scopeRequired);
      return;
    }
    const params: Record<string, unknown> = { difficulty, focus: objective.trim() };
    for (const k of PAPER_TYPES) {
      params[`${k}_count`] = rows[k]?.count ?? 0;
      params[`${k}_marks`] = rows[k]?.marks ?? DEFAULT_MARKS[k];
    }

    setBusy(true);
    setPreview("");
    const ac = new AbortController();
    abortRef.current = ac;

    await streamGeneration(
      "/generate/question_paper",
      {
        scope: {
          grade_id: gradeId,
          subject_id: subjectId,
          chapter_id: chapterId,
          topic_id: topicId,
        },
        params,
        language: profile?.preferred_language,
      },
      accessToken,
      {
        onToken: (tok) => setPreview((p) => p + tok),
        onProgress: () => {},
        onDone: (payload) => {
          if (payload.cached) toast.success(copy.generation.create.reusedEarlier);
          if (payload.generation_id) {
            router.replace(`/question-paper/edit?id=${payload.generation_id}&from=create`);
          } else {
            setBusy(false);
          }
        },
        onError: (msg) => {
          toast.error(msg || copy.generation.create.failed);
          setBusy(false);
        },
      },
      ac.signal,
    );
  }

  return (
    <main className="flex flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            {w.backToHome}
          </Link>
          <div className="flex items-center gap-2">
            {gradeLabel ? (
              <span className="rounded-full border border-violet/25 bg-violet-muted/50 px-2.5 py-1 text-xs text-violet">
                {gradeLabel}
              </span>
            ) : null}
            {subjectLabel ? (
              <span className="rounded-full border border-violet/25 bg-violet-muted/50 px-2.5 py-1 text-xs text-violet">
                {subjectLabel}
              </span>
            ) : null}
          </div>
        </div>

        <h1 className="mt-3 font-serif text-2xl tracking-tight">{w.title}</h1>
        <StepPills step={step} stepTopics={w.stepTopics} stepSetup={w.stepSetup} />

        {step === 1 ? (
          <div className="mt-8 flex flex-col gap-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">{w.selectClass}</span>
                <Select
                  ariaLabel={w.selectClass}
                  placeholder={w.selectClass}
                  value={gradeId}
                  options={gradeOptions}
                  onValueChange={pickGrade}
                  className="w-full"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">{w.selectSubject}</span>
                <Select
                  ariaLabel={w.selectSubject}
                  placeholder={w.selectSubject}
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
                  <p className="text-sm font-medium">{w.chapters}</p>
                  <p className="text-xs text-muted-foreground">{w.chaptersHint}</p>
                </div>
              </div>

              {!gradeId || !subjectId ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  {w.selectClass} · {w.selectSubject}
                </p>
              ) : orderedChapters.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">{w.noChapters}</p>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  {orderedChapters.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setChapter(chapterId === c.id ? null : c.id)}
                      className={cn(
                        "rounded-full border px-3.5 py-1.5 text-[13px] transition-colors",
                        chapterId === c.id
                          ? "border-transparent bg-violet text-violet-foreground"
                          : "border-border text-foreground hover:bg-muted",
                      )}
                    >
                      {t.chapter(c.title)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{w.chaptersHint}</span>
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!chapterId}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-40"
              >
                {w.continue}
                <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-8 flex flex-col gap-6">
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{w.marksAndQuestions}</p>
                  <p className="text-xs text-muted-foreground">{w.marksHint}</p>
                </div>
                {inactiveTypes.length ? (
                  <Popover
                    side="bottom"
                    align="end"
                    trigger={
                      <span className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs hover:bg-muted">
                        <Plus className="size-3.5" />
                        {w.addType}
                      </span>
                    }
                  >
                    {inactiveTypes.map((k) => (
                      <PopoverItem key={k} onClick={() => addType(k)}>
                        {typeLabel[k]}
                      </PopoverItem>
                    ))}
                  </Popover>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-3">
                <div className="text-xs">
                  <p className="font-medium text-muted-foreground">{w.totalMarks}</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">{totalMarks || "—"}</p>
                </div>
                <div className="text-xs">
                  <p className="font-medium text-muted-foreground">{w.totalQuestions}</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">{totalQuestions || "—"}</p>
                </div>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="font-medium text-muted-foreground">{w.difficulty}</span>
                  <Select
                    ariaLabel={w.difficulty}
                    value={difficulty}
                    options={[
                      { value: "easy", label: w.diffEasy },
                      { value: "medium", label: w.diffMedium },
                      { value: "hard", label: w.diffHard },
                      { value: "mixed", label: w.diffMixed },
                    ]}
                    onValueChange={(v) => setDifficulty(v as typeof difficulty)}
                    className="w-36"
                  />
                </label>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {activeTypes.map((k) => (
                  <div key={k} className="rounded-xl border border-border p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{typeLabel[k]}</span>
                      <button
                        type="button"
                        onClick={() => removeType(k)}
                        aria-label={`${w.addType} ${typeLabel[k]}`}
                        className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                    <div className="mt-2 flex gap-3">
                      <Stepper
                        label={w.questionsField}
                        value={rows[k]?.count ?? 0}
                        min={0}
                        max={k === "case_study" ? 20 : 50}
                        onChange={(n) => setRow(k, { count: n })}
                      />
                      <Stepper
                        label={w.marksEach}
                        value={rows[k]?.marks ?? DEFAULT_MARKS[k]}
                        min={1}
                        max={20}
                        onChange={(n) => setRow(k, { marks: n })}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">{w.objectiveLabel}</span>
              <textarea
                value={objective}
                onChange={(e) => setObjective(e.target.value.slice(0, 2000))}
                placeholder={w.objectivePlaceholder}
                rows={4}
                disabled={busy}
                className="w-full resize-y rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm outline-none focus:border-ring"
              />
            </label>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted disabled:opacity-40"
              >
                <ArrowLeft className="size-4" />
                {w.back}
              </button>
              <button
                type="button"
                onClick={() => void onGenerate()}
                disabled={busy || !canGenerate}
                className="inline-flex items-center gap-2 rounded-lg bg-terracotta px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-50"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
                {busy ? w.generating : w.generate}
              </button>
            </div>

            {busy ? (
              <div className="rounded-2xl border border-border bg-card p-4 text-sm">
                {preview ? (
                  <p className="max-h-64 overflow-y-auto whitespace-pre-wrap text-muted-foreground">
                    {preview}
                    <span className="ml-0.5 inline-block h-4 w-[3px] animate-pulse bg-foreground/50 align-middle" />
                  </p>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    {w.generating}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}

export default function QuestionPaperPage() {
  return (
    <Suspense fallback={null}>
      <QuestionPaperWizard />
    </Suspense>
  );
}
