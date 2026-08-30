"use client";

import { Bell } from "lucide-react";
import { toast } from "sonner";

import type { Tool } from "@/lib/tools";

export function ComingSoon({ tool }: { tool: Tool }) {
  return (
    <div className="flex flex-col items-start gap-5 rounded-xl border border-border bg-card p-6">
      <div>
        <div className="text-[11px] font-semibold tracking-[0.18em] text-terracotta uppercase">
          On the way
        </div>
        <h2 className="mt-2 text-lg">{tool.name}</h2>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">{tool.blurb}</p>
      </div>
      <p className="text-sm text-muted-foreground">
        This one isn&apos;t wired up yet. It&apos;s next in line -- the screen you see
        here is the shape it will take.
      </p>
      <button
        type="button"
        onClick={() => toast.success("Noted — we'll surface this tool as soon as it's ready.")}
        className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
      >
        <Bell className="size-4" />
        Notify me when it&apos;s ready
      </button>
    </div>
  );
}
