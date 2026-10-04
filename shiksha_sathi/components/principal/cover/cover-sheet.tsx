"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Printer } from "lucide-react";

import { getCoverDay, type CoverDayBoard } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/copy";
import { Button } from "@/components/ui/button";
import { formatTime } from "@/components/principal/planner/planner-grid";

/** The cover sheet for the staffroom wall: a plain page, no app chrome, that
 * prints on one A4 sheet. Covers and self-study periods are listed with the
 * teacher who usually takes the period, so anyone walking past can read it. */
export function CoverSheetPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm">…</p>}>
      <CoverSheet />
    </Suspense>
  );
}

function CoverSheet() {
  const { accessToken: token } = useAuth();
  const { locale } = useLocale();
  const isHi = locale === "hi";
  const params = useSearchParams();
  const date = params.get("date") ?? new Date().toLocaleDateString("en-CA");

  const [board, setBoard] = useState<CoverDayBoard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    getCoverDay(token, date)
      .then((b) => !cancelled && setBoard(b))
      .catch((err: unknown) => !cancelled && setError(err instanceof Error ? err.message : "Could not load."));
    return () => {
      cancelled = true;
    };
  }, [token, date]);

  if (error) return <p className="p-6 text-sm text-destructive">{error}</p>;
  if (!board) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        {isHi ? "लोड हो रहा है…" : "Loading…"}
      </div>
    );
  }

  const slot = new Map(board.period_slots.map((s) => [s.id, s]));
  const section = new Map(board.class_sections.map((s) => [s.id, s.label]));
  const rows = board.cells
    .filter((c) => c.state !== "normal")
    .sort((a, b) => (slot.get(a.period_slot_id)?.period_number ?? 0) - (slot.get(b.period_slot_id)?.period_number ?? 0));
  const dayTitle = new Date(`${date}T00:00:00`).toLocaleDateString(isHi ? "hi-IN" : "en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mx-auto max-w-4xl bg-white p-8 text-black print:p-0">
      <div className="mb-6 flex items-start justify-between gap-4 print:hidden">
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="size-4" />
          {isHi ? "प्रिंट करें" : "Print"}
        </Button>
      </div>

      <h1 className="text-2xl font-bold">{isHi ? "आज का कवर" : "Cover sheet"}</h1>
      <p className="mt-1 text-base">{dayTitle}</p>

      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide">{isHi ? "आज अनुपस्थित" : "Absent today"}</h2>
        {board.absences.length === 0 ? (
          <p className="mt-1 text-sm">{isHi ? "कोई नहीं" : "No one"}</p>
        ) : (
          <ul className="mt-1 list-inside list-disc text-sm">
            {board.absences.map((a) => (
              <li key={a.id}>
                {a.teacher_name}
                {!a.is_full_day && a.from_period_number && a.to_period_number
                  ? ` (P${a.from_period_number}–P${a.to_period_number})`
                  : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide">{isHi ? "कालांश" : "Periods"}</h2>
        {rows.length === 0 ? (
          <p className="mt-1 text-sm">{isHi ? "सभी कालांश सामान्य हैं।" : "Every period runs as planned."}</p>
        ) : (
          <table className="mt-2 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-black text-left">
                <th className="py-1.5 pr-3">{isHi ? "कालांश" : "Period"}</th>
                <th className="py-1.5 pr-3">{isHi ? "समय" : "Time"}</th>
                <th className="py-1.5 pr-3">{isHi ? "कक्षा" : "Class"}</th>
                <th className="py-1.5 pr-3">{isHi ? "विषय" : "Subject"}</th>
                <th className="py-1.5 pr-3">{isHi ? "नियमित शिक्षक" : "Usual teacher"}</th>
                <th className="py-1.5">{isHi ? "आज" : "Today"}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const s = slot.get(c.period_slot_id);
                return (
                  <tr key={c.timetable_cell_id} className="border-b border-neutral-300 align-top">
                    <td className="py-2 pr-3">{s?.label ?? `P${s?.period_number}`}</td>
                    <td className="py-2 pr-3">{s?.starts_at && s?.ends_at ? `${formatTime(s.starts_at)}–${formatTime(s.ends_at)}` : ""}</td>
                    <td className="py-2 pr-3">{section.get(c.class_section_id)}</td>
                    <td className="py-2 pr-3">{c.subject_name}</td>
                    <td className="py-2 pr-3">{c.original_teacher_name ?? "—"}</td>
                    <td className="py-2 font-medium">{statusText(c, isHi)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <p className="mt-8 text-xs text-neutral-600">
        {isHi ? "यह शीट कक्षा व्यवस्था के लिए है। बदलाव प्रधानाचार्य कार्यालय से होंगे।" : "Printed from Medha. Changes are made by the principal's office."}
      </p>
    </div>
  );
}

function statusText(c: CoverDayBoard["cells"][number], isHi: boolean): string {
  switch (c.state) {
    case "covered":
      return `${c.substitute?.substitute_teacher_name ?? ""} ${isHi ? "(कवर)" : "(cover)"}`;
    case "self_study":
      return isHi ? "स्व-अध्ययन" : "Self-study";
    case "cancelled":
      return isHi ? "रद्द" : "Cancelled";
    default:
      return isHi ? "कवर चाहिए" : "Needs cover";
  }
}
