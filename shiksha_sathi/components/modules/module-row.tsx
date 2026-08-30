"use client";

import { ChevronRight, HelpCircle, Lightbulb, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";

import type { ArtifactType, ModuleListItem } from "@/lib/api";
import { useCopy } from "@/lib/copy";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const TYPE_META: Record<ArtifactType, { icon: LucideIcon; className: string }> = {
  explanation: { icon: Lightbulb, className: "text-earth" },
  quiz: { icon: HelpCircle, className: "text-terracotta" },
  activity: { icon: Users, className: "text-sage" },
};

const ORDER: ArtifactType[] = ["explanation", "quiz", "activity"];

export function ModuleRow({ module }: { module: ModuleListItem }) {
  const copy = useCopy();
  const types = [...module.artifact_types].sort(
    (a, b) => ORDER.indexOf(a) - ORDER.indexOf(b),
  );

  return (
    <Link
      href={`/modules/${module.id}`}
      className="group flex items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-3 transition-colors hover:border-foreground/20 hover:bg-muted"
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium">{module.title}</div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {types.map((t) => {
            const { icon: Icon, className } = TYPE_META[t];
            return (
              <span
                key={t}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground"
              >
                <Icon className={cn("size-3", className)} />
                {copy.artifactLabel[t] ?? t}
              </span>
            );
          })}
        </div>
      </div>
      <span className="shrink-0 text-[11px] whitespace-nowrap text-muted-foreground">
        {formatRelativeTime(module.updated_at)}
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
    </Link>
  );
}
