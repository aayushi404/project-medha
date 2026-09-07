"use client";

import { useState } from "react";
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Filter,
  MessageSquare,
  Sparkles,
  UserCheck,
} from "lucide-react";

import {
  AI_USEFULNESS_OPTIONS,
  QUICK_ACTIVITIES,
  useWorkUpdates,
  type TeacherWorkUpdate,
} from "@/lib/work-update-store";

export function PrincipalWorkUpdatesFeed() {
  const { updates } = useWorkUpdates();
  const [filterTeacher, setFilterTeacher] = useState<string>("all");
  const [filterDate, setFilterDate] = useState<string>("all");

  const today = new Date().toISOString().slice(0, 10);

  // List unique teachers
  const teachers = Array.from(new Set(updates.map((u) => u.teacher_name)));
  // List unique dates
  const dates = Array.from(new Set(updates.map((u) => u.date))).sort().reverse();

  const filtered = updates.filter((u) => {
    if (filterTeacher !== "all" && u.teacher_name !== filterTeacher) return false;
    if (filterDate !== "all" && u.date !== filterDate) return false;
    return true;
  });

  const activityMap = new Map(QUICK_ACTIVITIES.map((a) => [a.id, a]));
  const aiMap = new Map(AI_USEFULNESS_OPTIONS.map((a) => [a.id, a]));

  const todayCount = updates.filter((u) => u.date === today).length;

  return (
    <div className="space-y-4">
      {/* Overview stats & filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-terracotta/10 text-terracotta">
            <UserCheck className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">Teacher Daily Work Reports</h3>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                {todayCount} submitted today
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Direct classroom activity updates & Medha AI usage feedback from your teachers.
            </p>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <select
              value={filterTeacher}
              onChange={(e) => setFilterTeacher(e.target.value)}
              aria-label="Filter by Teacher"
              className="h-8 rounded-lg border border-border bg-background px-2.5 pr-7 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-terracotta appearance-none cursor-pointer"
            >
              <option value="all">All Teachers ({teachers.length})</option>
              {teachers.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-2.5 size-3 text-muted-foreground" />
          </div>

          <div className="relative">
            <select
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              aria-label="Filter by Date"
              className="h-8 rounded-lg border border-border bg-background px-2.5 pr-7 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-terracotta appearance-none cursor-pointer"
            >
              <option value="all">All Dates ({dates.length})</option>
              {dates.map((d) => (
                <option key={d} value={d}>
                  {d === today ? `Today (${d})` : d}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-2.5 size-3 text-muted-foreground" />
          </div>
        </div>
      </div>

      {/* Cards List */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center text-xs text-muted-foreground">
          No work updates recorded yet matching the filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {filtered.map((item) => {
            const aiOpt = aiMap.get(item.ai_usefulness);
            const isToday = item.date === today;

            return (
              <div
                key={item.id}
                className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-xs transition-colors hover:border-border/80"
              >
                <div>
                  {/* Top: Teacher Name & Date */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-semibold text-sm text-foreground">
                        {item.teacher_name}
                      </span>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground/80">{item.grade_label}</span>
                        <span>·</span>
                        <span>{item.subject_name}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end">
                      <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                        <Calendar className="size-3" />
                        {isToday ? "Today" : item.date}
                      </span>
                      <span className="text-[10px] text-muted-foreground/60">
                        {new Date(item.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Chapter */}
                  <div className="mt-2.5 flex items-center gap-1.5 rounded-lg bg-muted/40 px-2.5 py-1.5 text-xs text-foreground/90">
                    <BookOpen className="size-3.5 shrink-0 text-terracotta" />
                    <span className="truncate font-medium">{item.chapter_title}</span>
                  </div>

                  {/* Activity badges (tick marks summary) */}
                  <div className="mt-3">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Activities Covered:
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {item.activities.map((actKey) => {
                        const act = activityMap.get(actKey);
                        if (!act) return null;
                        return (
                          <span
                            key={actKey}
                            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-[11px] text-foreground/80"
                          >
                            <span>{act.icon}</span>
                            <span>{act.label}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Teacher's note if provided */}
                  {item.note && (
                    <div className="mt-3 flex items-start gap-1.5 rounded-lg border border-border/50 bg-background/50 p-2 text-xs text-foreground/85">
                      <MessageSquare className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                      <span className="italic leading-relaxed">&ldquo;{item.note}&rdquo;</span>
                    </div>
                  )}
                </div>

                {/* Bottom: Medha AI Assistant Helpfulness Rating */}
                <div className="mt-4 border-t border-border/60 pt-2.5 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Sparkles className="size-3 text-amber-500" />
                    Medha AI Assistant:
                  </span>
                  <span className="font-medium text-foreground flex items-center gap-1 bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full text-[11px]">
                    <span>{aiOpt?.emoji ?? "🌟"}</span>
                    <span>{aiOpt?.label.split(" (")[0] ?? "Helpful"}</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
