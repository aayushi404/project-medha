"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import type { Tool } from "@/lib/tools";

/**
 * Header + scroll frame shared by every tool screen. Matches the module-detail
 * layout (back chevron, title, sub-line) so the app feels consistent.
 */
export function ToolShell({ tool, children }: { tool: Tool; children: ReactNode }) {
  const { icon: Icon } = tool;
  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-start gap-3 border-b border-border px-5 py-4">
        <Link
          href="/tools"
          className="mt-0.5 rounded-lg p-1 hover:bg-muted"
          aria-label="Back to tools"
        >
          <ChevronLeft className="size-4" />
        </Link>
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent text-terracotta">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-[15px]">{tool.name}</h1>
          <div className="mt-0.5 text-xs text-muted-foreground">{tool.tagline}</div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="mx-auto w-full max-w-2xl">{children}</div>
      </div>
    </main>
  );
}
