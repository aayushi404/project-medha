"use client";

import { ArrowLeft, ArrowRight, Check, FileText, Layers, Loader2 } from "lucide-react";
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

const PERIOD_CHOICES = [1, 2, 3, 4, 5, 6, 7, 8];

function StepPills({ step }: { step: 1 | 2 }) {
  const w = useCopy().lessonPlan.wizard;
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
        <span className={cn(step === 1 ? "font-medium text-foreground" : "text-violet")}>
          {w.stepTopics}
        </span>
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
          {w.stepSetup}
        </span>
      </span>
    </div>
  );
}

function LessonPlanWizard() {
  const copy = useCopy();
  const w = copy.lessonPlan.wizard;
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
  const [periods, setPeriods] = useState(3);
  const [objective, setObjective] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const gradeLabel = gradeOptions.find((o) => o.value === gradeId)?.label ?? "";
  const subjectLabel = subjectOptions.find((o) => o.value === subjectId)?.label ?? "";
  const orderedChapters = [...chapters].sort((a, b) => a.chapter_number - b.chapter_number);

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
      "/generate/lesson_plan",
      {
        scope: {
          grade_id: gradeId,
          subject_id: subjectId,
          chapter_id: chapterId,
          topic_id: topicId,
        },
        params: { periods, focus: objective.trim() },
        language: profile?.preferred_language,
      },
      accessToken,
      {
        onToken: (tok) => setPreview((p) => p + tok),
        onProgress: () => {},
        onDone: (payload) => {
          if (payload.cached) toast.success(copy.generation.create.reusedEarlier);
          if (payload.generation_id) {
            router.replace(`/lesson-plan/edit?id=${payload.generation_id}&from=create`);
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
        <StepPills step={step} />

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
                <p className="mt-4 text-sm text-muted-foreground">{w.selectClass} · {w.selectSubject}</p>
              ) : orderedChapters.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">{w.noChapters}</p>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  {orderedChapters.map((c) => {
                    const active = chapterId === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setChapter(active ? null : c.id)}
                        className={cn(
                          "rounded-full border px-3.5 py-1.5 text-[13px] transition-colors",
                          active
                            ? "border-transparent bg-violet text-violet-foreground"
                            : "border-border text-foreground hover:bg-muted",
                        )}
                      >
                        {t.chapter(c.title)}
                      </button>
                    );
                  })}
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
          <div className="mt-8 flex flex-col gap-5">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">
                {w.periodsLabel} <span className="text-destructive">*</span>
              </span>
              <Select
                ariaLabel={w.periodsLabel}
                value={String(periods)}
                options={PERIOD_CHOICES.map((n) => ({ value: String(n), label: w.periodOption(n) }))}
                onValueChange={(v) => setPeriods(Number(v))}
                className="w-48"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">{w.objectiveLabel}</span>
              <textarea
                value={objective}
                onChange={(e) => setObjective(e.target.value.slice(0, 500))}
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

export default function LessonPlanPage() {
  return (
    <Suspense fallback={null}>
      <LessonPlanWizard />
    </Suspense>
  );
}
