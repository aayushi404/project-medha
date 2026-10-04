"use client";

import { useMemo, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";

import {
  markCoverAbsence,
  unmarkCoverAbsence,
  type CoverAbsence,
  type CoverReason,
  type PlannerPeriodSlot,
  type TeacherRosterItem,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProfileImage } from "@/components/ui/profile-image";

const REASONS: { value: CoverReason | ""; en: string; hi: string }[] = [
  { value: "", en: "No reason", hi: "कारण नहीं" },
  { value: "sick", en: "Sick", hi: "बीमार" },
  { value: "leave", en: "Leave", hi: "अवकाश" },
  { value: "official_duty", en: "Official duty", hi: "सरकारी ड्यूटी" },
  { value: "training", en: "Training", hi: "प्रशिक्षण" },
];

/** One searchable list with a toggle per teacher. The principal already knows
 * the names, so this is the fastest path: tap to mark, tap again to unmark. */
export function MarkAbsentSheet({
  open,
  onOpenChange,
  token,
  date,
  dateLabel,
  teachers,
  absences,
  periods,
  isHi,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string | null;
  date: string;
  dateLabel: string;
  teachers: TeacherRosterItem[];
  absences: CoverAbsence[];
  periods: PlannerPeriodSlot[];
  isHi: boolean;
  onChanged: () => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [partial, setPartial] = useState(false);
  const [from, setFrom] = useState<number | null>(null);
  const [to, setTo] = useState<number | null>(null);
  const [reason, setReason] = useState<CoverReason | "">("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const absentById = useMemo(() => new Map(absences.map((a) => [a.teacher_id, a])), [absences]);
  const teachingPeriods = periods.filter((p) => !p.is_break);
  const q = query.trim().toLowerCase();
  const list = teachers.filter((t) => !q || t.full_name.toLowerCase().includes(q));
  const partialReady = !partial || (from !== null && to !== null && from <= to);

  async function toggle(teacher: TeacherRosterItem) {
    const existing = absentById.get(teacher.id);
    setBusyId(teacher.id);
    try {
      if (existing) {
        let result = await unmarkCoverAbsence(token, existing.id, false);
        if (result.status === 409) {
          // the absence has covers: the principal confirms before they are cleared
          if (!window.confirm(`${result.message}\n\n${isHi ? "क्या आगे बढ़ें?" : "Continue?"}`)) return;
          result = await unmarkCoverAbsence(token, existing.id, true);
        }
        if (result.status >= 400) throw new Error(result.message || "Could not unmark.");
        toast.success(`${teacher.full_name} ${isHi ? "अब उपस्थित है" : "is no longer marked absent"}.`);
      } else {
        const res = await markCoverAbsence(token, {
          teacher_id: teacher.id,
          dates: [date],
          is_full_day: !partial,
          from_period_number: partial ? from : null,
          to_period_number: partial ? to : null,
          reason: reason || null,
        });
        const released = res.released > 0 ? ` ${res.released} ${isHi ? "कवर हटे" : "cover removed, those periods are red again"}.` : "";
        toast.success(`${teacher.full_name} ${isHi ? "अनुपस्थित चिह्नित" : "marked absent"}.${released}`);
      }
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : isHi ? "सहेजा नहीं जा सका।" : "Could not save.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[min(34rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
          <div className="flex items-start justify-between gap-3 border-b border-border p-4">
            <div>
              <Dialog.Title className="text-base font-semibold text-foreground">
                {isHi ? "अनुपस्थित शिक्षक" : "Mark absent"}
              </Dialog.Title>
              <Dialog.Description className="mt-0.5 text-xs text-muted-foreground">{dateLabel}</Dialog.Description>
            </div>
            <Dialog.Close aria-label={isHi ? "बंद करें" : "Close"} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
              <X className="size-4" />
            </Dialog.Close>
          </div>

          <div className="space-y-3 border-b border-border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border border-border p-0.5 text-sm">
                {[
                  { v: false, en: "Full day", hi: "पूरा दिन" },
                  { v: true, en: "Part of day", hi: "दिन का हिस्सा" },
                ].map((m) => (
                  <button
                    key={String(m.v)}
                    type="button"
                    onClick={() => setPartial(m.v)}
                    aria-pressed={partial === m.v}
                    className={cn("rounded-md px-3 py-1", partial === m.v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                  >
                    {isHi ? m.hi : m.en}
                  </button>
                ))}
              </div>
              <select
                aria-label={isHi ? "कारण" : "Reason"}
                value={reason}
                onChange={(e) => setReason(e.target.value as CoverReason | "")}
                className="h-8 rounded-lg border border-border bg-background px-2 text-sm"
              >
                {REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {isHi ? r.hi : r.en}
                  </option>
                ))}
              </select>
            </div>
            {partial ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">{isHi ? "कालांश" : "Periods"}</span>
                <select aria-label={isHi ? "से" : "From"} value={from ?? ""} onChange={(e) => setFrom(e.target.value ? Number(e.target.value) : null)} className="h-8 rounded-lg border border-border bg-background px-2">
                  <option value="">{isHi ? "से" : "From"}</option>
                  {teachingPeriods.map((p) => (
                    <option key={p.id} value={p.period_number}>{p.label ?? `P${p.period_number}`}</option>
                  ))}
                </select>
                <span className="text-muted-foreground">–</span>
                <select aria-label={isHi ? "तक" : "To"} value={to ?? ""} onChange={(e) => setTo(e.target.value ? Number(e.target.value) : null)} className="h-8 rounded-lg border border-border bg-background px-2">
                  <option value="">{isHi ? "तक" : "To"}</option>
                  {teachingPeriods.map((p) => (
                    <option key={p.id} value={p.period_number}>{p.label ?? `P${p.period_number}`}</option>
                  ))}
                </select>
                {!partialReady ? <span className="text-xs text-red-600">{isHi ? "पहले कालांश चुनें" : "Choose the periods first"}</span> : null}
              </div>
            ) : null}
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={isHi ? "शिक्षक खोजें…" : "Search teachers…"} className="pl-8" autoFocus />
            </div>
          </div>

          <ul className="flex-1 divide-y divide-border overflow-y-auto">
            {list.map((t) => {
              const absence = absentById.get(t.id);
              const busy = busyId === t.id;
              return (
                <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                  <ProfileImage url={t.photo_url} name={t.full_name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{t.full_name}</p>
                    {absence ? (
                      <p className="truncate text-xs text-red-600 dark:text-red-400">
                        {absence.is_full_day
                          ? isHi ? "आज पूरे दिन अनुपस्थित" : "Absent all day"
                          : `${isHi ? "अनुपस्थित" : "Absent"} P${absence.from_period_number}–P${absence.to_period_number}`}
                      </p>
                    ) : (
                      <p className="truncate text-xs text-muted-foreground">{t.primary_subject_name ?? (isHi ? "विषय तय नहीं" : "No subject set")}</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant={absence ? "outline" : "default"}
                    disabled={busy || (!absence && !partialReady)}
                    onClick={() => toggle(t)}
                  >
                    {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
                    {absence ? (isHi ? "उपस्थित करें" : "Unmark") : isHi ? "अनुपस्थित" : "Mark absent"}
                  </Button>
                </li>
              );
            })}
            {list.length === 0 ? <li className="p-6 text-center text-sm text-muted-foreground">{isHi ? "कोई शिक्षक नहीं मिला।" : "No teachers match."}</li> : null}
          </ul>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
