"use client";

import { HelpCircle, Lightbulb, Network, Presentation, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";

type QuickActionsProps = {
  onExplain: () => void;
  onQuiz: () => void;
  onActivity: () => void;
  disabled?: boolean;
};

export function QuickActions({ onExplain, onQuiz, onActivity, disabled }: QuickActionsProps) {
  const cards: {
    key: string;
    label: string;
    sub: string;
    icon: LucideIcon;
    onClick?: () => void;
  }[] = [
    { key: "explanation", ...copy.quickActions.explanation, icon: Lightbulb, onClick: onExplain },
    { key: "quiz", ...copy.quickActions.quiz, icon: HelpCircle, onClick: onQuiz },
    { key: "activity", ...copy.quickActions.activity, icon: Users, onClick: onActivity },
    { key: "ppt", ...copy.quickActions.ppt, icon: Presentation },
    { key: "mindmap", ...copy.quickActions.mindmap, icon: Network },
  ];

  return (
    <div className="grid w-full max-w-md grid-cols-2 gap-2.5">
      {cards.map(({ key, label, sub, icon: Icon, onClick }) => {
        const enabled = Boolean(onClick) && !disabled;
        return (
          <button
            key={key}
            type="button"
            disabled={!enabled}
            onClick={onClick}
            className={cn(
              "flex items-center gap-2.5 rounded-xl border border-border bg-card p-3 text-left transition-colors",
              enabled ? "hover:bg-muted" : "cursor-not-allowed opacity-55",
            )}
          >
            <Icon className="size-5 shrink-0 text-terracotta" />
            <span className="min-w-0">
              <span className="block text-[13px]">{label}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{sub}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
