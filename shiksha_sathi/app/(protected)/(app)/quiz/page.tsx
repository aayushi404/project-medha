"use client";

import { ArrowLeft, ArrowRight, Check, HelpCircle, Layers, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useRef, useState } from "react";
import { toast } from "sonner";

import { useContextOptions } from "@/components/app/context-bar";
import { Select } from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { useCopy, useCurriculumT } from "@/lib/copy";
import { useLessonContext } from "@/lib/lesson-context";
import { useProfile } from "@/lib/profile-context";
import { streamGeneration } from "@/lib/sse";
import { cn } from "@/lib/utils";

const COUNT_CHOICES = [5, 10, 15, 20, 25, 30];
const TIME_CHOICES = [10, 15, 20, 30, 45, 60];
const LEVELS = ["easy", "medium", "hard"] as const;

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

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-[13px] transition-colors",
        active
          ? "border-transparent bg-violet text-violet-foreground"
          : "border-border text-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function QuizWizard() {
  const copy = useCopy();
  const w = copy.quizWizard;
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
  const [count, setCount] = useState(10);
  const [customCount, setCustomCount] = useState(false);
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("medium");
  const [timeLimit, setTimeLimit] = useState(20);
  const [objective, setObjective] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const gradeLabel = gradeOptions.find((o) => o.value === gradeId)?.label ?? "";
  const subjectLabel = subjectOptions.find((o) => o.value === subjectId)?.label ?? "";
  const orderedChapters = [...chapters].sort((a, b) => a.chapter_number - b.chapter_number);

  const levelLabel = { easy: w.levelEasy, medium: w.levelStandard, hard: w.levelHard };

  async function onGenerate() {
    if (!gradeId || !subjectId || !chapterId) {
      toast.error(copy.generation.create.scopeRequired);
      return;
    }
    setBusy(true);
    setPreview("");
    const ac = new AbortController();
    abortRef.current = ac;

    await streamGeneration(
      "/generate/quiz",
      {
        scope: {
          grade_id: gradeId,
          subject_id: subjectId,
          chapter_id: chapterId,
          topic_id: topicId,
        },
        params: {
          question_count: Math.min(50, Math.max(3, count)),
          difficulty: level,
          time_limit_min: timeLimit,
          focus: objective.trim(),
          types: ["mcq"],
        },
        language: profile?.preferred_language,
      },
      accessToken,
      {
        onToken: (tok) => setPreview((p) => p + tok),
        onProgress: () => {},
        onDone: (payload) => {
          if (payload.cached) toast.success(copy.generation.create.reusedEarlier);
          if (payload.generation_id) {
            router.replace(`/quiz/edit?id=${payload.generation_id}&from=create`);
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
                    <Chip
                      key={c.id}
                      active={chapterId === c.id}
                      onClick={() => setChapter(chapterId === c.id ? null : c.id)}
                    >
                      {t.chapter(c.title)}
                    </Chip>
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
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">{w.questionCount}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {COUNT_CHOICES.map((n) => (
                      <Chip
                        key={n}
                        active={!customCount && count === n}
                        onClick={() => {
                          setCustomCount(false);
                          setCount(n);
                        }}
                      >
                        {n}
                      </Chip>
                    ))}
                    <Chip active={customCount} onClick={() => setCustomCount(true)}>
                      {w.custom}
                    </Chip>
                    {customCount ? (
                      <input
                        type="number"
                        min={3}
                        max={50}
                        value={count}
                        onChange={(e) =>
                          setCount(Math.min(50, Math.max(3, Number(e.target.value) || 3)))
                        }
                        className="w-20 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-ring"
                      />
                    ) : null}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium">{w.level}</p>
                  <div className="mt-2 inline-flex rounded-lg border border-border p-0.5">
                    {LEVELS.map((lv) => (
                      <button
                        key={lv}
                        type="button"
                        onClick={() => setLevel(lv)}
                        className={cn(
                          "rounded-md px-3 py-1.5 text-[13px] transition-colors",
                          level === lv
                            ? "bg-violet text-violet-foreground"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {levelLabel[lv]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-sm font-medium">{w.totalTime}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {TIME_CHOICES.map((m) => (
                    <Chip key={m} active={timeLimit === m} onClick={() => setTimeLimit(m)}>
                      {w.minutes(m)}
                    </Chip>
                  ))}
                </div>
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
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg bg-terracotta px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-50"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <HelpCircle className="size-4" />}
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

export default function QuizPage() {
  return (
    <Suspense fallback={null}>
      <QuizWizard />
    </Suspense>
  );
}
