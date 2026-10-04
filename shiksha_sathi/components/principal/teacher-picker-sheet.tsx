"use client";

import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Loader2, Search, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { ProfileImage } from "@/components/ui/profile-image";

export type PickerOption = {
  id: string;
  name: string;
  photoUrl: string | null;
  /** the line under the name, e.g. "Science, English" */
  detail: string;
  /** an extra warning, e.g. "Class teacher of 10 · B" */
  note?: string | null;
};

/** One picker for both class teacher and subject teacher: a list of teachers
 * to choose from, plus Unassign. A right-side panel on desktop, a bottom sheet
 * on mobile. The caller decides who is listed; this only shows and picks. */
export function TeacherPickerSheet({
  open,
  onOpenChange,
  title,
  subtitle,
  options,
  currentId,
  emptyText,
  unassignLabel,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle: string;
  options: PickerOption[];
  currentId: string | null;
  emptyText: string;
  unassignLabel: string | null;
  onPick: (teacherId: string | null) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options;

  async function pick(teacherId: string | null) {
    setBusyId(teacherId ?? "__unassign__");
    try {
      await onPick(teacherId);
      onOpenChange(false);
    } catch {
      // the caller has already shown the error; keep the panel open to retry
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[80vh] flex-col overflow-hidden rounded-t-2xl bg-card shadow-xl transition-transform duration-200",
            "data-starting-style:translate-y-full data-ending-style:translate-y-full",
            "sm:inset-x-auto sm:inset-y-0 sm:right-0 sm:bottom-auto sm:h-full sm:max-h-screen sm:w-[400px] sm:rounded-t-none sm:rounded-l-2xl",
            "sm:data-starting-style:translate-x-full sm:data-ending-style:translate-x-full sm:data-starting-style:translate-y-0 sm:data-ending-style:translate-y-0",
          )}
        >
          <div className="flex items-start justify-between gap-2 border-b border-border p-4">
            <div className="min-w-0">
              <Dialog.Title className="text-sm font-semibold text-foreground">{title}</Dialog.Title>
              <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
            </div>
            <Dialog.Close
              aria-label="Close"
              className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </Dialog.Close>
          </div>

          {options.length > 6 ? (
            <div className="border-b border-border p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search teachers…"
                  className="pl-8"
                />
              </div>
            </div>
          ) : null}

          <div className="flex-1 overflow-y-auto">
            {unassignLabel && currentId ? (
              <button
                type="button"
                onClick={() => void pick(null)}
                disabled={busyId !== null}
                className="flex w-full items-center gap-2 border-b border-border px-4 py-3 text-left text-sm text-destructive transition-colors hover:bg-destructive/5 disabled:opacity-50"
              >
                {busyId === "__unassign__" ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
                {unassignLabel}
              </button>
            ) : null}

            {filtered.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                {options.length === 0 ? emptyText : "No teachers match your search."}
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {filtered.map((o) => {
                  const isCurrent = o.id === currentId;
                  return (
                    <li key={o.id}>
                      <button
                        type="button"
                        onClick={() => void pick(o.id)}
                        disabled={busyId !== null || isCurrent}
                        className={cn(
                          "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 disabled:cursor-default",
                          isCurrent && "bg-primary/5",
                        )}
                      >
                        <ProfileImage url={o.photoUrl} name={o.name} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-medium text-foreground">{o.name}</span>
                            {isCurrent ? (
                              <span className="shrink-0 rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold text-primary">
                                Current
                              </span>
                            ) : null}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">{o.detail}</div>
                          {o.note ? (
                            <div className="mt-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                              {o.note}
                            </div>
                          ) : null}
                        </div>
                        {busyId === o.id ? (
                          <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
