"use client";

import { useState } from "react";
import { CalendarDays, ClipboardPenLine, Loader2 } from "lucide-react";

import { DailyStatusBoard } from "@/components/principal/work-updates/daily-status-board";
import { useDailyStatus } from "@/components/principal/work-updates/use-daily-status";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Full work-updates history: pick any date, see every teacher's status and
 * update(s) for that date -- same board as the dashboard's "today" view,
 * just driven by a date picker instead of being pinned to today. */
export function PrincipalWorkUpdatesHistory() {
  const [date, setDate] = useState(todayStr());
  const { status, loading, onFeedback } = useDailyStatus(date);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-xl bg-terracotta/10 text-terracotta">
          <ClipboardPenLine className="size-5" />
        </span>
        <div>
          <h1 className="text-[15px] font-semibold leading-none">Work Updates History</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Pick a date to see which teachers filed their daily work update.
          </p>
        </div>
      </div>

      <label className="flex w-fit items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm">
        <CalendarDays className="size-4 text-muted-foreground" />
        <input
          type="date"
          value={date}
          max={todayStr()}
          onChange={(e) => setDate(e.target.value)}
          className="bg-transparent text-sm text-foreground focus:outline-none"
        />
      </label>

      {loading && !status ? (
        <div className="flex justify-center py-8">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : status ? (
        <DailyStatusBoard status={status} onFeedback={onFeedback} />
      ) : null}
    </div>
  );
}
