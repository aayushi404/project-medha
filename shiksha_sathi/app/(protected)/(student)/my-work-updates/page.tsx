"use client";

import { Loader2, ThumbsDown, ThumbsUp } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  listMyWorkUpdates,
  reactToWorkUpdate,
  type WorkUpdateStudentItem,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/copy";
import { QUICK_ACTIVITIES } from "@/lib/work-update-store";
import { cn } from "@/lib/utils";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export default function StudentWorkUpdatesPage() {
  const { accessToken } = useAuth();
  const { locale } = useLocale();
  const isHi = locale === "hi";

  const [items, setItems] = useState<WorkUpdateStudentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(
    () =>
      listMyWorkUpdates(accessToken)
        .then(setItems)
        .catch((e: unknown) => {
          toast.error(e instanceof Error ? e.message : "Could not load class updates.");
        }),
    [accessToken],
  );

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    reload().finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [accessToken, reload]);

  async function react(item: WorkUpdateStudentItem, value: "approve" | "disapprove") {
    setBusyId(item.id);
    try {
      // Tapping your current choice again withdraws it.
      const updated = await reactToWorkUpdate(
        accessToken,
        item.id,
        item.my_reaction === value ? null : value,
      );
      setItems((prev) => prev.map((x) => (x.id === item.id ? updated : x)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save your response.");
    } finally {
      setBusyId(null);
    }
  }

  const activityLabel = new Map(QUICK_ACTIVITIES.map((a) => [a.id as string, a]));

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <h1 className="text-[15px]">{isHi ? "कक्षा अपडेट" : "Class Updates"}</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {isHi
            ? "शिक्षकों ने जो पढ़ाया उसे देखें। अगर सही है तो सहमत करें, नहीं तो असहमत करें। आपका नाम शिक्षक और प्रधानाचार्य को दिखेगा।"
            : "See what your teachers say they taught. Approve if it is true, disapprove if it is not. Your name is shown to the teacher and Principal."}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <p className="rounded-xl bg-card p-6 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
              {isHi ? "अभी कोई कक्षा अपडेट नहीं है।" : "No class updates yet."}
            </p>
          ) : (
            items.map((u) => {
              const busy = busyId === u.id;
              const subtopics = [...u.topics, ...(u.other_topics ? [u.other_topics] : [])];
              return (
                <div key={u.id} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-foreground">
                        {u.subject_name} · {u.chapter_title}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {u.teacher_name} · {fmtDate(u.work_date)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2.5 flex flex-wrap gap-1">
                    {u.activities.map((a) => {
                      const meta = activityLabel.get(a);
                      return (
                        <span
                          key={a}
                          className="rounded-md border border-border bg-background px-2 py-0.5 text-[11px] text-foreground/80"
                        >
                          {meta ? `${meta.icon} ${isHi ? meta.labelHi : meta.label}` : a}
                        </span>
                      );
                    })}
                  </div>

                  {subtopics.length > 0 && (
                    <p className="mt-2 text-xs text-foreground/85">
                      <span className="font-semibold">{isHi ? "पढ़ाए गए भाग: " : "Taught: "}</span>
                      {subtopics.join(" · ")}
                    </p>
                  )}
                  {u.activity_detail && (
                    <p className="mt-1 text-xs text-foreground/85">
                      <span className="font-semibold">{isHi ? "गतिविधि: " : "Activity: "}</span>
                      {u.activity_detail}
                    </p>
                  )}
                  {u.homework.length > 0 && (
                    <p className="mt-1 text-xs text-foreground/85">
                      <span className="font-semibold">{isHi ? "गृहकार्य: " : "Homework: "}</span>
                      {u.homework.map((h) => h.title).join(" · ")}
                    </p>
                  )}

                  <div className="mt-3 flex items-center gap-2 border-t border-border/60 pt-3">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void react(u, "approve")}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors disabled:opacity-50",
                        u.my_reaction === "approve"
                          ? "border-emerald-500 bg-emerald-500/15 font-semibold text-emerald-700 dark:text-emerald-300"
                          : "border-border text-muted-foreground hover:bg-muted",
                      )}
                    >
                      <ThumbsUp className="size-3.5" />
                      {isHi ? "सहमत" : "Approve"} ({u.approve_count})
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void react(u, "disapprove")}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors disabled:opacity-50",
                        u.my_reaction === "disapprove"
                          ? "border-rose-500 bg-rose-500/15 font-semibold text-rose-700 dark:text-rose-300"
                          : "border-border text-muted-foreground hover:bg-muted",
                      )}
                    >
                      <ThumbsDown className="size-3.5" />
                      {isHi ? "असहमत" : "Disapprove"} ({u.disapprove_count})
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}
