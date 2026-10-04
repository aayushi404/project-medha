"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

import type { PlannerEligibleTeacher, PlannerSubject } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type LastPick = { subject_id: string; teacher_id: string | null };

/** The editor for one cell: pick the subject, then the teacher. Teachers are
 * grouped by tier (assigned to this class first, then other teachers of the
 * subject). A teacher already in another class in this period is shown greyed
 * out with where they are. The server re-checks every save. */
export function CellEditor({
  title,
  sectionLabel,
  timeLabel,
  subjects,
  subjectId,
  teacherId,
  eligible,
  busy,
  sectionLabelOf,
  hasCell,
  lastPick,
  subjectNameOf,
  teacherNameOf,
  isHi,
  onPickSubject,
  onPickTeacher,
  onUseLast,
  onClearPeriod,
  onClose,
}: {
  title: string;
  /** "9 · A" */
  sectionLabel: string;
  timeLabel: string | null;
  subjects: PlannerSubject[];
  subjectId: string | null;
  teacherId: string | null;
  eligible: PlannerEligibleTeacher[];
  /** teacher id -> section id, for teachers placed in this period elsewhere */
  busy: Map<string, string>;
  sectionLabelOf: (sectionId: string) => string;
  hasCell: boolean;
  lastPick: LastPick | null;
  subjectNameOf: (id: string) => string;
  teacherNameOf: (id: string) => string;
  isHi: boolean;
  onPickSubject: (subjectId: string) => void;
  onPickTeacher: (teacherId: string | null) => void;
  onUseLast: (pick: LastPick) => void;
  onClearPeriod: () => void;
  onClose: () => void;
}) {
  // Escape closes the editor, like the rest of the screen's keyboard flow.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const subjectLabel = subjectId ? subjectNameOf(subjectId) : null;
  const assigned = eligible.filter((t) => t.tier === "assigned");
  const qualified = eligible.filter((t) => t.tier === "qualified");

  return (
    <section
      aria-label={isHi ? "कक्षा संपादक" : "Cell editor"}
      className="rounded-xl border border-border bg-card p-5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-serif text-lg font-semibold text-foreground">{title}</h2>
          {timeLabel ? <p className="text-xs text-muted-foreground">{timeLabel}</p> : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={isHi ? "बंद करें" : "Close"}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="mt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {isHi ? "विषय" : "Subject"}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {subjects.map((s) => {
            const active = s.id === subjectId;
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={active}
                onClick={() => onPickSubject(s.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-foreground hover:bg-muted",
                )}
              >
                {s.name}
              </button>
            );
          })}
        </div>
        {lastPick && lastPick.subject_id !== subjectId ? (
          <button
            type="button"
            onClick={() => onUseLast(lastPick)}
            className="mt-3 text-xs text-primary underline-offset-2 hover:underline"
          >
            {isHi ? "पिछला चुनाव दोहराएँ: " : "Use last choice: "}
            {subjectNameOf(lastPick.subject_id)}
            {lastPick.teacher_id ? ` · ${teacherNameOf(lastPick.teacher_id)}` : ""}
          </button>
        ) : null}
      </div>

      {subjectId ? (
        <div className="mt-5">
          <p className="text-xs text-muted-foreground">
            {isHi ? "शिक्षक — " : "Teacher — "}
            {subjectLabel ? (isHi ? `${subjectLabel} के लिए` : `for ${subjectLabel}`) : ""}
          </p>

          {eligible.length === 0 ? (
            <p className="mt-3 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              {isHi
                ? "इस विषय के लिए इस विद्यालय में अभी कोई शिक्षक नहीं है। विषय सहेजा जा सकता है, शिक्षक बाद में चुनें।"
                : "No teacher of this subject at this school yet. You can save the subject and choose a teacher later."}
            </p>
          ) : (
            <div className="mt-3 space-y-4">
              <TeacherGroup
                heading={isHi ? `${sectionLabel} में नियुक्त` : `Assigned to ${sectionLabel}`}
                teachers={assigned}
                busy={busy}
                teacherId={teacherId}
                sectionLabelOf={sectionLabelOf}
                isHi={isHi}
                onPick={onPickTeacher}
              />
              {qualified.length > 0 ? (
                <TeacherGroup
                  heading={isHi ? "इस विषय के अन्य शिक्षक" : "Other teachers of this subject"}
                  teachers={qualified}
                  busy={busy}
                  teacherId={teacherId}
                  sectionLabelOf={sectionLabelOf}
                  isHi={isHi}
                  onPick={onPickTeacher}
                />
              ) : null}
            </div>
          )}

          {teacherId ? (
            <button
              type="button"
              onClick={() => onPickTeacher(null)}
              className="mt-3 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              {isHi ? "शिक्षक हटाएँ" : "Remove teacher"}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5 flex items-center justify-between gap-2 border-t border-border pt-4">
        {hasCell ? (
          <Button variant="outline" size="sm" onClick={onClearPeriod}>
            {isHi ? "यह कालांश खाली करें" : "Clear this period"}
          </Button>
        ) : (
          <span />
        )}
        <Button size="sm" onClick={onClose}>
          {isHi ? "हो गया" : "Done"}
        </Button>
      </div>
    </section>
  );
}

function TeacherGroup({
  heading,
  teachers,
  busy,
  teacherId,
  sectionLabelOf,
  isHi,
  onPick,
}: {
  heading: string;
  teachers: PlannerEligibleTeacher[];
  busy: Map<string, string>;
  teacherId: string | null;
  sectionLabelOf: (sectionId: string) => string;
  isHi: boolean;
  onPick: (teacherId: string) => void;
}) {
  if (teachers.length === 0) return null;
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-muted-foreground">{heading}</p>
      <ul className="space-y-2">
        {teachers.map((t) => {
          const busyIn = busy.get(t.teacher_id);
          const isBusy = busyIn !== undefined && t.teacher_id !== teacherId;
          const active = t.teacher_id === teacherId;
          return (
            <li key={t.teacher_id}>
              <button
                type="button"
                disabled={isBusy}
                aria-pressed={active}
                onClick={() => onPick(t.teacher_id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                  active
                    ? "border-primary bg-primary/10"
                    : "border-border bg-muted/40 hover:bg-muted",
                  isBusy && "cursor-not-allowed opacity-60 hover:bg-muted/40",
                )}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-medium text-primary">
                  {initials(t.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{t.name}</span>
                </span>
                {isBusy ? (
                  <span className="shrink-0 text-xs text-red-600 dark:text-red-400">
                    {isHi ? "व्यस्त" : "Busy"} — {sectionLabelOf(busyIn)}
                  </span>
                ) : (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {isHi
                      ? `आज ${t.periods_today} कालांश`
                      : `${t.periods_today} ${t.periods_today === 1 ? "period" : "periods"} today`}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
