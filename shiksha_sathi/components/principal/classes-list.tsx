"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import {
  createAcademicYear,
  createClassSection,
  getAcademicYears,
  getClassSections,
  getGrades,
  type AcademicYear,
  type ClassSectionSummary,
  type Grade,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/copy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { AcademicYearSetupBanner } from "@/components/principal/academic-year-setup-banner";

function NewYearDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (year: AcademicYear) => void;
}) {
  const { accessToken } = useAuth();
  const { locale } = useLocale();
  const isHi = locale === "hi";

  const [label, setLabel] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!label.trim() || !startsOn || !endsOn) return;
    setSaving(true);
    try {
      const year = await createAcademicYear(accessToken, {
        label: label.trim(),
        starts_on: startsOn,
        ends_on: endsOn,
        set_current: true,
      });
      toast.success(isHi ? "शैक्षणिक सत्र बन गया।" : "Academic year created.");
      onCreated(year);
      onOpenChange(false);
      setLabel("");
      setStartsOn("");
      setEndsOn("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create academic year.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-card p-5 shadow-xl ring-1 ring-foreground/10">
          <Dialog.Title className="text-sm font-semibold text-foreground">
            {isHi ? "नया शैक्षणिक सत्र" : "New academic year"}
          </Dialog.Title>
          <div className="mt-3 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ny-label">{isHi ? "लेबल" : "Label"}</Label>
              <Input id="ny-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="2027-28" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ny-start">{isHi ? "प्रारंभ" : "Starts"}</Label>
                <Input id="ny-start" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ny-end">{isHi ? "समाप्ति" : "Ends"}</Label>
                <Input id="ny-end" type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              {isHi ? "रद्द करें" : "Cancel"}
            </Button>
            <Button size="sm" onClick={() => void submit()} disabled={saving || !label.trim() || !startsOn || !endsOn}>
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : isHi ? "बनाएं" : "Create"}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** The Classes landing page: pick an academic year, browse its sections,
 * add a new one. Lives at /principal/classes; each card opens
 * /principal/classes/[id]. */
export function ClassesList() {
  const { accessToken } = useAuth();
  const { locale } = useLocale();
  const isHi = locale === "hi";
  const router = useRouter();

  const [years, setYears] = useState<AcademicYear[] | null>(null);
  const [selectedYearId, setSelectedYearId] = useState<string | null>(null);
  const [sections, setSections] = useState<ClassSectionSummary[] | null>(null);
  const [grades, setGrades] = useState<Grade[]>([]);

  const [addOpen, setAddOpen] = useState(false);
  const [newGradeId, setNewGradeId] = useState<string | null>(null);
  const [newSection, setNewSection] = useState("A");
  const [addingSection, setAddingSection] = useState(false);
  const [newYearOpen, setNewYearOpen] = useState(false);

  function loadYears(selectAfter?: string) {
    if (!accessToken) return;
    getAcademicYears(accessToken)
      .then((rows) => {
        setYears(rows);
        if (selectAfter) {
          setSelectedYearId(selectAfter);
        } else if (!selectedYearId) {
          setSelectedYearId(rows.find((y) => y.is_current)?.id ?? rows[0]?.id ?? null);
        }
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not load academic years."));
  }

  useEffect(() => {
    if (!accessToken) return;
    loadYears();
    getGrades().then(setGrades).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken || !selectedYearId) return;
    let active = true;
    getClassSections(accessToken, selectedYearId)
      .then((rows) => active && setSections(rows))
      .catch((e: unknown) => {
        if (active) toast.error(e instanceof Error ? e.message : "Could not load classes.");
      });
    return () => {
      active = false;
    };
  }, [accessToken, selectedYearId]);

  async function addSection() {
    if (!newGradeId || !newSection.trim() || !selectedYearId) return;
    setAddingSection(true);
    try {
      await createClassSection(accessToken, {
        grade_id: newGradeId,
        section: newSection.trim(),
        academic_year_id: selectedYearId,
      });
      toast.success(isHi ? "कक्षा जोड़ी गई।" : "Class added.");
      setAddOpen(false);
      setNewGradeId(null);
      setNewSection("A");
      getClassSections(accessToken, selectedYearId).then(setSections).catch(() => {});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add class.");
    } finally {
      setAddingSection(false);
    }
  }

  if (years === null) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (years.length === 0) {
    return (
      <AcademicYearSetupBanner
        onCreated={(year) => {
          setYears([year]);
          setSelectedYearId(year.id);
        }}
      />
    );
  }

  const selectedYear = years.find((y) => y.id === selectedYearId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {isHi ? "शैक्षणिक सत्र" : "Academic year"}
          </span>
          <Select
            ariaLabel={isHi ? "शैक्षणिक सत्र" : "Academic year"}
            value={selectedYearId}
            options={years.map((y) => ({
              value: y.id,
              label: y.is_current ? `${y.label} (${isHi ? "चालू" : "current"})` : y.label,
            }))}
            onValueChange={setSelectedYearId}
            className="h-9 w-48"
          />
          <Button size="sm" variant="outline" onClick={() => setNewYearOpen(true)}>
            <Plus className="size-3.5" /> {isHi ? "नया सत्र" : "New year"}
          </Button>
        </div>

        {selectedYearId && (
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="size-3.5" /> {isHi ? "कक्षा जोड़ें" : "Add class"}
          </Button>
        )}
      </div>

      {addOpen && selectedYearId && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">{isHi ? "कक्षा" : "Grade"}</span>
            <Select
              ariaLabel={isHi ? "कक्षा" : "Grade"}
              placeholder={isHi ? "चुनें" : "Select"}
              value={newGradeId}
              options={grades.map((g) => ({ value: g.id, label: g.label }))}
              onValueChange={setNewGradeId}
              className="h-9 w-40"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">{isHi ? "सेक्शन" : "Section"}</span>
            <input
              value={newSection}
              onChange={(e) => setNewSection(e.target.value.toUpperCase().slice(0, 5))}
              className="h-9 w-16 rounded-lg border border-border bg-background px-2 text-sm"
            />
          </div>
          <Button size="sm" onClick={() => void addSection()} disabled={addingSection || !newGradeId || !newSection.trim()}>
            {addingSection ? <Loader2 className="size-3.5 animate-spin" /> : isHi ? "जोड़ें" : "Add"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setAddOpen(false)} disabled={addingSection}>
            {isHi ? "रद्द करें" : "Cancel"}
          </Button>
        </div>
      )}

      {sections === null ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : sections.length === 0 ? (
        <p className="rounded-xl bg-card p-8 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
          {isHi
            ? `${selectedYear?.label ?? ""} में अभी कोई कक्षा नहीं है। "कक्षा जोड़ें" से शुरू करें।`
            : `No classes set up yet for ${selectedYear?.label ?? "this year"}. Start with "Add class".`}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => router.push(`/principal/classes/${s.id}`)}
              className="rounded-xl bg-card p-4 text-left ring-1 ring-foreground/10 transition-colors hover:ring-terracotta/40"
            >
              <div className="text-sm font-medium text-foreground">
                {s.grade_label} · {s.section}
              </div>
              <div className="mt-1.5 text-xs text-muted-foreground">
                {s.student_count} {isHi ? "छात्र" : s.student_count === 1 ? "student" : "students"}
              </div>
              {s.class_teacher_name && (
                <div className="mt-1 truncate text-xs text-muted-foreground">{s.class_teacher_name}</div>
              )}
            </button>
          ))}
        </div>
      )}

      <NewYearDialog
        open={newYearOpen}
        onOpenChange={setNewYearOpen}
        onCreated={(year) => loadYears(year.id)}
      />
    </div>
  );
}
