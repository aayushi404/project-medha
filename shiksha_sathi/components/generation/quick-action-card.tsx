"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { useCopy } from "@/lib/copy";
import type { GenerationType } from "@/lib/generation-types";
import { cn } from "@/lib/utils";

// Literal class maps -- Tailwind's scanner only sees class names written out in
// full, so these can't be built from a template (same reason as TYPE_BG in
// components/generation/type-meta.tsx).
const TINT_BG: Record<GenerationType, string> = {
  lesson_plan: "bg-tint-lesson-plan",
  presentation: "bg-tint-presentation",
  question_paper: "bg-tint-question-paper",
  quiz: "bg-tint-quiz",
  notes: "bg-tint-notes",
};

const FILL_BG: Record<GenerationType, string> = {
  lesson_plan: "bg-fill-lesson-plan",
  presentation: "bg-fill-presentation",
  question_paper: "bg-fill-question-paper",
  quiz: "bg-fill-quiz",
  notes: "bg-fill-notes",
};

const ART: Record<GenerationType, string> = {
  lesson_plan: "/lesson-plan.svg",
  presentation: "/presentations.svg",
  question_paper: "/question-paper.svg",
  quiz: "/quiz-logo.avif",
  notes: "/notes-card.avif",
};

// Lesson plan has its own 2-step wizard route; the rest use the generic form.
const HREF: Partial<Record<GenerationType, string>> = {
  lesson_plan: "/lesson-plan",
};

/** A single illustrated Quick Action tile on the dashboard. `wide` lays it out
 *  as a row (used for the full-width Notes card); the default stacks the art
 *  above the copy with the arrow pinned bottom-right. */
export function QuickActionCard({
  type,
  layout = "tall",
}: {
  type: GenerationType;
  layout?: "tall" | "wide";
}) {
  const copy = useCopy();
  const wide = layout === "wide";
  return (
    <Link
      href={HREF[type] ?? `/create/${type}`}
      className={cn(
        "group relative flex rounded-3xl border border-hairline/60 transition-transform hover:-translate-y-0.5",
        TINT_BG[type],
        wide ? "items-center gap-4 p-4 sm:col-span-2" : "flex-col gap-2.5 p-5 pb-16",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={ART[type]}
        alt=""
        className={cn("shrink-0 object-contain", wide ? "size-12" : "size-14")}
      />
      <div className="min-w-0 flex-1">
        <h3 className="font-sans text-[15px] leading-snug font-semibold text-foreground">
          {copy.generation.home.createLabel[type]}
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {copy.generation.home.createDesc[type]}
        </p>
      </div>
      <span
        className={cn(
          "flex size-9 items-center justify-center rounded-full text-white transition-transform group-hover:scale-105",
          FILL_BG[type],
          wide ? "shrink-0" : "absolute right-5 bottom-5",
        )}
      >
        <ArrowRight className="size-4" />
      </span>
    </Link>
  );
}
