"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { ComponentType } from "react";

import { ClassTimer } from "@/components/tools/class-timer";
import { ComingSoon } from "@/components/tools/coming-soon";
import { GroupMaker } from "@/components/tools/group-maker";
import { LessonPlan } from "@/components/tools/lesson-plan";
import { NamePicker } from "@/components/tools/name-picker";
import { PdfQa } from "@/components/tools/pdf-qa";
import { QuickMock } from "@/components/tools/quick-mock";
import { TranslateSimplify } from "@/components/tools/translate-simplify";
import { ToolShell } from "@/components/tools/tool-shell";
import { toolBySlug } from "@/lib/tools";

const READY: Record<string, ComponentType> = {
  "lesson-plan": LessonPlan,
  "pdf-qa": PdfQa,
  "quick-mock": QuickMock,
  "group-maker": GroupMaker,
  "name-picker": NamePicker,
  translate: TranslateSimplify,
  timer: ClassTimer,
};

export default function ToolPage() {
  const { slug } = useParams<{ slug: string }>();
  const tool = toolBySlug(slug);

  if (!tool) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
        <p>That tool doesn&apos;t exist.</p>
        <Link href="/tools" className="text-primary underline">
          All tools
        </Link>
      </main>
    );
  }

  const Body = tool.status === "ready" ? READY[tool.slug] : undefined;

  return (
    <ToolShell tool={tool}>{Body ? <Body /> : <ComingSoon tool={tool} />}</ToolShell>
  );
}
