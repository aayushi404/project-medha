/**
 * Draft state for the principal's timetable planner. A draft holds the cells
 * the principal has changed for one timetable, across all days, before they
 * are saved day by day. It is mirrored to localStorage so an accidental refresh
 * or a dropped connection doesn't lose the work (plan §5). The server stays the
 * authority: it re-checks every save.
 */
import type { PlannerCell, PlannerCellInput } from "@/lib/api";

export type DraftCell = { subject_id: string; teacher_id: string | null };

/** keyed "<class_section_id>|<period_slot_id>"; a missing key is a free period */
export type DayDraft = Record<string, DraftCell>;

/** keyed by day_of_week (1 = Monday) */
export type TimetableDraft = Record<number, DayDraft>;

const KEY_SEP = "|";

export function cellKey(sectionId: string, slotId: string): string {
  return `${sectionId}${KEY_SEP}${slotId}`;
}

export function splitKey(key: string): { sectionId: string; slotId: string } {
  const [sectionId, slotId] = key.split(KEY_SEP);
  return { sectionId, slotId };
}

export function draftFromCells(cells: PlannerCell[]): DayDraft {
  const draft: DayDraft = {};
  for (const c of cells) {
    draft[cellKey(c.class_section_id, c.period_slot_id)] = {
      subject_id: c.subject_id,
      teacher_id: c.teacher_id,
    };
  }
  return draft;
}

export function cellsFromDraft(draft: DayDraft): PlannerCellInput[] {
  return Object.entries(draft).map(([key, cell]) => {
    const { sectionId, slotId } = splitKey(key);
    return {
      class_section_id: sectionId,
      period_slot_id: slotId,
      subject_id: cell.subject_id,
      teacher_id: cell.teacher_id,
    };
  });
}

/** True when the draft for one day differs from what the server holds. */
export function dayIsDirty(draft: DayDraft, saved: PlannerCell[]): boolean {
  const savedDraft = draftFromCells(saved);
  const keys = new Set([...Object.keys(draft), ...Object.keys(savedDraft)]);
  for (const key of keys) {
    const a = draft[key];
    const b = savedDraft[key];
    if (!a || !b) return true;
    if (a.subject_id !== b.subject_id || a.teacher_id !== b.teacher_id) return true;
  }
  return false;
}

/** Teachers placed in a period by any section other than `exceptKey`'s
 * section, mapped to that section's id. Used to grey out busy teachers. */
export function busyInPeriod(
  draft: DayDraft,
  slotId: string,
  exceptSectionId: string | null,
): Map<string, string> {
  const busy = new Map<string, string>();
  for (const [key, cell] of Object.entries(draft)) {
    const { sectionId, slotId: cellSlot } = splitKey(key);
    if (cellSlot !== slotId || sectionId === exceptSectionId) continue;
    if (cell.teacher_id) busy.set(cell.teacher_id, sectionId);
  }
  return busy;
}

const STASH_PREFIX = "medha.planner.drafts.";

type Stash = { version: number; days: Record<string, DayDraft> };

/** Keep unsaved work across a refresh. Storage can be blocked or full, so every
 * access is guarded and a failure just means no restore. */
export function stashDrafts(timetableId: string, version: number, drafts: TimetableDraft): void {
  try {
    const days: Record<string, DayDraft> = {};
    for (const [day, draft] of Object.entries(drafts)) {
      if (Object.keys(draft).length > 0) days[day] = draft;
    }
    const payload: Stash = { version, days };
    window.localStorage.setItem(STASH_PREFIX + timetableId, JSON.stringify(payload));
  } catch {
    // no restore on a later visit; the screen still works
  }
}

export function readStash(timetableId: string): Stash | null {
  try {
    const raw = window.localStorage.getItem(STASH_PREFIX + timetableId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stash;
    if (typeof parsed.version !== "number" || typeof parsed.days !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearStash(timetableId: string): void {
  try {
    window.localStorage.removeItem(STASH_PREFIX + timetableId);
  } catch {
    // nothing stored, nothing to clear
  }
}
