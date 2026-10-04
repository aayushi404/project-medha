"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, Loader2, Printer, Sparkles, UserX, X } from "lucide-react";
import { toast } from "sonner";

import {
  applyCover,
  applyCoverBulk,
  clearCover,
  finalizeDay,
  getCoverDay,
  getFinalStatus,
  getPrincipalTeachers,
  type FinalStatus,
  suggestCover,
  type CoverCandidates,
  type CoverCell,
  type CoverDayBoard,
  type CoverSuggestionItem,
  type TeacherRosterItem,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AssignCoverSheet } from "@/components/principal/cover/assign-cover-sheet";
import { CoverGrid } from "@/components/principal/cover/cover-grid";
import { MarkAbsentSheet } from "@/components/principal/cover/mark-absent-sheet";
import { formatTime } from "@/components/principal/planner/planner-grid";

const NO_CANDIDATES: CoverCandidates = { available: [], unavailable: [] };

export function todayIso(): string {
  return new Date().toLocaleDateString("en-CA");
}

function errorText(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

/** The morning board: who is absent today, which periods need cover, and the
 * cover for each. The day's plan is read from the published timetable, with
 * that day's absences and covers applied on top. The base timetable is never
 * changed here. */
export function CoverBoard() {
  const { accessToken: token } = useAuth();
  const { locale } = useLocale();
  const isHi = locale === "hi";

  const [date, setDate] = useState(todayIso);
  const [reloads, setReloads] = useState(0);
  const [board, setBoard] = useState<CoverDayBoard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [teachers, setTeachers] = useState<TeacherRosterItem[]>([]);
  const [absentOpen, setAbsentOpen] = useState(false);
  const [openCellId, setOpenCellId] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<CoverSuggestionItem[] | null>(null);
  const [acting, setActing] = useState(false);
  const [final, setFinal] = useState<FinalStatus | null>(null);

  useEffect(() => {
    if (!token) return;
    getPrincipalTeachers(token).then(setTeachers).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    getCoverDay(token, date)
      .then((b) => {
        if (cancelled) return;
        setBoard(b);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorText(err, isHi ? "बोर्ड लोड नहीं हो सका।" : "Could not load the board."));
      });
    return () => {
      cancelled = true;
    };
  }, [token, date, reloads, isHi]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    getFinalStatus(token, date)
      .then((f) => !cancelled && setFinal(f))
      .catch(() => !cancelled && setFinal(null));
    return () => {
      cancelled = true;
    };
  }, [token, date, reloads]);

  async function finalize() {
    setActing(true);
    try {
      const f = await finalizeDay(token, date);
      setFinal(f);
      toast.success(
        isHi
          ? "अंतिम समय-सारणी शिक्षकों के बोर्ड पर है।"
          : "Final timetable is now on the teachers' board.",
      );
    } catch (err) {
      toast.error(errorText(err, isHi ? "अंतिम नहीं हो सका।" : "Could not finalize the day."));
    } finally {
      setActing(false);
    }
  }

  const stale = board !== null && board.date !== date;
  const dateObj = new Date(`${date}T00:00:00`);
  const isToday = date === todayIso();
  const dayTitle = dateObj.toLocaleDateString(isHi ? "hi-IN" : "en-IN", { weekday: "long", day: "numeric", month: "short" });
  const slotLabel = new Map((board?.period_slots ?? []).map((p) => [p.id, p.label ?? `P${p.period_number}`]));
  const periodNumber = new Map((board?.period_slots ?? []).map((p) => [p.period_number, p.label ?? `P${p.period_number}`]));
  const sectionLabel = new Map((board?.class_sections ?? []).map((s) => [s.id, s.label]));
  const openCell = board?.cells.find((c) => c.timetable_cell_id === openCellId) ?? null;
  const needs = board?.summary.needs_cover ?? 0;
  const absent = board?.summary.absent_count ?? 0;

  function refresh() {
    setReloads((n) => n + 1);
  }

  function changeDate(value: string) {
    if (!value) return;
    setDate(value);
    setSuggestion(null);
    setOpenCellId(null);
  }

  async function run(action: () => Promise<unknown>, success: string) {
    setActing(true);
    try {
      await action();
      toast.success(success);
      refresh();
    } catch (err) {
      toast.error(errorText(err, isHi ? "कुछ गलत हुआ।" : "Something went wrong."));
      throw err;
    } finally {
      setActing(false);
    }
  }

  async function coverWith(cell: CoverCell, teacherId: string) {
    await run(
      () => applyCover(token, { date, timetable_cell_id: cell.timetable_cell_id, action: "assign", substitute_teacher_id: teacherId }),
      isHi ? "कवर तय हो गया।" : "Cover assigned.",
    );
    setOpenCellId(null);
  }

  async function markCell(cell: CoverCell, action: "self_study" | "cancel") {
    await run(
      () => applyCover(token, { date, timetable_cell_id: cell.timetable_cell_id, action }),
      action === "self_study" ? (isHi ? "स्व-अध्ययन चिह्नित।" : "Marked as self-study.") : isHi ? "कालांश रद्द।" : "Period cancelled.",
    );
    setOpenCellId(null);
  }

  async function clearCell(cell: CoverCell) {
    if (!cell.substitute) return;
    await run(() => clearCover(token, cell.substitute!.id), isHi ? "कवर हटाया गया।" : "Cover cleared. The period is red again.");
    setOpenCellId(null);
  }

  async function runSuggestion() {
    setActing(true);
    try {
      const res = await suggestCover(token, date);
      setSuggestion(res.items);
    } catch (err) {
      toast.error(errorText(err, isHi ? "सुझाव नहीं बन सका।" : "Could not make suggestions."));
    } finally {
      setActing(false);
    }
  }

  async function acceptSuggestion() {
    if (!suggestion) return;
    const items = suggestion
      .filter((i) => i.substitute_teacher_id)
      .map((i) => ({ date, timetable_cell_id: i.timetable_cell_id, action: "assign" as const, substitute_teacher_id: i.substitute_teacher_id }));
    if (items.length === 0) return;
    await run(() => applyCoverBulk(token, date, items), isHi ? `${items.length} कवर तय।` : `${items.length} covers assigned.`);
    setSuggestion(null);
  }

  return (
    <div className="space-y-4">
      {/* Header: the counter is the progress indicator */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-border bg-card p-5">
        <div className="min-w-0">
          <h2 className="font-serif text-xl font-semibold text-foreground">
            {isToday ? (isHi ? "आज" : "Today") : isHi ? "दिन" : "Day"} · {dayTitle}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {board ? (
              absent === 0 ? (
                isHi ? "आज कोई अनुपस्थित नहीं" : "No one is absent"
              ) : needs === 0 ? (
                <span className="text-emerald-700 dark:text-emerald-400">
                  {isHi ? `${absent} अनुपस्थित · सभी कालांश कवर` : `${absent} absent · every period is covered`}
                </span>
              ) : (
                <span className="text-red-700 dark:text-red-300">
                  {isHi ? `${absent} अनुपस्थित · ${needs} कालांश को कवर चाहिए` : `${absent} absent · ${needs} ${needs === 1 ? "period needs" : "periods need"} cover`}
                </span>
              )
            ) : (
              "…"
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            aria-label={isHi ? "तारीख" : "Date"}
            value={date}
            onChange={(e) => changeDate(e.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-3 text-sm"
          />
          <Button variant="outline" onClick={() => setAbsentOpen(true)} disabled={!token}>
            <UserX className="size-4" />
            {isHi ? "अनुपस्थित चिह्नित करें" : "Mark absent"}
          </Button>
          <Button onClick={runSuggestion} disabled={acting || needs === 0 || !board?.timetable}>
            {acting ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {isHi ? "सभी के लिए सुझाव" : "Suggest all"}
          </Button>
          <Button
            variant={final?.finalized && final.up_to_date ? "outline" : "default"}
            onClick={finalize}
            disabled={acting || !board?.timetable || needs > 0 || (final?.finalized === true && final.up_to_date === true)}
          >
            {final?.finalized && final.up_to_date
              ? isHi ? "अंतिम ✓" : "Final ✓"
              : final?.finalized
                ? isHi ? "अंतिम अपडेट करें" : "Update final timetable"
                : isHi ? "दिन को अंतिम करें" : "Finalize day"}
          </Button>
          <Link href={`/principal/cover/print?date=${date}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-sm text-foreground hover:bg-muted">
            <Printer className="size-4" />
            {isHi ? "प्रिंट" : "Print"}
          </Link>
        </div>
      </div>

      {/* What the teachers' board shows for this day */}
      {final ? (
        <p className="text-xs text-muted-foreground">
          {!final.finalized
            ? needs > 0
              ? isHi
                ? "शिक्षकों के बोर्ड पर अभी कुछ नहीं। सभी कालांश कवर होने पर दिन को अंतिम करें।"
                : "Not on the teachers' board yet. Cover every period, then finalize the day."
              : isHi
                ? "सभी कालांश तैयार हैं। दिन को अंतिम करें ताकि शिक्षकों के बोर्ड पर दिखे।"
                : "Every period is ready. Finalize the day to put it on the teachers' board."
            : final.up_to_date
              ? isHi
                ? `शिक्षकों के बोर्ड पर अंतिम (संस्करण ${final.version}) · ${final.finalized_at?.replace("T", " ")}`
                : `On the teachers' board as final (version ${final.version}) · ${final.finalized_at?.replace("T", " ")}`
              : isHi
                ? "शिक्षकों के बोर्ड पर पुराना संस्करण है। कवर बदला गया है, अंतिम अपडेट करें।"
                : "The teachers' board shows an older version. The cover has changed since; update the final timetable."}
        </p>
      ) : null}

      {/* Absent today */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card px-5 py-3">
        <span className="text-sm text-muted-foreground">{isHi ? "आज अनुपस्थित" : "Absent today"}</span>
        {board?.absences.length === 0 ? (
          <span className="text-sm text-muted-foreground">—</span>
        ) : null}
        {board?.absences.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setAbsentOpen(true)}
            className="rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-sm text-red-700 hover:bg-red-500/20 dark:text-red-300"
          >
            {a.teacher_name}
            {!a.is_full_day && a.from_period_number && a.to_period_number
              ? ` · ${periodNumber.get(a.from_period_number) ?? `P${a.from_period_number}`}–${periodNumber.get(a.to_period_number) ?? `P${a.to_period_number}`}`
              : ""}
          </button>
        ))}
      </div>

      {/* Suggestion review: a proposal the principal accepts or discards */}
      {suggestion ? (
        <div className="rounded-2xl border border-primary/40 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{isHi ? "सुझाव" : "Suggested cover"}</p>
              <p className="text-xs text-muted-foreground">
                {isHi
                  ? "यह केवल सुझाव है। कुछ भी तब तक सहेजा नहीं जाता जब तक आप स्वीकार न करें।"
                  : "A proposal only. Nothing is saved until you accept it."}
              </p>
            </div>
            <button type="button" onClick={() => setSuggestion(null)} aria-label={isHi ? "बंद करें" : "Discard"} className="rounded-md p-1 text-muted-foreground hover:bg-muted">
              <X className="size-4" />
            </button>
          </div>
          <ul className="mt-3 divide-y divide-border text-sm">
            {suggestion.map((i) => (
              <li key={i.timetable_cell_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-muted-foreground">
                  {sectionLabel.get(i.class_section_id)} · {slotLabel.get(i.period_slot_id)}
                </span>
                {i.substitute_teacher_name ? (
                  <span className="font-medium text-emerald-700 dark:text-emerald-400">{i.substitute_teacher_name}</span>
                ) : (
                  <span className="text-amber-700 dark:text-amber-400">{i.reason}</span>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setSuggestion(null)}>
              {isHi ? "छोड़ें" : "Discard"}
            </Button>
            <Button size="sm" onClick={acceptSuggestion} disabled={acting || !suggestion.some((i) => i.substitute_teacher_id)}>
              {isHi ? "सभी स्वीकार करें" : "Accept all"}
            </Button>
          </div>
        </div>
      ) : null}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <Legend tone="bg-red-500/60" label={isHi ? "कवर चाहिए" : "Needs cover"} />
        <Legend tone="bg-emerald-500/60" label={isHi ? "कवर हो गया" : "Covered"} />
        <Legend tone="bg-amber-500/60" label={isHi ? "स्व-अध्ययन" : "Self-study"} />
      </div>

      {error ? (
        <p className="rounded-xl border border-border bg-card p-5 text-sm text-destructive">{error}</p>
      ) : !board ? (
        <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {isHi ? "बोर्ड लोड हो रहा है…" : "Loading the board…"}
        </div>
      ) : !board.timetable ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center">
          <p className="font-medium text-foreground">{isHi ? "कोई प्रकाशित समय-सारणी नहीं" : "No published timetable for this year"}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {isHi ? "पहले समय-सारणी प्रकाशित करें। फिर यहाँ कवर दिखेगा।" : "Publish a timetable first. Covers show up here once it's published."}
          </p>
          <Link href="/principal/timetable" className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
            <CalendarClock className="size-4" />
            {isHi ? "समय-सारणी खोलें" : "Open the timetable"}
          </Link>
        </div>
      ) : board.period_slots.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
          {isHi ? "इस दिन के कालांश तय नहीं हैं।" : "No periods are set up for this day."}
        </p>
      ) : (
        <div className={cn(stale && "opacity-60 transition-opacity")}>
          <CoverGrid
            slots={board.period_slots}
            sections={board.class_sections}
            cells={board.cells}
            selectedKey={openCell ? `${openCell.class_section_id}|${openCell.period_slot_id}` : null}
            isHi={isHi}
            onOpen={(c) => setOpenCellId(c.timetable_cell_id)}
          />
        </div>
      )}

      {openCell && board ? (
        <AssignCoverSheet
          open
          onOpenChange={(o) => !o && setOpenCellId(null)}
          cell={openCell}
          title={isHi ? "कवर तय करें" : "Assign cover"}
          subtitle={`${sectionLabel.get(openCell.class_section_id) ?? ""} — ${slotLabel.get(openCell.period_slot_id) ?? ""} ${openCell.subject_name}${timeFor(board, openCell.period_slot_id)}`}
          candidates={openCell.state === "needs_cover" ? board.candidates[openCell.timetable_cell_id] ?? null : NO_CANDIDATES}
          isHi={isHi}
          busy={acting}
          onAssign={(teacherId) => coverWith(openCell, teacherId)}
          onSelfStudy={() => markCell(openCell, "self_study")}
          onCancel={() => markCell(openCell, "cancel")}
          onClear={() => clearCell(openCell)}
        />
      ) : null}

      {board ? (
        <MarkAbsentSheet
          open={absentOpen}
          onOpenChange={setAbsentOpen}
          token={token}
          date={date}
          dateLabel={dayTitle}
          teachers={teachers}
          absences={board.absences}
          periods={board.period_slots}
          isHi={isHi}
          onChanged={async () => refresh()}
        />
      ) : null}
    </div>
  );
}

function timeFor(board: CoverDayBoard, slotId: string): string {
  const slot = board.period_slots.find((p) => p.id === slotId);
  return slot?.starts_at && slot.ends_at ? ` · ${formatTime(slot.starts_at)}–${formatTime(slot.ends_at)}` : "";
}

function Legend({ tone, label }: { tone: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-2.5 rounded-full", tone)} />
      {label}
    </span>
  );
}
