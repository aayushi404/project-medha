"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Loader2, Lock, Save, Settings2 } from "lucide-react";
import { toast } from "sonner";

import {
  copyPlannerDay,
  createPlannerTimetable,
  getPlannerGrid,
  getPlannerTimetables,
  getPlannerValidation,
  publishPlannerTimetable,
  savePlannerDay,
  type PlannerCell,
  type PlannerGrid,
  type PlannerTimetableListItem,
  type PlannerValidation,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/copy";
import {
  busyInPeriod,
  cellKey,
  cellsFromDraft,
  clearStash,
  dayIsDirty,
  draftFromCells,
  readStash,
  splitKey,
  stashDrafts,
  type DayDraft,
  type TimetableDraft,
} from "@/lib/planner-draft";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CellEditor, type LastPick } from "@/components/principal/planner/cell-editor";
import { PeriodSetupDialog } from "@/components/principal/planner/period-setup-dialog";
import { PlannerGrid as Grid } from "@/components/principal/planner/planner-grid";
import { ValidationPanel } from "@/components/principal/planner/validation-panel";

const TEACHING_DAYS = [1, 2, 3, 4, 5, 6];
const DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_NAMES_HI = ["", "सोमवार", "मंगलवार", "बुधवार", "गुरुवार", "शुक्रवार", "शनिवार", "रविवार"];

type CopyShape = typeof COPY.en;

const COPY = {
  en: {
    timetable: "Timetable",
    day: "Day",
    filled: (n: number, total: number) => `${n} of ${total} slots filled`,
    copyFrom: (day: string) => `Copy from ${day}`,
    copyConfirm: "This day has unsaved changes. Replace them with the saved timetable from the previous day?",
    copyDone: (copied: number, skipped: number) =>
      skipped > 0
        ? `Copied ${copied} periods. ${skipped} had no matching period on this day.`
        : `Copied ${copied} periods.`,
    periods: "Periods",
    saveDay: "Save day",
    saved: "Saved",
    saveFailed: "Could not save this day.",
    daySaved: (day: string) => `${day} saved`,
    readOnly: "This timetable is published, so it's read-only. Start a revision to change it.",
    archived: "This timetable was replaced by a newer one and is read-only.",
    startRevision: "Start a revision",
    revisionName: (name: string) => `${name} (revision)`,
    stale: "Someone changed this timetable in another tab. Reload to see the latest, then make your changes again.",
    reload: "Reload",
    unsavedOn: (days: string) => `Unsaved changes on ${days}. Save each day before publishing.`,
    noTimetableTitle: "No timetable for this year yet",
    noTimetableBody: "Create a draft, then fill in the periods and classes day by day.",
    createTimetable: "Create timetable",
    defaultName: "Main timetable",
    noPeriodsTitle: (day: string) => `No periods set up for ${day}`,
    noPeriodsBody: "Set the periods for this day first. Then you can place subjects and teachers.",
    setPeriods: "Set up periods",
    publish: "Publish timetable",
    publishTitle: "Publish this timetable?",
    publishBody: "It becomes the timetable in force for this year and the one before it is archived. Warnings from the checks are not blockers.",
    publishConfirm: "Publish",
    cancel: "Cancel",
    published: "Timetable published.",
    checkFirst: "Save every changed day before publishing.",
    loading: "Loading timetable…",
    loadFailed: "Could not load the timetable.",
    loadingDay: "Loading…",
    status: { draft: "Draft", published: "Published", archived: "Archived" } as Record<string, string>,
    readOnlyCell: "Read-only",
  },
  hi: {
    timetable: "समय-सारणी",
    day: "दिन",
    filled: (n: number, total: number) => `${total} में से ${n} कालांश भरे गए`,
    copyFrom: (day: string) => `${day} से कॉपी करें`,
    copyConfirm: "इस दिन के बिना सहेजे बदलाव हैं। क्या उन्हें पिछले दिन की सहेजी समय-सारणी से बदलें?",
    copyDone: (copied: number, skipped: number) =>
      skipped > 0
        ? `${copied} कालांश कॉपी हुए। ${skipped} के लिए इस दिन कोई मेल खाता कालांश नहीं था।`
        : `${copied} कालांश कॉपी हुए।`,
    periods: "कालांश",
    saveDay: "दिन सहेजें",
    saved: "सहेजा गया",
    saveFailed: "यह दिन सहेजा नहीं जा सका।",
    daySaved: (day: string) => `${day} सहेजा गया`,
    readOnly: "यह समय-सारणी प्रकाशित है, इसलिए केवल पढ़ने के लिए है। बदलने के लिए संशोधन शुरू करें।",
    archived: "यह समय-सारणी नई से बदल दी गई है और केवल पढ़ने के लिए है।",
    startRevision: "संशोधन शुरू करें",
    revisionName: (name: string) => `${name} (संशोधन)`,
    stale: "किसी ने दूसरे टैब में यह समय-सारणी बदली है। नवीनतम देखने के लिए पुनः लोड करें, फिर बदलाव दोबारा करें।",
    reload: "पुनः लोड करें",
    unsavedOn: (days: string) => `${days} पर बिना सहेजे बदलाव हैं। प्रकाशित करने से पहले हर दिन सहेजें।`,
    noTimetableTitle: "इस वर्ष के लिए अभी कोई समय-सारणी नहीं है",
    noTimetableBody: "एक ड्राफ्ट बनाएँ, फिर दिन-दर-दिन कालांश और कक्षाएँ भरें।",
    createTimetable: "समय-सारणी बनाएँ",
    defaultName: "मुख्य समय-सारणी",
    noPeriodsTitle: (day: string) => `${day} के लिए कालांश तय नहीं हैं`,
    noPeriodsBody: "पहले इस दिन के कालांश तय करें। फिर विषय और शिक्षक लगा सकते हैं।",
    setPeriods: "कालांश तय करें",
    publish: "समय-सारणी प्रकाशित करें",
    publishTitle: "यह समय-सारणी प्रकाशित करें?",
    publishBody: "यह इस वर्ष की लागू समय-सारणी बन जाएगी, और पिछली समय-सारणी संग्रहीत हो जाएगी। जाँच की चेतावनियाँ रोक नहीं हैं।",
    publishConfirm: "प्रकाशित करें",
    cancel: "रद्द करें",
    published: "समय-सारणी प्रकाशित हुई।",
    checkFirst: "प्रकाशित करने से पहले बदले हुए हर दिन को सहेजें।",
    loading: "समय-सारणी लोड हो रही है…",
    loadFailed: "समय-सारणी लोड नहीं हो सकी।",
    loadingDay: "लोड हो रहा है…",
    status: { draft: "ड्राफ्ट", published: "प्रकाशित", archived: "संग्रहीत" } as Record<string, string>,
    readOnlyCell: "केवल पढ़ने के लिए",
  },
};

