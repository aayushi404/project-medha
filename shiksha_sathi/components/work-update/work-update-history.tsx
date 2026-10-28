"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Flag, ThumbsDown, ThumbsUp } from "lucide-react";

import { PRINCIPAL_BADGES, type TeacherWorkUpdate } from "@/lib/work-update-store";

const selectCls =
  "h-8 rounded-lg border border-border bg-background px-2.5 pr-7 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-terracotta appearance-none cursor-pointer";

/** A teacher's own filed updates: filterable by class/subject and date, each
 * flagging whether it was the one that marked a chapter complete. Replaces
 * the cramped inline "My Updates" list the old modal had. */
export function WorkUpdateHistory({ items, isHi }: { items: TeacherWorkUpdate[]; isHi: boolean }) {
  const [filterSubject, setFilterSubject] = useState("all");
  const [filterDate, setFilterDate] = useState("all");

  const subjects = useMemo(() => Array.from(new Set(items.map((u) => u.subject_name))), [items]);
  const dates = useMemo(() => Array.from(new Set(items.map((u) => u.date))).sort().reverse(), [items]);
  const today = new Date().toISOString().slice(0, 10);

  const filtered = items.filter((u) => {
    if (filterSubject !== "all" && u.subject_name !== filterSubject) return false;
    if (filterDate !== "all" && u.date !== filterDate) return false;
    return true;
  });

  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
        {isHi ? "अभी कोई अपडेट नहीं।" : "No work updates yet."}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <select
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
            aria-label="Filter by subject"
            className={selectCls}
          >
            <option value="all">{isHi ? "सभी विषय" : "All subjects"} ({subjects.length})</option>
            {subjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-2.5 size-3 text-muted-foreground" />
        </div>
        <div className="relative">
          <select
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            aria-label="Filter by date"
            className={selectCls}
          >
            <option value="all">{isHi ? "सभी तारीखें" : "All dates"} ({dates.length})</option>
            {dates.map((d) => (
              <option key={d} value={d}>
                {d === today ? `${isHi ? "आज" : "Today"} (${d})` : d}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-2.5 size-3 text-muted-foreground" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
          {isHi ? "इस फ़िल्टर से कोई अपडेट नहीं मिला।" : "No updates match that filter."}
        </p>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((u) => {
            const fb = u.principal_feedback;
            const badge = fb?.badge ? PRINCIPAL_BADGES[fb.badge] : null;
            const approve = u.reactions.filter((r) => r.value === "approve").length;
            const disapprove = u.reactions.filter((r) => r.value === "disapprove").length;
            return (
              <div key={u.id} className="rounded-xl border border-border bg-card p-3.5 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-foreground">
                      {u.grade_label} · {u.subject_name}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-muted-foreground">
                      <span>{u.chapter_title}</span>
                      {u.chapter_completed && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.2 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                          ✅ {isHi ? "पूर्ण" : "Completed"}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{u.date}</span>
                </div>

                {(u.topics.length > 0 || u.other_topics) && (
                  <div className="mt-1.5 text-foreground/80">
                    {[...u.topics, ...(u.other_topics ? [u.other_topics] : [])].join(" · ")}
                  </div>
                )}

                {(approve > 0 || disapprove > 0) && (
                  <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <ThumbsUp className="size-3 text-emerald-600" /> {approve}
                    </span>
                    <span className="flex items-center gap-1">
                      <ThumbsDown className="size-3 text-rose-600" /> {disapprove}
                    </span>
                  </div>
                )}

                {fb && (
                  <div
                    className={`mt-2 rounded-lg border p-2 ${
                      fb.flagged ? "border-rose-500/40 bg-rose-500/10" : "border-border bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-semibold">
                      {fb.flagged && <Flag className="size-3 text-rose-600" />}
                      <span>{isHi ? "प्रधानाचार्य" : "Principal"}</span>
                      {badge && (
                        <span className={`rounded-full border px-1.5 text-[10px] ${badge.color}`}>
                          {badge.emoji} {isHi ? badge.labelHi : badge.label.split(" (")[0]}
                        </span>
                      )}
                      {fb.flagged && (
                        <span className="text-[10px] font-bold text-rose-600">{isHi ? "फ़्लैग किया गया" : "FLAGGED"}</span>
                      )}
                    </div>
                    {fb.note && <p className="mt-1 text-foreground/85">{fb.note}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
