"use client";

import { BookOpen } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Shared chat visual language -- used by the live dashboard thread and the
 * read-only "original conversation" panel on a module, so both read the same.
 */

export function AssistantMark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="flex size-6 items-center justify-center rounded-full bg-terracotta text-primary-foreground">
        <BookOpen className="size-3.5" />
      </span>
      <span className="text-xs font-medium text-muted-foreground">Medha</span>
    </div>
  );
}

/** The indented column that assistant content sits in, lined up under the mark. */
export function AssistantBody({ children }: { children: ReactNode }) {
  return <div className="pl-8">{children}</div>;
}

export function UserBubble({ children }: { children: ReactNode }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-br-md border border-border bg-secondary px-3.5 py-2 text-sm whitespace-pre-wrap text-secondary-foreground">
        {children}
      </div>
    </div>
  );
}
