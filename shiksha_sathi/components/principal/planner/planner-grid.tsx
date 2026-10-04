"use client";

import { useRef, type KeyboardEvent } from "react";

import type { PlannerPeriodSlot, PlannerSection, PlannerSubject } from "@/lib/api";
import { cellKey, type DayDraft } from "@/lib/planner-draft";
import { cn } from "@/lib/utils";

export function formatTime(t: string | null): string {
  return t ? t.slice(0, 5) : "";
}

export function timeRange(slot: PlannerPeriodSlot): string | null {
  if (!slot.starts_at || !slot.ends_at) return null;
  return `${formatTime(slot.starts_at)}–${formatTime(slot.ends_at)}`;
}

/** Periods as rows, class sections as columns, so a teacher clash (same
 * teacher, same period, different column) is visible on one screen. Breaks
 * render as a full-width band and hold no cells. */
export function PlannerGrid({
  slots,
  sections,
  subjects,
  teacherNames,
  draft,
  selected,
  editable,
  isHi,
  onSelect,
}: {
  slots: PlannerPeriodSlot[];
  sections: PlannerSection[];
  subjects: PlannerSubject[];
  teacherNames: Map<string, string>;
  draft: DayDraft;
  selected: { sectionId: string; slotId: string } | null;
  editable: boolean;
  isHi: boolean;
  onSelect: (sectionId: string, slotId: string) => void;
}) {
  const subjectName = new Map(subjects.map((s) => [s.id, s.name]));
  const wrapper = useRef<HTMLDivElement>(null);

  // Arrow keys move between cells, the way a spreadsheet does. Enter and Space
  // come from the button itself.
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    const row = Number(target.dataset.row);
    const col = Number(target.dataset.col);
    if (Number.isNaN(row) || Number.isNaN(col)) return;
    const delta: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    const step = delta[e.key];
    if (!step) return;
    e.preventDefault();
    const next = wrapper.current?.querySelector<HTMLElement>(
      `[data-row="${row + step[0]}"][data-col="${col + step[1]}"]`,
    );
    next?.focus();
  }

  // Row indexes count only teaching periods, so the arrow keys skip breaks.
  let teachingRow = 0;

  return (
    <div
      ref={wrapper}
      onKeyDown={onKeyDown}
      className="overflow-x-auto rounded-xl border border-border bg-card"
    >
      <div
        role="grid"
        aria-label={isHi ? "समय-सारणी ग्रिड" : "Timetable grid"}
        className="grid min-w-max"
        style={{
          gridTemplateColumns: `76px repeat(${sections.length}, minmax(156px, 1fr))`,
        }}
      >
        <div className="sticky left-0 z-10 border-b border-r border-border bg-card" />
        {sections.map((sec) => (
          <div
            key={sec.id}
            role="columnheader"
            className="border-b border-border px-3 py-2.5 text-center text-sm font-medium text-muted-foreground"
          >
            {sec.label}
          </div>
        ))}

        {slots.map((slot) => {
          if (slot.is_break) {
            const range = timeRange(slot);
            return (
              <div
                key={slot.id}
                role="row"
                className="col-span-full border-b border-border bg-muted/40 px-3 py-2 text-center text-xs text-muted-foreground"
              >
                {slot.label ?? (isHi ? "विश्राम" : "Break")}
                {range ? ` · ${range}` : ""}
              </div>
            );
          }

          const row = teachingRow++;
          return (
            <div key={slot.id} role="row" className="contents">
              <div className="sticky left-0 z-10 flex flex-col justify-center border-b border-r border-border bg-card px-3 py-2">
                <span className="text-sm font-medium text-foreground">
                  {slot.label ?? `P${slot.period_number}`}
                </span>
                {timeRange(slot) ? (
                  <span className="text-[11px] text-muted-foreground">{timeRange(slot)}</span>
                ) : null}
              </div>

              {sections.map((sec, col) => {
                const cell = draft[cellKey(sec.id, slot.id)];
                const isSelected =
                  selected?.sectionId === sec.id && selected?.slotId === slot.id;
                const teacher = cell?.teacher_id
                  ? teacherNames.get(cell.teacher_id) ?? null
                  : null;

                return (
                  <div key={sec.id} role="gridcell" className="border-b border-border p-1.5">
                    <button
                      type="button"
                      data-row={row}
                      data-col={col}
                      disabled={!editable}
                      onClick={() => onSelect(sec.id, slot.id)}
                      aria-pressed={isSelected}
                      aria-label={
                        cell
                          ? `${sec.label} ${slot.label ?? ""}: ${subjectName.get(cell.subject_id) ?? ""}${teacher ? `, ${teacher}` : ""}`
                          : `${sec.label} ${slot.label ?? ""}: ${isHi ? "खाली" : "empty"}`
                      }
                      className={cn(
                        "flex h-[72px] w-full flex-col items-start justify-center overflow-hidden rounded-lg px-3 text-left transition-colors outline-none",
                        "focus-visible:ring-2 focus-visible:ring-ring",
                        cell
                          ? "bg-muted/60 hover:bg-muted"
                          : "border border-dashed border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                        isSelected && "ring-2 ring-primary",
                        !editable && "cursor-default hover:bg-muted/60",
                      )}
                    >
                      {cell ? (
                        <>
                          <span className="w-full truncate text-sm font-medium text-foreground">
                            {subjectName.get(cell.subject_id) ?? "—"}
                          </span>
                          {cell.teacher_id ? (
                            <span className="w-full truncate text-xs text-muted-foreground">
                              {teacher ?? "—"}
                            </span>
                          ) : (
                            <span className="text-xs text-amber-600 dark:text-amber-400">
                              {isHi ? "शिक्षक नहीं" : "No teacher"}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-xs">{isHi ? "खाली" : "Empty"}</span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
