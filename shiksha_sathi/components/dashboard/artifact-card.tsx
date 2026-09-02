"use client";

import {
  CircleCheck,
  Clock,
  Download,
  HelpCircle,
  Lightbulb,
  Loader2,
  Package,
  Presentation,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import type { ActivityContent, DeckContent, QuizContent } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCopy } from "@/lib/copy";
import { downloadFile } from "@/lib/download";
import { cn } from "@/lib/utils";

type ArtifactKind = "explanation" | "quiz" | "activity" | "ppt";

const FRAME: Record<ArtifactKind, { icon: LucideIcon; label: string; accent: string }> = {
  explanation: { icon: Lightbulb, label: "Explanation", accent: "bg-gold/15 text-earth" },
  quiz: { icon: HelpCircle, label: "Quiz", accent: "bg-accent text-terracotta" },
  activity: { icon: Users, label: "Class activity", accent: "bg-sage/15 text-sage" },
  ppt: { icon: Presentation, label: "Slides", accent: "bg-accent text-terracotta" },
};

/** Labelled card chrome shared by every artifact type. */
export function ArtifactFrame({
  kind,
  meta,
  action,
  children,
}: {
  kind: ArtifactKind;
  meta?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  const { icon: Icon, label, accent } = FRAME[kind];
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3.5 py-2">
        <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-md", accent)}>
          <Icon className="size-3.5" />
        </span>
        <span className="text-[13px] font-medium">{label}</span>
        {meta ? (
          <span className="ml-auto text-[11px] whitespace-nowrap text-muted-foreground">{meta}</span>
        ) : null}
        {action ? <span className={cn(meta ? "ml-2" : "ml-auto")}>{action}</span> : null}
      </div>
      <div className="p-3.5">{children}</div>
    </div>
  );
}

// --- quiz -----------------------------------------------------------------

const DIFF_PILL: Record<string, string> = {
  easy: "bg-sage/15 text-sage",
  medium: "bg-gold/20 text-earth",
  hard: "bg-terracotta/15 text-terracotta",
};

function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/^option\s+/, "")
    .replace(/^\(?([a-h])\)?[.):]\s*/, "$1|")
    .replace(/[.)\s]+$/, "");
}

/** Best-effort: does option `i` match this question's answer string? */
function isCorrect(answer: string, options: string[], i: number): boolean {
  const a = normalize(answer);
  const letter = String.fromCharCode(97 + i);
  const opt = normalize(options[i] ?? "");
  return (
    a === opt ||
    a === letter ||
    a === `${letter}|` ||
    a === `${letter}|${opt}` ||
    a === String(i + 1) ||
    (a.startsWith(`${letter}|`) && opt.length > 0 && a.endsWith(opt))
  );
}

