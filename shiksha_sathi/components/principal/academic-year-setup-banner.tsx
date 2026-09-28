"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { createAcademicYear, type AcademicYear } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/copy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Shown above the Classes directory when the school has no current
 * academic year -- nothing else in the Classes UI is usable until one
 * exists (sections are created under "the current year"). */
export function AcademicYearSetupBanner({
  onCreated,
}: {
  onCreated: (year: AcademicYear) => void;
}) {
  const { accessToken } = useAuth();
  const { locale } = useLocale();
  const isHi = locale === "hi";

  const [open, setOpen] = useState(false);
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
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create academic year.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-terracotta/30 bg-terracotta/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">
            {isHi ? "अपना शैक्षणिक सत्र सेट करें" : "Set up your school year"}
          </p>
          <p className="text-xs text-muted-foreground">
            {isHi
              ? "कक्षाएँ और नामांकन शुरू करने से पहले एक चालू शैक्षणिक सत्र आवश्यक है।"
              : "Classes and student registration need a current academic year before they'll work."}
          </p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)} className="shrink-0">
          {isHi ? "सत्र बनाएं" : "Create academic year"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-terracotta/30 bg-terracotta/5 p-4">
      <p className="text-sm font-medium text-foreground">
        {isHi ? "नया शैक्षणिक सत्र" : "New academic year"}
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ay-label">{isHi ? "लेबल" : "Label"}</Label>
          <Input
            id="ay-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="2026-27"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ay-start">{isHi ? "प्रारंभ" : "Starts"}</Label>
          <Input id="ay-start" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ay-end">{isHi ? "समाप्ति" : "Ends"}</Label>
          <Input id="ay-end" type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => void submit()}
          disabled={saving || !label.trim() || !startsOn || !endsOn}
        >
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : isHi ? "बनाएं" : "Create"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
          {isHi ? "रद्द करें" : "Cancel"}
        </Button>
      </div>
    </div>
  );
}
