"use client";

import {
  FileQuestion,
  HelpCircle,
  NotebookPen,
  Presentation,
  ScrollText,
  type LucideIcon,
} from "lucide-react";

import type { GenerationType } from "@/lib/generation-types";
import { useCopy } from "@/lib/copy";
import { cn } from "@/lib/utils";

const TYPE_ICON: Record<GenerationType, LucideIcon> = {
  lesson_plan: NotebookPen,
  presentation: Presentation,
  question_paper: FileQuestion,
  quiz: HelpCircle,
  notes: ScrollText,
};

// Literal class names (not built from a template) so Tailwind's scanner sees
// every one of them -- a dynamically-interpolated class name is invisible to
// it and would silently ship unstyled.
const TYPE_BG: Record<GenerationType, string> = {
  lesson_plan: "bg-tint-lesson-plan",
  presentation: "bg-tint-presentation",
  question_paper: "bg-tint-question-paper",
  quiz: "bg-tint-quiz",
  notes: "bg-tint-notes",
};

const TYPE_FG: Record<GenerationType, string> = {
  lesson_plan: "text-fill-lesson-plan",
  presentation: "text-fill-presentation",
  question_paper: "text-fill-question-paper",
  quiz: "text-fill-quiz",
  notes: "text-fill-notes",
};

/** Icon + localized label/short for a generation type, plus its tint (pale
 *  background) and fill (saturated icon/accent) classes. */
export function useTypeMeta(type: GenerationType) {
  const copy = useCopy();
  return {
    Icon: TYPE_ICON[type],
    bgClass: TYPE_BG[type],
    fgClass: TYPE_FG[type],
    ...copy.generation.types[type],
  };
}

/** Small tinted badge showing a generation type -- used in lists and headers. */
export function TypeBadge({ type, className }: { type: GenerationType; className?: string }) {
  const { Icon, short, bgClass } = useTypeMeta(type);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-tint-foreground",
        bgClass,
        className,
      )}
    >
      <Icon className="size-3" />
      {short}
    </span>
  );
}
