"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";

import { DailyStatusBoard } from "@/components/principal/work-updates/daily-status-board";
import { useDailyStatus } from "@/components/principal/work-updates/use-daily-status";

/** Compact "today" picture for the /principal front page: who has filed a
 * work update today, who hasn't, and a link out to the full history route
 * for anything beyond today. Replaces the old flat PrincipalWorkUpdatesFeed,
 * which dumped every submission ever made into one undifferentiated grid. */
export function PrincipalWorkUpdatesToday() {
  const { status, loading, onFeedback } = useDailyStatus();

  return (
    <div className="space-y-3">
      {loading && !status ? (
        <div className="flex justify-center py-8">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : status ? (
        <DailyStatusBoard status={status} onFeedback={onFeedback} />
      ) : null}

      <Link
        href="/principal/work-updates"
        className="flex items-center justify-center gap-1 rounded-xl border border-dashed border-border py-2.5 text-xs font-medium text-terracotta transition-colors hover:bg-terracotta/5"
      >
        View full history
        <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );
}
