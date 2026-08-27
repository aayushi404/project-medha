"use client";

import Link from "next/link";

import type { ModuleListItem } from "@/lib/api";
import { copy } from "@/lib/copy";
import { formatRelativeTime } from "@/lib/format";

export function ModuleRow({ module }: { module: ModuleListItem }) {
  return (
    <Link
      href={`/modules/${module.id}`}
      className="flex items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-3 transition-colors hover:bg-muted"
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px]">{module.title}</div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {module.artifact_types.map((t) => (
            <span
              key={t}
              className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              {copy.artifactLabel[t] ?? t}
            </span>
          ))}
        </div>
      </div>
      <span className="shrink-0 text-[11px] whitespace-nowrap text-muted-foreground">
        {formatRelativeTime(module.updated_at)}
      </span>
    </Link>
  );
}