function QuizView({
  content,
  interactive = true,
}: {
  content: QuizContent;
  interactive?: boolean;
}) {
  const copy = useCopy();
  const questions = content.questions ?? [];
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [picked, setPicked] = useState<Record<number, number>>({});

  const allOpen = questions.length > 0 && questions.every((_, i) => revealed[i]);

  function toggleAll() {
    setRevealed(allOpen ? {} : Object.fromEntries(questions.map((_, i) => [i, true])));
  }

  const diffCounts = questions.reduce<Record<string, number>>((acc, q) => {
    if (q.difficulty) acc[q.difficulty] = (acc[q.difficulty] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <ArtifactFrame
      kind="quiz"
      meta={`${questions.length} question${questions.length === 1 ? "" : "s"}`}
      action={
        questions.length > 0 ? (
          <button
            type="button"
            onClick={toggleAll}
            className="text-[11px] text-primary hover:underline"
          >
            {allOpen ? copy.hideAnswers : copy.revealAnswers}
          </button>
        ) : null
      }
    >
      {Object.keys(diffCounts).length > 1 ? (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {["easy", "medium", "hard"]
            .filter((d) => diffCounts[d])
            .map((d) => (
              <span
                key={d}
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
                  DIFF_PILL[d],
                )}
              >
                {diffCounts[d]} {d}
              </span>
            ))}
        </div>
      ) : null}

      <ol className="flex flex-col gap-3">
        {questions.map((q, i) => {
          const rawOptions = q.options?.length
            ? q.options
            : q.type === "truefalse"
              ? ["True", "False"]
              : [];
          const open = !!revealed[i];
          const choice = picked[i];
          const correctIdx = rawOptions.findIndex((_, j) => isCorrect(q.answer, rawOptions, j));

          return (
            <li key={i} className="rounded-xl border border-border/70 p-3">
              <div className="flex items-start gap-2.5">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium tabular-nums">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <p className="flex-1 text-sm font-medium">{q.q}</p>
                    {q.difficulty ? (
                      <span
                        className={cn(
                          "mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize",
                          DIFF_PILL[q.difficulty] ?? "bg-muted text-muted-foreground",
                        )}
                      >
                        {q.difficulty}
                      </span>
                    ) : null}
                  </div>

                  {rawOptions.length ? (
                    <ul className="mt-2 flex flex-col gap-1">
                      {rawOptions.map((o, j) => {
                        const isPicked = choice === j;
                        const showState = open || isPicked;
                        const right = showState && j === correctIdx;
                        const wrong = showState && isPicked && j !== correctIdx;
                        return (
                          <li key={j}>
                            <button
                              type="button"
                              disabled={!interactive}
                              onClick={() => {
                                if (!interactive) return;
                                setPicked((p) => ({ ...p, [i]: j }));
                                setRevealed((r) => ({ ...r, [i]: true }));
                              }}
                              className={cn(
                                "flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-[13px] transition-colors",
                                interactive && "hover:bg-muted",
                                right && "border-sage/50 bg-sage/10",
                                wrong && "border-destructive/40 bg-destructive/5",
                                !right && !wrong && "border-border/70",
                              )}
                            >
                              <span
                                className={cn(
                                  "flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-medium",
                                  right
                                    ? "border-transparent bg-sage text-white"
                                    : wrong
                                      ? "border-transparent bg-destructive text-white"
                                      : "border-border text-muted-foreground",
                                )}
                              >
                                {right ? (
                                  <CircleCheck className="size-3.5" />
                                ) : (
                                  String.fromCharCode(65 + j)
                                )}
                              </span>
                              <span className="flex-1">{o}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}

                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => setRevealed((r) => ({ ...r, [i]: !r[i] }))}
                      className="text-[11px] text-primary hover:underline"
                    >
                      {open ? copy.hideAnswer : copy.showAnswer}
                    </button>
                    {open ? (
                      <div className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-sage/10 px-2.5 py-1.5 text-[13px]">
                        <CircleCheck className="mt-0.5 size-3.5 shrink-0 text-sage" />
                        <span>
                          {correctIdx >= 0
                            ? `${String.fromCharCode(65 + correctIdx)}) ${rawOptions[correctIdx]}`
                            : q.answer}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {interactive && questions.some((q) => (q.options?.length ?? 0) > 0) ? (
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Sparkles className="size-3" /> {copy.practiceHint}
        </p>
      ) : null}
    </ArtifactFrame>
  );
}

// --- activity -----------------------------------------------------------

function ActivityView({ content }: { content: ActivityContent }) {
  const copy = useCopy();
  const materials = content.materials ?? [];
  const noMaterials =
    materials.length === 0 ||
    (materials.length === 1 && materials[0].trim().toLowerCase() === "none");
  const steps = content.steps ?? [];

  return (
    <ArtifactFrame
      kind="activity"
      meta={
        <span className="inline-flex items-center gap-2.5">
          {content.group_size ? (
            <span className="inline-flex items-center gap-1">
              <Users className="size-3" />
              {content.group_size}
            </span>
          ) : null}
          {content.duration_min ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" />
              {content.duration_min} min
            </span>
          ) : null}
        </span>
      }
    >
      {content.title ? <p className="text-sm font-medium">{content.title}</p> : null}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Package className="size-3" />
        </span>
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

      <ol className="mt-3 flex flex-col gap-2">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-2.5 text-[13px]">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium tabular-nums">
              {i + 1}
            </span>
            <span className="flex-1 pt-0.5">{s}</span>
          </li>
        ))}
      </ol>

      {content.variation ? (
        <div className="mt-3 rounded-lg border border-border/70 bg-muted/40 p-2.5 text-xs">
          <span className="font-medium text-foreground">Variation. </span>
          <span className="text-muted-foreground">{content.variation}</span>
        </div>
      ) : null}
    </ArtifactFrame>
  );
}

// --- slide deck -------------------------------------------------------

function DeckView({
  content,
  downloadUrl,
  filename,
}: {
  content: DeckContent;
  downloadUrl?: string;
  filename?: string;
}) {
  const copy = useCopy();
  const { accessToken } = useAuth();
  const [busy, setBusy] = useState(false);
  const slides = content.slides ?? [];

  async function onDownload() {
    if (!downloadUrl || busy) return;
    setBusy(true);
    try {
      await downloadFile(downloadUrl, accessToken, `${filename || "medha-slides"}.pptx`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.streamError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ArtifactFrame
      kind="ppt"
      meta={copy.deckSlides(slides.length)}
      action={
        downloadUrl ? (
          <button
            type="button"
            onClick={onDownload}
            disabled={busy}
            className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Download className="size-3" />
            )}
            {copy.deckDownload}
          </button>
        ) : null
      }
    >
      {content.subtitle ? (
        <p className="mb-2 text-[11px] text-muted-foreground">{content.subtitle}</p>
      ) : null}
      <ol className="flex flex-col gap-2.5">
        {slides.map((s, i) => (
          <li key={i} className="rounded-xl border border-border/70 p-3">
            <div className="flex items-start gap-2.5">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium tabular-nums">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{s.heading}</p>
                {s.bullets?.length ? (
                  <ul className="mt-1.5 flex list-disc flex-col gap-0.5 pl-4 text-[13px] text-muted-foreground">
                    {s.bullets.map((b, j) => (
                      <li key={j}>{b}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </ArtifactFrame>
  );
}

export function ArtifactCard({
  type,
  content,
  interactive,
  downloadUrl,
  filename,
}: {
  type: "quiz" | "activity" | "ppt";
  content: QuizContent | ActivityContent | DeckContent;
  interactive?: boolean;
  downloadUrl?: string;
  filename?: string;
}) {
  if (type === "quiz") {
    return <QuizView content={content as QuizContent} interactive={interactive} />;
  }
  if (type === "ppt") {
    return (
      <DeckView
        content={content as DeckContent}
        downloadUrl={downloadUrl}
        filename={filename}
      />
    );
  }
  return <ActivityView content={content as ActivityContent} />;
}
