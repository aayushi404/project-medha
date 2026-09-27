"use client";

import { useMemo, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { AlertTriangle, Loader2, Search, X } from "lucide-react";

import type { TeacherRosterItem } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { ProfileImage } from "@/components/ui/profile-image";

const UNASSIGN = "__unassign__";

/** The one assignment UI for both "who is the class teacher" and "who teaches
 * this subject" -- a right-side drawer on desktop, a bottom sheet on mobile
 * (same base-ui Dialog primitive used everywhere else in the app, just
 * positioned differently; no new library). `teachers` is whatever the caller
 * already fetched (getPrincipalTeachers) -- this never fetches on its own. */
export function TeacherAssignmentDrawer({
  open,
  onOpenChange,
  title,
  subtitle,
  teachers,
  currentTeacherId,
  currentSectionId,
  mode,
  allowUnassign = true,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle: string;
  teachers: TeacherRosterItem[];
  currentTeacherId: string | null;
  currentSectionId: string;
  mode: "class_teacher" | "subject";
  allowUnassign?: boolean;
  onPick: (teacherId: string | null) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter((t) => t.full_name.toLowerCase().includes(q));
  }, [teachers, query]);

  async function pick(teacherId: string | null) {
    setBusyId(teacherId ?? UNASSIGN);
    try {
      await onPick(teacherId);
      onOpenChange(false);
    } catch {
      // The parent already toasts the error -- leave the drawer open so the
      // principal can retry without re-navigating, per "don't leave the UI
      // pretending it succeeded."
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
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col overflow-hidden rounded-t-2xl bg-card shadow-xl transition-transform duration-200",
            "data-starting-style:translate-y-full data-ending-style:translate-y-full",
            "sm:inset-x-auto sm:inset-y-0 sm:right-0 sm:bottom-auto sm:h-full sm:max-h-screen sm:w-[420px] sm:rounded-t-none sm:rounded-l-2xl",
            "sm:data-starting-style:translate-x-full sm:data-ending-style:translate-x-full sm:data-starting-style:translate-y-0 sm:data-ending-style:translate-y-0",
          )}
        >
          <div className="flex items-start justify-between gap-2 border-b border-border p-4">
            <div className="min-w-0">
              <Dialog.Title className="text-sm font-semibold text-foreground">{title}</Dialog.Title>
              <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="border-b border-border p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search teachers…"
                className="pl-8"
                autoFocus
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {allowUnassign && currentTeacherId && (
              <button
                type="button"
                onClick={() => void pick(null)}
                disabled={busyId !== null}
                className="flex w-full items-center gap-2 border-b border-border px-4 py-3 text-left text-sm text-destructive transition-colors hover:bg-destructive/5 disabled:opacity-50"
              >
                {busyId === UNASSIGN ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <X className="size-4" />
                )}
                Unassign
              </button>
            )}

            {filtered.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                No teachers match your search.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {filtered.map((t) => {
                  const isCurrent = t.id === currentTeacherId;
                  const warn =
                    mode === "class_teacher" &&
                    !!t.class_teacher_of_section_id &&
                    t.class_teacher_of_section_id !== currentSectionId;
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => void pick(t.id)}
                        disabled={busyId !== null || isCurrent}
                        className={cn(
                          "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 disabled:cursor-default disabled:opacity-60",
                          isCurrent && "bg-terracotta/5",
                        )}
                      >
                        <ProfileImage url={t.photo_url} name={t.full_name} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-medium text-foreground">
                              {t.full_name}
                            </span>
                            {isCurrent && (
                              <span className="shrink-0 rounded-full bg-terracotta/15 px-1.5 py-0.2 text-[10px] font-semibold text-terracotta">
                                Current
                              </span>
                            )}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {t.primary_subject_name ?? "No subject set"} · {t.classes_count}{" "}
                            {t.classes_count === 1 ? "class" : "classes"}
                          </div>
                          {warn && (
                            <div className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                              <AlertTriangle className="size-3 shrink-0" />
                              Currently class teacher of {t.class_teacher_of_label}
                            </div>
                          )}
                        </div>
                        {busyId === t.id && (
                          <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                        )}
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
