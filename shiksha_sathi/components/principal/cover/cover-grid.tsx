"use client";

import { useRef, type KeyboardEvent } from "react";

import type { CoverCell, PlannerPeriodSlot, PlannerSection } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatTime } from "@/components/principal/planner/planner-grid";

/** The day's board: periods down, class sections across. Each cell is one of
 * the states from the plan: red needs cover, green covered, amber self-study or
 * cancelled, and plain for everything else. A resolved cell is never red. */
export function CoverGrid({
  slots,
  sections,
  cells,
  selectedKey,
  isHi,
  onOpen,
}: {
  slots: PlannerPeriodSlot[];
  sections: PlannerSection[];
  cells: CoverCell[];
  selectedKey: string | null;
  isHi: boolean;
  onOpen: (cell: CoverCell) => void;
}) {
  const wrapper = useRef<HTMLDivElement>(null);
  const byKey = new Map(cells.map((c) => [`${c.class_section_id}|${c.period_slot_id}`, c]));

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
    wrapper.current
      ?.querySelector<HTMLElement>(`[data-row="${row + step[0]}"][data-col="${col + step[1]}"]`)
      ?.focus();
  }

  let teachingRow = 0;

  return (
    <div ref={wrapper} onKeyDown={onKeyDown} className="overflow-x-auto rounded-xl border border-border bg-card">
      <div
        role="grid"
        aria-label={isHi ? "आज की कवर योजना" : "Today's cover board"}
        className="grid min-w-max"
        style={{ gridTemplateColumns: `76px repeat(${sections.length}, minmax(164px, 1fr))` }}
      >
        <div className="sticky left-0 z-10 border-b border-r border-border bg-card" />
        {sections.map((sec) => (
          <div key={sec.id} role="columnheader" className="border-b border-border px-3 py-2.5 text-center text-sm font-medium text-muted-foreground">
            {sec.label}
          </div>
        ))}

        {slots.map((slot) => {
          if (slot.is_break) {
            const range = slot.starts_at && slot.ends_at ? ` · ${formatTime(slot.starts_at)}–${formatTime(slot.ends_at)}` : "";
            return (
              <div key={slot.id} role="row" className="col-span-full border-b border-border bg-muted/40 px-3 py-2 text-center text-xs text-muted-foreground">
                {slot.label ?? (isHi ? "विश्राम" : "Break")}
                {range}
              </div>
            );
          }
          const row = teachingRow++;
          return (
            <div key={slot.id} role="row" className="contents">
              <div className="sticky left-0 z-10 flex flex-col justify-center border-b border-r border-border bg-card px-3 py-2">
                <span className="text-sm font-medium text-foreground">{slot.label ?? `P${slot.period_number}`}</span>
                {slot.starts_at && slot.ends_at ? (
                  <span className="text-[11px] text-muted-foreground">
                    {formatTime(slot.starts_at)}–{formatTime(slot.ends_at)}
                  </span>
                ) : null}
              </div>
              {sections.map((sec, col) => {
                const cell = byKey.get(`${sec.id}|${slot.id}`);
                const key = `${sec.id}|${slot.id}`;
                const selected = selectedKey === key;
                return (
                  <div key={sec.id} role="gridcell" className="border-b border-border p-1.5">
                    {cell ? (
                      <CellButton
                        cell={cell}
                        row={row}
                        col={col}
                        selected={selected}
                        isHi={isHi}
                        onOpen={() => onOpen(cell)}
                      />
                    ) : (
                      <div className="flex h-[76px] items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
                        {isHi ? "खाली" : "Free"}
                      </div>
                    )}
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

function CellButton({
  cell,
  row,
  col,
  selected,
  isHi,
  onOpen,
}: {
  cell: CoverCell;
  row: number;
  col: number;
  selected: boolean;
  isHi: boolean;
  onOpen: () => void;
}) {
  const tone = {
    normal: "border-border bg-muted/50",
    needs_cover: "border-red-500/50 bg-red-500/10",
    covered: "border-emerald-500/50 bg-emerald-500/10",
    self_study: "border-amber-500/50 bg-amber-500/10",
    cancelled: "border-border border-dashed bg-muted/30",
  }[cell.state];
  const interactive = cell.state !== "normal";

  return (
    <button
      type="button"
      data-row={row}
      data-col={col}
      disabled={!interactive}
      onClick={onOpen}
      aria-pressed={selected}
      className={cn(
        "flex h-[76px] w-full flex-col items-start justify-center overflow-hidden rounded-lg border px-3 text-left outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-ring",
        tone,
        interactive && "cursor-pointer hover:brightness-95 dark:hover:brightness-110",
        !interactive && "cursor-default",
        selected && "ring-2 ring-primary",
      )}
    >
      <span
        className={cn(
          "w-full truncate text-sm font-medium",
          cell.state === "needs_cover" ? "text-red-700 dark:text-red-300" : "text-foreground",
        )}
      >
        {cell.subject_name}
      </span>
      <CellLine cell={cell} isHi={isHi} />
    </button>
  );
}

function CellLine({ cell, isHi }: { cell: CoverCell; isHi: boolean }) {
  switch (cell.state) {
    case "needs_cover":
      return (
        <span className="w-full truncate text-xs text-red-700 dark:text-red-300">
          {isHi ? "अनुपस्थित: " : "Absent: "}
          {cell.original_teacher_name}
        </span>
      );
    case "covered":
      return (
        <span className="w-full truncate text-xs text-emerald-700 dark:text-emerald-300">
          {cell.substitute?.substitute_teacher_name} · {isHi ? "कवर" : "cover"}
        </span>
      );
    case "self_study":
      return <span className="w-full truncate text-xs text-amber-700 dark:text-amber-300">{isHi ? "स्व-अध्ययन" : "Self-study"}</span>;
    case "cancelled":
      return <span className="w-full truncate text-xs text-muted-foreground">{isHi ? "रद्द" : "Cancelled"}</span>;
    default:
      return <span className="w-full truncate text-xs text-muted-foreground">{cell.original_teacher_name ?? "—"}</span>;
  }
}
