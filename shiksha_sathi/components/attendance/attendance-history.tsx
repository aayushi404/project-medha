"use client";

import { Download } from "lucide-react";

import {
  type AttClass,
  type AttData,
  daySummary,
  datesFor,
  formatDay,
} from "@/lib/attendance-store";

export function AttendanceHistory({
  data,
  cls,
  onOpenDate,
}: {
  data: AttData;
  cls: AttClass | null;
  onOpenDate: (date: string) => void;
}) {
  if (!cls) {
    return <p className="text-sm text-muted-foreground">Pick a class to see its history.</p>;
  }

  const dates = datesFor(data, cls.id);

  if (dates.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No attendance saved for {cls.name} yet.
      </p>
    );
  }

  function exportCsv() {
    const rows: string[] = ["Date,Roll,Student,Status"];
    for (const date of dates) {
      const marks = data.records[cls!.id]?.[date] ?? {};
      for (const s of cls!.students) {
        const status = marks[s.id] ?? "unmarked";
        const name = s.name.includes(",") ? `"${s.name}"` : s.name;
        rows.push(`${date},${s.roll ?? ""},${name},${status}`);
      }
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${cls!.name.replace(/\s+/g, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {dates.length} day{dates.length === 1 ? "" : "s"} recorded
        </span>
        <button
          type="button"
          onClick={exportCsv}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-muted"
        >
          <Download className="size-3.5" /> Export CSV
        </button>
      </div>

      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
        {dates.map((date) => {
          const s = daySummary(data, cls.id, date);
          return (
            <li key={date}>
              <button
                type="button"
                onClick={() => onOpenDate(date)}
                className="flex w-full items-center gap-3 bg-card px-3 py-2.5 text-left hover:bg-muted"
              >
                <span className="w-28 shrink-0 text-sm">{formatDay(date)}</span>
                <span className="flex-1 text-xs text-muted-foreground">
                  <span className="text-sage">{s.present} P</span> ·{" "}
                  <span className="text-destructive">{s.absent} A</span> ·{" "}
                  <span className="text-earth">{s.late} L</span>
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {s.pct}%
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
