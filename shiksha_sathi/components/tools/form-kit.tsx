"use client";

import type { ReactNode } from "react";

/** Small shared bits for the tool input forms. */

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium">{label}</span>
      {children}
      {hint ? <span className="text-[11px] text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

export function ToolPanel({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      {children}
    </div>
  );
}
