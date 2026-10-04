"use client";

import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Loader2, Search, X } from "lucide-react";

import type { CoverCandidate, CoverCandidates, CoverCell, CoverUnavailable } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProfileImage } from "@/components/ui/profile-image";

/** Pick who covers one period. Candidates come grouped by tier, the fairest
 * first, and everyone who can't cover shows the reason beside their name. */
export function AssignCoverSheet({
  open,
  onOpenChange,
  cell,
  title,
  subtitle,
  candidates,
  isHi,
  busy,
  onAssign,
  onSelfStudy,
  onCancel,
  onClear,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cell: CoverCell;
  title: string;
  subtitle: string;
  candidates: CoverCandidates | null;
  isHi: boolean;
  busy: boolean;
  onAssign: (teacherId: string) => Promise<void>;
  onSelfStudy: () => Promise<void>;
  onCancel: () => Promise<void>;
  onClear: () => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const q = query.trim().toLowerCase();
  const match = (name: string) => !q || name.toLowerCase().includes(q);

  const avail = (candidates?.available ?? []).filter((c) => match(c.name));
  const groups = {
    reserve: avail.filter((c) => c.tier === 1),
    subject: avail.filter((c) => c.tier === 2),
    free: avail.filter((c) => c.tier === 3),
    unavailable: (candidates?.unavailable ?? []).filter((u) => match(u.name)),
  };

  const subjectName = cell.subject_name;
  const resolved = cell.state !== "needs_cover" && cell.state !== "normal";

  async function assign(teacherId: string) {
    setPendingId(teacherId);
    try {
      await onAssign(teacherId);
    } catch {
      // the caller shows the error; stay open to retry
    } finally {
      setPendingId(null);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Popup
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[88vh] flex-col overflow-hidden rounded-t-2xl bg-card shadow-xl",
            "sm:inset-x-auto sm:inset-y-0 sm:right-0 sm:bottom-auto sm:h-full sm:max-h-screen sm:w-[440px] sm:rounded-t-none sm:rounded-l-2xl",
          )}
        >
          <div className="border-b border-border p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Dialog.Title className="text-base font-semibold text-foreground">{title}</Dialog.Title>
                <Dialog.Description className="mt-0.5 text-xs text-muted-foreground">{subtitle}</Dialog.Description>
              </div>
              <Dialog.Close aria-label={isHi ? "बंद करें" : "Close"} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                <X className="size-4" />
              </Dialog.Close>
            </div>
            {cell.original_teacher_name && cell.state === "needs_cover" ? (
              <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                {cell.original_teacher_name} {isHi ? "आज अनुपस्थित है" : "is absent today"}
              </p>
            ) : null}
            {resolved && cell.substitute ? (
              <p className="mt-3 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
                {cell.state === "covered"
                  ? `${cell.substitute.substitute_teacher_name ?? ""} ${isHi ? "कवर कर रहे हैं" : "is covering"}`
                  : cell.state === "self_study"
                    ? isHi ? "स्व-अध्ययन के रूप में चिह्नित" : "Marked as self-study"
                    : isHi ? "रद्द" : "Cancelled"}
              </p>
            ) : null}
          </div>

          <div className="border-b border-border p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={isHi ? "शिक्षक खोजें…" : "Search teachers…"} className="pl-8" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {candidates === null ? (
              <div className="flex justify-center py-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <Group heading={isHi ? "आरक्षित शिक्षक" : "Reserve teachers"} hint={isHi ? "इस कक्षा के लिए" : "For this class"} count={groups.reserve.length}>
                  {groups.reserve.map((c) => (
                    <CandidateRow key={c.teacher_id} candidate={c} detail={isHi ? "इस कक्षा के लिए आरक्षित" : "Reserve for this class"} pending={pendingId === c.teacher_id} disabled={busy} onPick={() => assign(c.teacher_id)} isHi={isHi} />
                  ))}
                </Group>
                <Group heading={`${isHi ? "पढ़ाते हैं" : "Teaches"} ${subjectName} · ${isHi ? "अभी खाली" : "free now"}`} count={groups.subject.length}>
                  {groups.subject.map((c) => (
                    <CandidateRow key={c.teacher_id} candidate={c} detail={`${isHi ? "पढ़ाते हैं" : "Teaches"} ${subjectName} · ${isHi ? "खाली" : "free this period"}`} pending={pendingId === c.teacher_id} disabled={busy} onPick={() => assign(c.teacher_id)} isHi={isHi} />
                  ))}
                </Group>
                <Group heading={isHi ? "खाली · केवल निगरानी" : "Free · supervision only"} count={groups.free.length}>
                  {groups.free.map((c) => (
                    <CandidateRow
                      key={c.teacher_id}
                      candidate={c}
                      detail={`${c.subjects.length ? c.subjects.join(", ") : isHi ? "कोई विषय नहीं" : "No subjects"} · ${isHi ? `${subjectName} नहीं पढ़ाते` : `doesn't teach ${subjectName}`}`}
                      pending={pendingId === c.teacher_id}
                      disabled={busy}
                      onPick={() => assign(c.teacher_id)}
                      isHi={isHi}
                    />
                  ))}
                </Group>
                {groups.unavailable.length > 0 ? (
                  <Group heading={isHi ? "उपलब्ध नहीं" : "Unavailable"} count={groups.unavailable.length}>
                    {groups.unavailable.map((u) => (
                      <UnavailableRow key={u.teacher_id} item={u} />
                    ))}
                  </Group>
                ) : null}
                {cell.state === "needs_cover" && groups.reserve.length + groups.subject.length + groups.free.length === 0 ? (
                  <p className="p-4 text-center text-sm text-muted-foreground">
                    {isHi ? "इस अवधि के लिए कोई खाली शिक्षक नहीं है।" : "Nobody is free for this period."}
                  </p>
                ) : null}
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border p-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={onSelfStudy} disabled={busy}>
                {isHi ? "स्व-अध्ययन चिह्नित करें" : "Mark as self-study"}
              </Button>
              <Button variant="outline" size="sm" onClick={onCancel} disabled={busy}>
                {isHi ? "कालांश रद्द करें" : "Cancel period"}
              </Button>
            </div>
            {cell.state === "covered" || cell.state === "self_study" || cell.state === "cancelled" ? (
              <Button variant="ghost" size="sm" onClick={onClear} disabled={busy} className="text-destructive">
                {isHi ? "कवर हटाएँ" : "Clear cover"}
              </Button>
            ) : null}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Group({
  heading,
  hint,
  count,
  children,
}: {
  heading: string;
  hint?: string;
  count: number;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div className="mb-4">
      <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">
        {heading}
        {hint ? <span className="font-normal"> · {hint}</span> : null}
      </p>
      <ul className="space-y-2">{children}</ul>
    </div>
  );
}

function CandidateRow({
  candidate,
  detail,
  pending,
  disabled,
  onPick,
  isHi,
}: {
  candidate: CoverCandidate;
  detail: string;
  pending: boolean;
  disabled: boolean;
  onPick: () => void;
  isHi: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        disabled={disabled || pending}
        className="flex w-full items-center gap-3 rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-left transition-colors hover:bg-muted disabled:opacity-60"
      >
        <ProfileImage url={candidate.photo_url} name={candidate.name} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">{candidate.name}</span>
          <span className="block truncate text-xs text-emerald-700 dark:text-emerald-400">{detail}</span>
        </span>
        <span className="shrink-0 text-right text-xs text-muted-foreground">
          {isHi ? `आज ${candidate.periods_today} कालांश` : `${candidate.periods_today} ${candidate.periods_today === 1 ? "period" : "periods"} today`}
          {candidate.covers_today > 0 ? (isHi ? ` · ${candidate.covers_today} कवर` : ` · covering ${candidate.covers_today}`) : ""}
        </span>
        {pending ? <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" /> : null}
      </button>
    </li>
  );
}

function UnavailableRow({ item }: { item: CoverUnavailable }) {
  return (
    <li className="flex items-center gap-3 px-3 py-2 opacity-60">
      <ProfileImage url={item.photo_url} name={item.name} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-muted-foreground">{item.name}</span>
        <span className="block truncate text-xs text-red-600 dark:text-red-400">{item.reason}</span>
      </span>
    </li>
  );
}
