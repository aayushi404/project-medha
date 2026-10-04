"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Printer } from "lucide-react";

import { getFinalDay, type FinalDay, type FinalDayPayload } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const REFRESH_MS = 60_000;

function todayIso(): string {
  return new Date().toLocaleDateString("en-CA");
}

function shiftDay(iso: string, delta: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toLocaleDateString("en-CA");
}

function time(t: string | null): string {
  return t ? t.slice(0, 5) : "";
}

/** The school's timetable for one day, as the principal finalized it. Shaped
 * like the board on the staffroom wall: periods down, classes across. The
 * teacher's own periods are marked. Prints with the app's print-region rules. */
export function SchoolDayBoard() {
  const { accessToken: token, teacher } = useAuth();
  const { locale } = useLocale();
  const isHi = locale === "hi";
  const me = teacher?.id ?? null;

  const [date, setDate] = useState(todayIso);
  const [refreshes, setRefreshes] = useState(0);
  const [day, setDay] = useState<FinalDay | null>(null);
  const [dayKey, setDayKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refresh when the page regains focus and every minute, so a finalized day shows up
  useEffect(() => {
    const bump = () => setRefreshes((n) => n + 1);
    const timer = window.setInterval(bump, REFRESH_MS);
    window.addEventListener("focus", bump);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", bump);
    };
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const key = `${date}:${refreshes}`;
    getFinalDay(token, date)
      .then((d) => {
        if (cancelled) return;
        setDay(d);
        setDayKey(key);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setDayKey(key);
        setError(err instanceof Error ? err.message : isHi ? "बोर्ड लोड नहीं हो सका।" : "Could not load the timetable.");
      });
    return () => {
      cancelled = true;
    };
  }, [token, date, refreshes, isHi]);

  const loading = dayKey !== `${date}:${refreshes}`;
  const payload: FinalDayPayload | null = day?.payload ?? null;
  const isToday = date === todayIso();
  const dayName = new Date(`${date}T00:00:00`).toLocaleDateString(isHi ? "hi-IN" : "en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const grid = useMemo(() => {
    if (!payload) return null;
    const cellAt = new Map(payload.cells.map((c) => [`${c.class_section_id}|${c.period_slot_id}`, c]));
    return { cellAt };
  }, [payload]);

  function print() {
    // same hook as the other printed documents: only `.print-region` prints
    document.body.classList.add("printing");
    const cleanup = () => {
      document.body.classList.remove("printing");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
    window.setTimeout(cleanup, 1000);
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <h1 className="text-[15px] font-semibold text-foreground">
            {isHi ? "विद्यालय की समय-सारणी" : "School timetable"}
          </h1>
          <p className="text-xs text-muted-foreground">{dayName}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon-sm" aria-label={isHi ? "पिछला दिन" : "Previous day"} onClick={() => setDate((d) => shiftDay(d, -1))}>
            <ChevronLeft className="size-4" />
          </Button>
          {!isToday ? (
            <Button variant="outline" size="sm" onClick={() => setDate(todayIso())}>
              {isHi ? "आज" : "Today"}
            </Button>
          ) : null}
          <Button variant="outline" size="icon-sm" aria-label={isHi ? "अगला दिन" : "Next day"} onClick={() => setDate((d) => shiftDay(d, 1))}>
            <ChevronRight className="size-4" />
          </Button>
          <Button size="sm" onClick={print} disabled={!payload}>
            <Printer className="size-4" />
            {isHi ? "प्रिंट" : "Print"}
          </Button>
        </div>
      </div>

      <div className="flex-1 space-y-4 px-5 py-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : !payload ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
            <p className="font-medium text-foreground">
              {isHi ? "इस दिन की अंतिम समय-सारणी अभी तैयार नहीं है" : "The final timetable for this day isn't ready yet"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isHi
                ? "प्रधानाचार्य अनुपस्थित शिक्षकों के कालांश तय कर रहे हैं। तैयार होते ही यह बोर्ड अपने आप अपडेट होगा।"
                : "The principal is arranging cover for absent teachers. This board updates by itself once it's ready."}
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="rounded-full bg-emerald-500/15 px-3 py-1 font-medium text-emerald-700 dark:text-emerald-400">
                {isHi ? "अंतिम" : "Final"}
                {day?.finalized_at ? ` · ${day.finalized_at.replace("T", " ")}` : ""}
              </span>
              {payload.absences.length > 0 ? (
                <span className="text-muted-foreground">
                  {isHi ? "आज अनुपस्थित: " : "Absent today: "}
                  {payload.absences.map((a) => a.teacher_name).join(", ")}
                </span>
              ) : (
                <span className="text-muted-foreground">{isHi ? "आज कोई अनुपस्थित नहीं" : "No one is absent today"}</span>
              )}
            </div>

            <div className="print-region overflow-x-auto rounded-xl border border-border bg-card p-3">
              <p className="mb-2 hidden text-center font-serif text-lg font-semibold print:block">
                {isHi ? "विद्यालय की समय-सारणी" : "School timetable"} · {dayName}
              </p>
              <table className="w-full min-w-max border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="w-20 border border-border bg-muted/40 px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                      {isHi ? "कालांश" : "Period"}
                    </th>
                    {payload.class_sections.map((sec) => (
                      <th key={sec.id} className="border border-border bg-muted/40 px-3 py-2 text-center font-semibold text-foreground">
                        {sec.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payload.period_slots.map((slot) => {
                    if (slot.is_break) {
                      return (
                        <tr key={slot.id}>
                          <td colSpan={payload.class_sections.length + 1} className="border border-border bg-muted/30 px-3 py-1.5 text-center text-xs text-muted-foreground">
                            {slot.label ?? (isHi ? "विश्राम" : "Break")}
                            {slot.starts_at && slot.ends_at ? ` · ${time(slot.starts_at)}–${time(slot.ends_at)}` : ""}
                          </td>
                        </tr>
                      );
                    }
                    return (
                      <tr key={slot.id}>
                        <th className="border border-border px-2 py-2 text-left align-top">
                          <span className="block font-medium text-foreground">{slot.label ?? `P${slot.period_number}`}</span>
                          {slot.starts_at && slot.ends_at ? (
                            <span className="block text-[11px] font-normal text-muted-foreground">
                              {time(slot.starts_at)}–{time(slot.ends_at)}
                            </span>
                          ) : null}
                        </th>
                        {payload.class_sections.map((sec) => {
                          const cell = grid?.cellAt.get(`${sec.id}|${slot.id}`);
                          if (!cell) {
                            return (
                              <td key={sec.id} className="border border-border px-2 py-2 text-center text-xs text-muted-foreground">
                                {isHi ? "खाली" : "Free"}
                              </td>
                            );
                          }
                          const mine = me !== null && cell.teacher_id === me;
                          return (
                            <td
                              key={sec.id}
                              className={cn(
                                "border border-border px-2.5 py-2 align-top",
                                cell.state === "covered" && "bg-emerald-500/10",
                                (cell.state === "self_study" || cell.state === "cancelled") && "bg-amber-500/10",
                                mine && "ring-2 ring-inset ring-primary",
                              )}
                            >
                              <span className={cn("block font-semibold", cell.state === "cancelled" && "line-through text-muted-foreground")}>
                                {cell.subject_name}
                              </span>
                              <CellTeacher cell={cell} isHi={isHi} mine={mine} />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="mt-3 text-xs text-muted-foreground print:text-black">
                {isHi
                  ? "हरा: कवर शिक्षक · पीला: स्व-अध्ययन या रद्द · घेरा: आपके कालांश"
                  : "Green: cover teacher · Amber: self-study or cancelled · Outlined: your periods"}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CellTeacher({ cell, isHi, mine }: { cell: FinalDayPayload["cells"][number]; isHi: boolean; mine: boolean }) {
  if (cell.state === "self_study") {
    return <span className="block text-xs text-amber-700 dark:text-amber-300">{isHi ? "स्व-अध्ययन" : "Self-study"}</span>;
  }
  if (cell.state === "cancelled") {
    return <span className="block text-xs text-muted-foreground">{isHi ? "रद्द" : "Cancelled"}</span>;
  }
  if (cell.state === "covered") {
    return (
      <span className="block text-xs text-emerald-700 dark:text-emerald-300">
        {cell.teacher_name} {isHi ? "(कवर)" : "(cover)"}
        {mine ? ` · ${isHi ? "आप" : "you"}` : ""}
      </span>
    );
  }
  return (
    <span className="block text-xs text-muted-foreground">
      {cell.teacher_name ?? (isHi ? "शिक्षक नहीं" : "No teacher")}
      {mine ? ` · ${isHi ? "आप" : "you"}` : ""}
    </span>
  );
}
