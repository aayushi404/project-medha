"use client";

import { useState } from "react";
import { AlertCircle, ChevronRight, Megaphone, X } from "lucide-react";

import { useWorkUpdates } from "@/lib/work-update-store";

export function SchoolNoticeBanner({ audience = "all" }: { audience?: "all" | "teachers" | "students" }) {
  const { notices } = useWorkUpdates();
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});

  const relevant = notices.filter(
    (n) =>
      n.active &&
      !dismissed[n.id] &&
      (n.target_audience === "all" || n.target_audience === audience),
  );

  if (relevant.length === 0) return null;

  const topNotice = relevant[0];
  const isUrgent = topNotice.priority === "urgent";

  return (
    <div
      className={`border-b px-4 py-2 text-xs flex items-center justify-between gap-3 transition-colors ${
        isUrgent
          ? "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200"
          : "border-border bg-muted/60 text-foreground"
      }`}
    >
      <div className="flex items-center gap-2 overflow-hidden">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-terracotta/15 text-terracotta">
          {isUrgent ? <AlertCircle className="size-3.5" /> : <Megaphone className="size-3.5" />}
        </span>
        <span className="font-semibold shrink-0 uppercase text-[10px] tracking-wider px-1.5 py-0.2 rounded-sm bg-black/5 dark:bg-white/10">
          Principal Circular
        </span>
        <span className="truncate font-medium">{topNotice.title}:</span>
        <span className="truncate text-muted-foreground hidden sm:inline">{topNotice.message}</span>
      </div>

      <button
        type="button"
        onClick={() => setDismissed((prev) => ({ ...prev, [topNotice.id]: true }))}
        className="shrink-0 p-1 text-muted-foreground hover:text-foreground rounded-md transition-colors"
        title="Dismiss"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