const LOAD_FAILED = "Could not load the timetable.";

function errorText(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

/** The principal's weekly planner: a grid of periods by class sections for one
 * day, with a cell editor for subject and teacher. The server is the authority:
 * every save is re-checked and carries the version it was loaded at. */
export function TimetablePlanner() {
  const { accessToken: token } = useAuth();
  const { locale } = useLocale();
  const isHi = locale === "hi";
  const t = isHi ? COPY.hi : COPY.en;
  const dayNames = isHi ? DAY_NAMES_HI : DAY_NAMES;

  const [timetables, setTimetables] = useState<PlannerTimetableListItem[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [day, setDay] = useState(1);
  const [reloads, setReloads] = useState(0);

  const [grid, setGrid] = useState<PlannerGrid | null>(null);
  const [gridKey, setGridKey] = useState<string | null>(null);
  const [gridError, setGridError] = useState<string | null>(null);
  /** the server's cells for each day, to tell unsaved drafts from saved ones */
  const [saved, setSaved] = useState<Record<number, PlannerCell[]>>({});
  const [drafts, setDrafts] = useState<TimetableDraft>({});
  const [selected, setSelected] = useState<{ sectionId: string; slotId: string } | null>(null);
  const [lastPick, setLastPick] = useState<LastPick | null>(null);
  const [stale, setStale] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [periodsOpen, setPeriodsOpen] = useState(false);
  const [validation, setValidation] = useState<{ timetableId: string; data: PlannerValidation } | null>(null);
  const [checking, setChecking] = useState(false);

  // --- loading ---

  useEffect(() => {
    let cancelled = false;
    getPlannerTimetables(token)
      .then((list) => {
        if (cancelled) return;
        setTimetables(list);
        setSelectedId((prev) => {
          if (prev && list.some((x) => x.id === prev)) return prev;
          return list.find((x) => x.status === "draft")?.id ?? list[0]?.id ?? null;
        });
      })
      .catch((err) => {
        if (!cancelled) setListError(errorText(err, LOAD_FAILED));
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    const key = `${selectedId}:${day}`;
    getPlannerGrid(token, selectedId, day)
      .then((g) => {
        if (cancelled) return;
        setGrid(g);
        setGridKey(key);
        setGridError(null);
        setSaved((prev) => ({ ...prev, [g.day_of_week]: g.cells }));
        setDrafts((prev) => {
          // keep unsaved work for this day from earlier in the session
          if (prev[g.day_of_week]) return prev;
          const stash = readStash(selectedId);
          const restored =
            stash && stash.version === g.version ? stash.days[String(g.day_of_week)] : undefined;
          return { ...prev, [g.day_of_week]: restored ?? draftFromCells(g.cells) };
        });
        setSelected(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setGridKey(key);
        setGridError(errorText(err, LOAD_FAILED));
      });
    return () => {
      cancelled = true;
    };
  }, [token, selectedId, day, reloads]);

  // --- derived state ---

  const dirtyDays = useMemo(
    () =>
      TEACHING_DAYS.filter((d) => drafts[d] !== undefined && dayIsDirty(drafts[d], saved[d] ?? [])),
    [drafts, saved],
  );

  // Mirror unsaved work to localStorage, so a refresh doesn't lose it.
  useEffect(() => {
    if (!selectedId || !grid) return;
    if (dirtyDays.length === 0) {
      clearStash(selectedId);
      return;
    }
    const only: TimetableDraft = {};
    for (const d of dirtyDays) only[d] = drafts[d];
    stashDrafts(selectedId, grid.version, only);
  }, [drafts, dirtyDays, selectedId, grid]);

  // Warn before leaving with unsaved changes.
  const hasUnsaved = dirtyDays.length > 0;
  useEffect(() => {
    if (!hasUnsaved) return;
    function warn(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsaved]);

  const timetable = timetables?.find((x) => x.id === selectedId) ?? null;
  const editable = grid?.editable ?? false;
  const loading = !!selectedId && gridKey !== `${selectedId}:${day}`;
  const currentDraft: DayDraft = drafts[day] ?? {};
  const currentDirty = dirtyDays.includes(day);

  const sectionsById = useMemo(
    () => new Map((grid?.class_sections ?? []).map((s) => [s.id, s])),
    [grid],
  );
  const subjectNameById = useMemo(
    () => new Map((grid?.subjects ?? []).map((s) => [s.id, s.name])),
    [grid],
  );
  const slotsById = useMemo(
    () => new Map((grid?.period_slots ?? []).map((s) => [s.id, s])),
    [grid],
  );
  const teacherNames = useMemo(() => {
    const names = new Map<string, string>();
    if (!grid) return names;
    for (const c of grid.cells) {
      if (c.teacher_id && c.teacher_name) names.set(c.teacher_id, c.teacher_name);
    }
    for (const list of Object.values(grid.eligible_teachers)) {
      for (const tch of list) names.set(tch.teacher_id, tch.name);
    }
    return names;
  }, [grid]);

  const teachingSlotIds = new Set(
    (grid?.period_slots ?? []).filter((s) => !s.is_break).map((s) => s.id),
  );
  const totalSlots = teachingSlotIds.size * (grid?.class_sections.length ?? 0);
  const filledCount = Object.keys(currentDraft).filter((k) =>
    teachingSlotIds.has(splitKey(k).slotId),
  ).length;

  const sel = selected;
  const selKey = sel ? cellKey(sel.sectionId, sel.slotId) : null;
  const selCell = selKey ? currentDraft[selKey] : undefined;
  const selSection = sel ? sectionsById.get(sel.sectionId) : undefined;
  const selSlot = sel ? slotsById.get(sel.slotId) : undefined;
  const eligible =
    sel && selCell ? grid?.eligible_teachers[`${sel.sectionId}:${selCell.subject_id}`] ?? [] : [];
  const busy = sel ? busyInPeriod(currentDraft, sel.slotId, sel.sectionId) : new Map<string, string>();

  const canPublish =
    !!grid && editable && !currentDirty && dirtyDays.length === 0 && !stale && !publishing;

  // --- actions ---

  function confirmLeave(): boolean {
    if (!hasUnsaved) return true;
    return window.confirm(
      isHi
        ? "बिना सहेजे बदलाव छूट जाएँगे। क्या आप जारी रखना चाहते हैं?"
        : "You have unsaved changes that will be lost. Continue?",
    );
  }

  function chooseTimetable(id: string) {
    if (id === selectedId) return;
    if (!confirmLeave()) return;
    setDrafts({});
    setSaved({});
    setSelected(null);
    setStale(false);
    setValidation(null);
    setSelectedId(id);
  }

  function patchDay(next: DayDraft) {
    setDrafts((prev) => ({ ...prev, [day]: next }));
  }

  function pickSubject(subjectId: string) {
    if (!sel || !editable) return;
    const cur = currentDraft[cellKey(sel.sectionId, sel.slotId)];
    patchDay({
      ...currentDraft,
      [cellKey(sel.sectionId, sel.slotId)]: {
        subject_id: subjectId,
        // a teacher belongs to one subject; keep theirs only if the subject is unchanged
        teacher_id: cur && cur.subject_id === subjectId ? cur.teacher_id : null,
      },
    });
  }

  function pickTeacher(teacherId: string | null) {
    if (!sel || !editable || !selCell) return;
    patchDay({
      ...currentDraft,
      [cellKey(sel.sectionId, sel.slotId)]: { ...selCell, teacher_id: teacherId },
    });
    if (teacherId) setLastPick({ subject_id: selCell.subject_id, teacher_id: teacherId });
  }

  function useLast(pick: LastPick) {
    if (!sel || !editable) return;
    patchDay({
      ...currentDraft,
      [cellKey(sel.sectionId, sel.slotId)]: { subject_id: pick.subject_id, teacher_id: pick.teacher_id },
    });
  }

  function clearPeriod() {
    if (!sel || !editable) return;
    const next = { ...currentDraft };
    delete next[cellKey(sel.sectionId, sel.slotId)];
    patchDay(next);
    setSelected(null);
  }

  async function saveDay() {
    if (!grid || !selectedId || !editable) return;
    setSaving(true);
    try {
      const res = await savePlannerDay(token, selectedId, day, {
        version: grid.version,
        cells: cellsFromDraft(currentDraft),
      });
      setGrid(res);
      setSaved((prev) => ({ ...prev, [day]: res.cells }));
      setDrafts((prev) => ({ ...prev, [day]: draftFromCells(res.cells) }));
      setSelected(null);
      toast.success(t.daySaved(dayNames[day]));
    } catch (err) {
      const message = errorText(err, t.saveFailed);
      if (message.includes("another tab")) setStale(true);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function copyFromPrevious() {
    if (!grid || !selectedId || !editable || day <= 1) return;
    if (currentDirty && !window.confirm(t.copyConfirm)) return;
    setCopying(true);
    try {
      const res = await copyPlannerDay(token, selectedId, day, day - 1, grid.version);
      setGrid(res.grid);
      setSaved((prev) => ({ ...prev, [day]: res.grid.cells }));
      setDrafts((prev) => ({ ...prev, [day]: draftFromCells(res.grid.cells) }));
      setSelected(null);
      toast.success(t.copyDone(res.copied, res.skipped));
    } catch (err) {
      const message = errorText(err, t.saveFailed);
      if (message.includes("another tab")) setStale(true);
      toast.error(message);
    } finally {
      setCopying(false);
    }
  }

  async function refreshList() {
    setTimetables(await getPlannerTimetables(token));
  }

  async function createTimetable(name: string, copyFromId?: string) {
    setCreating(true);
    try {
      const created = await createPlannerTimetable(token, { name, copy_from_id: copyFromId ?? null });
      await refreshList();
      setDrafts({});
      setSaved({});
      setSelected(null);
      setStale(false);
      setValidation(null);
      setSelectedId(created.id);
    } catch (err) {
      toast.error(errorText(err, t.saveFailed));
    } finally {
      setCreating(false);
    }
  }

  async function publish() {
    if (!grid || !selectedId || !canPublish) return;
    setPublishing(true);
    try {
      await publishPlannerTimetable(token, selectedId, grid.version);
      clearStash(selectedId);
      setDrafts({});
      setSaved({});
      setSelected(null);
      await refreshList();
      setReloads((n) => n + 1);
      toast.success(t.published);
    } catch (err) {
      const message = errorText(err, t.saveFailed);
      if (message.includes("another tab")) setStale(true);
      toast.error(message);
    } finally {
      setPublishing(false);
    }
  }

  async function runChecks() {
    if (!selectedId) return;
    setChecking(true);
    try {
      const data = await getPlannerValidation(token, selectedId);
      setValidation({ timetableId: selectedId, data });
    } catch (err) {
      toast.error(errorText(err, LOAD_FAILED));
    } finally {
      setChecking(false);
    }
  }

  function reloadLatest() {
    if (selectedId) clearStash(selectedId);
    setDrafts({});
    setSaved({});
    setSelected(null);
    setStale(false);
    setReloads((n) => n + 1);
  }

  // --- render ---

  if (listError) {
    return <p className="rounded-xl border border-border bg-card p-5 text-sm text-destructive">{listError}</p>;
  }
  if (timetables === null) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        {t.loading}
      </div>
    );
  }
  if (timetables.length === 0) {
    return (
      <NoTimetable
        t={t}
        creating={creating}
        defaultName={t.defaultName}
        onCreate={(name) => createTimetable(name)}
      />
    );
  }

  const prevDayName = day > 1 ? dayNames[day - 1] : "";

  return (
    <div className="space-y-4">
      {/* toolbar, as in the design: day, progress, copy, save */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
        <select
          aria-label={t.timetable}
          value={selectedId ?? ""}
          onChange={(e) => chooseTimetable(e.target.value)}
          className="h-9 min-w-[12rem] rounded-lg border border-border bg-background px-3 text-sm"
        >
          {timetables.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name} · {t.status[x.status] ?? x.status}
            </option>
          ))}
        </select>

        <select
          aria-label={t.day}
          value={day}
          onChange={(e) => setDay(Number(e.target.value))}
          className="h-9 rounded-lg border border-border bg-background px-3 text-sm"
        >
          {TEACHING_DAYS.map((d) => (
            <option key={d} value={d}>
              {dayNames[d]}
            </option>
          ))}
        </select>

        {grid && grid.period_slots.length > 0 ? (
          <span className="text-sm text-muted-foreground">{t.filled(filledCount, totalSlots)}</span>
        ) : null}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {editable && day > 1 ? (
            <Button variant="outline" size="sm" onClick={copyFromPrevious} disabled={copying || loading}>
              {copying ? <Loader2 className="size-4 animate-spin" /> : <Copy className="size-4" />}
              {t.copyFrom(prevDayName)}
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => setPeriodsOpen(true)} disabled={!grid}>
            <Settings2 className="size-4" />
            {t.periods}
          </Button>
          <Button size="sm" onClick={saveDay} disabled={!editable || !currentDirty || saving || loading}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {currentDirty || !editable ? t.saveDay : t.saved}
          </Button>
        </div>
      </div>

      {stale ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <span>{t.stale}</span>
          <Button variant="outline" size="sm" onClick={reloadLatest}>
            {t.reload}
          </Button>
        </div>
      ) : null}

      {grid && !editable ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 p-3 text-sm">
          <span className="flex items-center gap-2">
            <Lock className="size-4" />
            {grid.status === "archived" ? t.archived : t.readOnly}
          </span>
          {grid.status === "published" && timetable ? (
            <Button
              size="sm"
              variant="outline"
              disabled={creating}
              onClick={() => createTimetable(t.revisionName(timetable.name), timetable.id)}
            >
              {creating ? <Loader2 className="size-4 animate-spin" /> : null}
              {t.startRevision}
            </Button>
          ) : null}
        </div>
      ) : null}

      {dirtyDays.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {t.unsavedOn(dirtyDays.map((d) => dayNames[d]).join(", "))}
        </p>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t.loadingDay}
        </div>
      ) : gridError ? (
        <p className="rounded-xl border border-border bg-card p-5 text-sm text-destructive">{gridError}</p>
      ) : grid && grid.period_slots.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center">
          <p className="font-medium text-foreground">{t.noPeriodsTitle(dayNames[day])}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t.noPeriodsBody}</p>
          <Button className="mt-4" size="sm" onClick={() => setPeriodsOpen(true)}>
            {t.setPeriods}
          </Button>
        </div>
      ) : grid ? (
        <>
          <Grid
            slots={grid.period_slots}
            sections={grid.class_sections}
            subjects={grid.subjects}
            teacherNames={teacherNames}
            draft={currentDraft}
            selected={sel}
            editable={editable}
            isHi={isHi}
            onSelect={(sectionId, slotId) => setSelected({ sectionId, slotId })}
          />

          {sel && editable && selSection && selSlot ? (
            <CellEditor
              title={`${selSection.label} — ${selSlot.label ?? `P${selSlot.period_number}`}`}
              sectionLabel={selSection.label}
              timeLabel={
                selSlot.starts_at && selSlot.ends_at
                  ? `${selSlot.starts_at.slice(0, 5)}–${selSlot.ends_at.slice(0, 5)}`
                  : null
              }
              subjects={grid.subjects}
              subjectId={selCell?.subject_id ?? null}
              teacherId={selCell?.teacher_id ?? null}
              eligible={eligible}
              busy={busy}
              sectionLabelOf={(id) => sectionsById.get(id)?.label ?? ""}
              hasCell={selCell !== undefined}
              lastPick={lastPick}
              subjectNameOf={(id) => subjectNameById.get(id) ?? ""}
              teacherNameOf={(id) => teacherNames.get(id) ?? ""}
              isHi={isHi}
              onPickSubject={pickSubject}
              onPickTeacher={pickTeacher}
              onUseLast={useLast}
              onClearPeriod={clearPeriod}
              onClose={() => setSelected(null)}
            />
          ) : null}
        </>
      ) : null}

      {editable && grid ? (
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <ValidationPanel
              result={validation?.timetableId === selectedId ? validation.data : null}
              loading={checking}
              isHi={isHi}
              onCheck={runChecks}
            />
          </div>
          <ConfirmDialog
            trigger={
              // a span styled as the button: ConfirmDialog's trigger is already a <button>
              <span
                aria-disabled={!canPublish}
                className={cn(
                  buttonVariants(),
                  "mt-1",
                  !canPublish && "pointer-events-none opacity-50",
                )}
              >
                {publishing ? <Loader2 className="size-4 animate-spin" /> : null}
                {t.publish}
              </span>
            }
            title={t.publishTitle}
            description={currentDirty || dirtyDays.length > 0 ? t.checkFirst : t.publishBody}
            confirmLabel={t.publishConfirm}
            cancelLabel={t.cancel}
            destructive={false}
            onConfirm={publish}
          />
        </div>
      ) : null}

      {periodsOpen && grid ? (
        <PeriodSetupDialog
          token={token}
          day={day}
          slots={grid.period_slots}
          isHi={isHi}
          onOpenChange={setPeriodsOpen}
          onSaved={() => setReloads((n) => n + 1)}
        />
      ) : null}
    </div>
  );
}

function NoTimetable({
  t,
  creating,
  defaultName,
  onCreate,
}: {
  t: CopyShape;
  creating: boolean;
  defaultName: string;
  onCreate: (name: string) => void;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
      <p className="font-serif text-lg font-semibold text-foreground">{t.noTimetableTitle}</p>
      <p className="mt-1 text-sm text-muted-foreground">{t.noTimetableBody}</p>
      <Button className="mt-5" disabled={creating} onClick={() => onCreate(defaultName)}>
        {creating ? <Loader2 className="size-4 animate-spin" /> : null}
        {t.createTimetable}
      </Button>
    </div>
  );
}
