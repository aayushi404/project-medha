"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { getWorkUpdateDailyStatus, sendWorkUpdateFeedback, type DailyStatusApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

/** Fetches /work-updates/daily-status for a given date (undefined -> today)
 * and exposes a feedback handler that patches the loaded state in place, so
 * the dashboard's "today" view and the history route's date-picker view
 * share one data layer instead of duplicating fetch/feedback plumbing. */
export function useDailyStatus(date?: string) {
  const { accessToken } = useAuth();
  const [status, setStatus] = useState<DailyStatusApi | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    if (!accessToken) return Promise.resolve();
    // setLoading deferred into this nested callback (not the effect body
    // itself) so re-fetching on a date change still shows the spinner.
    return Promise.resolve().then(() => {
      setLoading(true);
      return getWorkUpdateDailyStatus(accessToken, date)
        .then(setStatus)
        .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not load work updates."))
        .finally(() => setLoading(false));
    });
  }, [accessToken, date]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const onFeedback = useCallback(
    async (id: string, body: { note?: string | null; flagged: boolean; badge?: string | null }) => {
      if (body.flagged && !(body.note ?? "").trim()) {
        toast.error("Add a note explaining why you are flagging this.");
        return;
      }
      try {
        const updated = await sendWorkUpdateFeedback(accessToken, id, body);
        setStatus((cur) =>
          cur
            ? {
                ...cur,
                teachers: cur.teachers.map((t) => ({
                  ...t,
                  updates: t.updates.map((u) => (u.id === id ? updated : u)),
                })),
              }
            : cur,
        );
        toast.success(
          body.flagged ? `Flagged. ${updated.teacher_name} can see your note.` : `Feedback sent to ${updated.teacher_name}.`,
        );
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save feedback.");
      }
    },
    [accessToken],
  );

  return { status, loading, reload, onFeedback };
}
