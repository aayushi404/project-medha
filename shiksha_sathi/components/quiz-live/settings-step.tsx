"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";

import type { QuizParams } from "@/lib/generation-types";
import { cn } from "@/lib/utils";

const COUNT_CHOICES = [5, 10, 15, 20, 25, 30];
const LEVELS = ["easy", "medium", "hard"] as const;
const LEVEL_LABEL: Record<(typeof LEVELS)[number], string> = {
  easy: "Easy",
  medium: "Standard",
  hard: "Hard",
};

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

/** Page 2 -- question count / difficulty / objective. Same fields and
 *  behaviour as the existing quiz wizard's step 2, minus the generate button
 *  -- that happens after Students (page 3) here, not from this screen. A
 *  controlled component: the settings live in the orchestrator so they
 *  survive navigating back to Topics and returning. */
export function SettingsStep({
  settings,
  onChange,
  onBack,
  onContinue,
}: {
  settings: QuizParams;
  onChange: (next: Partial<QuizParams>) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const isCustomCount = !COUNT_CHOICES.includes(settings.question_count);

  return (
    <div className="mt-8 flex flex-col gap-6">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Question count</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {COUNT_CHOICES.map((n) => (
                <Chip
                  key={n}
                  active={!isCustomCount && settings.question_count === n}
                  onClick={() => onChange({ question_count: n })}
                >
                  {n}
                </Chip>
              ))}
              <Chip active={isCustomCount} onClick={() => onChange({ question_count: 12 })}>
                Custom
              </Chip>
              {isCustomCount ? (
                <input
                  type="number"
                  min={3}
                  max={50}
                  value={settings.question_count}
                  onChange={(e) =>
                    onChange({ question_count: Math.min(50, Math.max(3, Number(e.target.value) || 3)) })
                  }
                  className="w-20 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-ring"
                />
              ) : null}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium">Level</p>
            <div className="mt-2 inline-flex rounded-lg border border-border p-0.5">
              {LEVELS.map((lv) => (
                <button
                  key={lv}
                  type="button"
                  onClick={() => onChange({ difficulty: lv })}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-[13px] transition-colors",
                    settings.difficulty === lv
                      ? "bg-violet text-violet-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {LEVEL_LABEL[lv]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Quiz objective (optional)</span>
        <textarea
          value={settings.focus}
          onChange={(e) => onChange({ focus: e.target.value.slice(0, 2000) })}
          placeholder="Tell Medha what you'd like this quiz to test -- for example, basic understanding, application, or deeper thinking."
          rows={4}
          className="w-full resize-y rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm outline-none focus:border-ring"
        />
      </label>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
        >
          <ArrowLeft className="size-4" />
          Back
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Continue
          <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
