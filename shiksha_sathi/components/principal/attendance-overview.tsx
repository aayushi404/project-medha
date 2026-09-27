"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { getPrincipalAttendanceSummary, type SchoolAttendanceSummary } from "@/lib/api";
import { todayISO } from "@/lib/attendance-store";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/copy";
import { Input } from "@/components/ui/input";
import { StatGrid } from "@/components/console/stat-grid";

/** Real attendance numbers for every class_section at the school, for a
 * chosen day -- the principal's "complete attendance stats" page. Flags any
 * class that hasn't taken attendance yet, which is the single most
 * actionable thing this view can surface. */
export function AttendanceOverview() {
  const { accessToken } = useAuth();
  const { locale } = useLocale();
  const isHi = locale === "hi";

  const [date, setDate] = useState(todayISO());
  const [summary, setSummary] = useState<SchoolAttendanceSummary | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    getPrincipalAttendanceSummary(accessToken, date)
      .then((result) => {
        if (active) setSummary(result);
      })
      .catch((e: unknown) => {
        if (active) toast.error(e instanceof Error ? e.message : "Could not load attendance stats.");
      });
    return () => {
      active = false;
    };
  }, [accessToken, date]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {isHi ? "दिनांक" : "Date"}
        </span>
        <Input
          type="date"
          value={date}
          max={todayISO()}
          onChange={(e) => setDate(e.target.value || todayISO())}
          className="w-auto text-sm"
          aria-label={isHi ? "दिनांक" : "Date"}
        />
      </div>

      {summary === null ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <StatGrid
            stats={[
              {
                label: isHi ? "कुल छात्र" : "Total students",
                value: summary.total_students,
              },
              { label: isHi ? "उपस्थित" : "Present", value: summary.present_count },
              { label: isHi ? "अनुपस्थित" : "Absent", value: summary.absent_count },
              {
                label: isHi ? "समग्र उपस्थिति" : "Overall attendance",
                value: summary.percentage != null ? `${summary.percentage}%` : "—",
              },
            ]}
          />

          {summary.classes.length === 0 ? (
            <p className="rounded-xl bg-card p-8 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
              {isHi ? "अभी कोई कक्षा सेट अप नहीं है।" : "No classes set up yet."}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">{isHi ? "कक्षा" : "Class"}</th>
                    <th className="px-4 py-2.5 font-medium">{isHi ? "कक्षा शिक्षक" : "Class teacher"}</th>
                    <th className="px-4 py-2.5 text-right font-medium">{isHi ? "उपस्थित" : "Present"}</th>
                    <th className="px-4 py-2.5 text-right font-medium">{isHi ? "अनुपस्थित" : "Absent"}</th>
                    <th className="px-4 py-2.5 text-right font-medium">{isHi ? "स्थिति" : "Status"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {summary.classes.map((c) => {
                    const marked = c.present_count + c.absent_count;
                    const notMarked = c.total_students > 0 && marked === 0;
                    const partial = c.total_students > 0 && marked > 0 && marked < c.total_students;
                    return (
                      <tr key={c.class_section_id}>
                        <td className="px-4 py-2.5 font-medium text-foreground">
                          {c.grade_label} · {c.section}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {c.class_teacher_name ?? "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-sage">
                          {c.present_count}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-destructive">
                          {c.absent_count}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {c.total_students === 0 ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : notMarked ? (
                            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                              {isHi ? "अभी अंकित नहीं" : "Not marked yet"}
                            </span>
                          ) : partial ? (
                            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                              {marked}/{c.total_students} {isHi ? "अंकित" : "marked"}
                            </span>
                          ) : (
                            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                              {c.percentage}%
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
