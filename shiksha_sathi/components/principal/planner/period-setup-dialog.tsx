"use client";

import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import {
  copyPlannerSlots,
  savePlannerSlots,
  type PlannerPeriodSlot,
  type PlannerPeriodSlotInput,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Row = {
  period_number: number;
  label: string;
  starts: string;
  ends: string;
  is_break: boolean;
};

const DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_NAMES_HI = ["", "सोमवार", "मंगलवार", "बुधवार", "गुरुवार", "शुक्रवार", "शनिवार", "रविवार"];

function toRows(slots: PlannerPeriodSlot[]): Row[] {
  return slots.map((s) => ({
    period_number: s.period_number,
    label: s.label ?? "",
    starts: s.starts_at ? s.starts_at.slice(0, 5) : "",
    ends: s.ends_at ? s.ends_at.slice(0, 5) : "",
    is_break: s.is_break,
  }));
}

/** Define the periods for one day (plan step 1). Changes apply to that day
 * only; use the copy row to set the same structure on other days. Periods that
 * already hold classes can't be removed or turned into breaks. */
export function PeriodSetupDialog({
  token,
  day,
  slots,
  isHi,
  onOpenChange,
  onSaved,
}: {
  token: string | null;
  day: number;
  slots: PlannerPeriodSlot[];
  isHi: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [rows, setRows] = useState<Row[]>(() => toRows(slots));
  const [copyTo, setCopyTo] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dayNames = isHi ? DAY_NAMES_HI : DAY_NAMES;
  const otherDays = [1, 2, 3, 4, 5, 6].filter((d) => d !== day);

  function update(index: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => {
      const next = prev.reduce((max, r) => Math.max(max, r.period_number), 0) + 1;
      return [...prev, { period_number: next, label: `P${next}`, starts: "", ends: "", is_break: false }];
    });
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function toPayload(): PlannerPeriodSlotInput[] | null {
    const payload: PlannerPeriodSlotInput[] = [];
    for (const r of rows) {
      if (r.starts && r.ends && r.ends <= r.starts) {
        setError(
          isHi
            ? `कालांश ${r.period_number} का अंत समय शुरुआत के बाद होना चाहिए।`
            : `Period ${r.period_number} must end after it starts.`,
        );
        return null;
      }
      payload.push({
        period_number: r.period_number,
        label: r.label.trim() || (r.is_break ? null : `P${r.period_number}`),
        starts_at: r.is_break || !r.starts ? null : r.starts,
        ends_at: r.is_break || !r.ends ? null : r.ends,
        is_break: r.is_break,
      });
    }
    return payload;
  }

  async function save() {
    setError(null);
    const payload = toPayload();
    if (!payload) return;
    setBusy(true);
    try {
      await savePlannerSlots(token, day, payload);
      if (copyTo.length > 0) {
        await copyPlannerSlots(token, day, copyTo);
      }
      toast.success(isHi ? "कालांश सहेजे गए" : "Periods saved");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : isHi ? "सहेजा नहीं जा सका।" : "Could not save the periods.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root open onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[min(38rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
          <div className="flex items-start justify-between gap-3 border-b border-border p-4">
            <div>
              <Dialog.Title className="font-serif text-base font-semibold text-foreground">
                {isHi ? `${dayNames[day]} के कालांश` : `Periods on ${dayNames[day]}`}
              </Dialog.Title>
              <Dialog.Description className="mt-0.5 text-xs text-muted-foreground">
                {isHi
                  ? "हर दिन की अपनी कालांश व्यवस्था हो सकती है। जिस कालांश में कक्षाएँ तय हैं उसे हटाया नहीं जा सकता।"
                  : "Each day can have its own structure. A period that already holds classes can't be removed or made a break."}
              </Dialog.Description>
            </div>
            <Dialog.Close className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={isHi ? "बंद करें" : "Close"}>
              <X className="size-4" />
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {rows.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                {isHi ? "अभी कोई कालांश नहीं। नीचे से जोड़ें।" : "No periods yet. Add the first one below."}
              </p>
            ) : (
              <ul className="space-y-2">
                {rows.map((r, i) => (
                  <li
                    key={`${r.period_number}-${i}`}
                    className={cn(
                      "grid grid-cols-[4rem_1fr_6.5rem_6.5rem_auto_auto] items-center gap-2 rounded-lg border border-border p-2",
                      r.is_break && "bg-muted/40",
                    )}
                  >
                    <span className="text-sm font-medium text-muted-foreground">#{r.period_number}</span>
                    <Input
                      value={r.label}
                      onChange={(e) => update(i, { label: e.target.value })}
                      placeholder={isHi ? "नाम" : "Label"}
                      className="h-9"
                      aria-label={isHi ? "नाम" : "Label"}
                    />
                    <Input
                      type="time"
                      value={r.starts}
                      disabled={r.is_break}
                      onChange={(e) => update(i, { starts: e.target.value })}
                      className="h-9"
                      aria-label={isHi ? "शुरू" : "Starts"}
                    />
                    <Input
                      type="time"
                      value={r.ends}
                      disabled={r.is_break}
                      onChange={(e) => update(i, { ends: e.target.value })}
                      className="h-9"
                      aria-label={isHi ? "समाप्त" : "Ends"}
                    />
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={r.is_break}
                        onChange={(e) => update(i, { is_break: e.target.checked })}
                      />
                      {isHi ? "विश्राम" : "Break"}
                    </label>
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      aria-label={isHi ? "हटाएँ" : "Remove period"}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-red-600"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <Button variant="outline" size="sm" className="mt-3" onClick={addRow}>
              <Plus className="size-4" />
              {isHi ? "कालांश जोड़ें" : "Add period"}
            </Button>

            {otherDays.length > 0 ? (
              <div className="mt-6 border-t border-border pt-4">
                <p className="text-sm font-medium text-foreground">
                  {isHi ? "यही कालांश दूसरे दिनों पर भी लगाएँ" : "Also use these periods on"}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {otherDays.map((d) => {
                    const on = copyTo.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          setCopyTo((prev) => (on ? prev.filter((x) => x !== d) : [...prev, d]))
                        }
                        className={cn(
                          "rounded-full border px-3 py-1 text-sm transition-colors",
                          on ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground hover:bg-muted",
                        )}
                      >
                        {dayNames[d]}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {isHi
                    ? "चुने गए दिनों के कालांश इस व्यवस्था से बदल जाएँगे।"
                    : "Those days' periods are replaced with this structure."}
                </p>
              </div>
            ) : null}

            {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
          </div>

          <div className="flex justify-end gap-2 border-t border-border p-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              {isHi ? "रद्द करें" : "Cancel"}
            </Button>
            <Button onClick={save} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {isHi ? "सहेजें" : "Save periods"}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
