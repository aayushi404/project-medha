"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";

import { AttendanceHistory } from "@/components/attendance/attendance-history";
import { AttendanceSheet } from "@/components/attendance/attendance-sheet";
import { RosterManager } from "@/components/attendance/roster-manager";
import { Select } from "@/components/ui/select";
import { daySummary, todayISO, useAttendance } from "@/lib/attendance-store";
import { cn } from "@/lib/utils";

type Tab = "take" | "roster" | "history";
const TABS: { key: Tab; label: string }[] = [
  { key: "take", label: "Take attendance" },
  { key: "roster", label: "Roster" },
  { key: "history", label: "History" },
];

export default function AttendancePage() {
  const att = useAttendance();
  const { data, ready } = att;

  const [tab, setTab] = useState<Tab>("take");
  // the teacher's explicit pick; falls back to the first class when unset or stale
  const [picked, setPicked] = useState<string | null>(null);
  const [date, setDate] = useState(todayISO());

  const activeId =
    picked && data.classes.some((c) => c.id === picked)
      ? picked
      : (data.classes[0]?.id ?? null);
  const setActiveId = setPicked;

  const activeClass = data.classes.find((c) => c.id === activeId) ?? null;
  const dayMarks = (activeId && data.records[activeId]?.[date]) || {};
  const summary = daySummary(data, activeId, date);

  if (!ready) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </main>
    );
  }

  const noClasses = data.classes.length === 0;

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <h1 className="text-[15px]">Attendance</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Mark it each day — kept on this device for now.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                tab === t.key
                  ? "border-transparent bg-accent text-accent-foreground"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {t.label}
            </button>
          ))}
          {!noClasses && (
            <div className="ml-auto flex items-center gap-2">
              <Select
                ariaLabel="Class"
                value={activeId}
                onValueChange={setActiveId}
                options={data.classes.map((c) => ({ value: c.id, label: c.name }))}
                className="h-8"
              />
              {tab === "take" && (
                <input
                  type="date"
                  value={date}
                  max={todayISO()}
                  onChange={(e) => setDate(e.target.value || todayISO())}
                  className="h-8 rounded-lg border border-border bg-background px-2 text-xs outline-none focus-visible:border-ring"
                />
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="mx-auto w-full max-w-2xl">
          {noClasses && tab !== "roster" ? (
            <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-border p-6">
              <p className="text-sm text-muted-foreground">
                No classes yet. Create one to start taking attendance.
              </p>
              <button
                type="button"
                onClick={() => setTab("roster")}
                className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
              >
                Go to Roster
              </button>
            </div>
          ) : tab === "take" ? (
            <AttendanceSheet
              students={activeClass?.students ?? []}
              day={dayMarks}
              summary={summary}
              onMark={(sid, status) => activeId && att.setMark(activeId, date, sid, status)}
              onMarkRemaining={(status) =>
                activeId && att.markRemaining(activeId, date, status)
              }
              onClear={() => activeId && att.clearDay(activeId, date)}
            />
          ) : tab === "roster" ? (
            <RosterManager
              classes={data.classes}
              activeId={activeId}
              onAddClass={(name) => setActiveId(att.addClass(name))}
              onRenameClass={att.renameClass}
              onRemoveClass={att.removeClass}
              onSelectClass={setActiveId}
              onAddStudents={att.addStudents}
              onRemoveStudent={att.removeStudent}
            />
          ) : (
            <AttendanceHistory
              data={data}
              cls={activeClass}
              onOpenDate={(d) => {
                setDate(d);
                setTab("take");
              }}
            />
          )}
        </div>
      </div>
    </main>
  );
}
