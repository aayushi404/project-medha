"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Edit3, PlusCircle, X, Check, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCopy } from "@/lib/copy";
import { cn } from "@/lib/utils";
import type { ReportCardMark } from "@/lib/api";

interface EditMarkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMark?: ReportCardMark | null;
  defaultTerm?: string;
  onSaveMark: (markData: {
    subject_id?: string;
    subject_name: string;
    term: string;
    marks_obtained: number;
    max_marks: number;
    remarks: string;
  }) => void;
}

const COMMON_SUBJECTS = [
  "Mathematics",
  "Science & Technology",
  "English Literature",
  "Hindi",
  "Social Studies",
  "Computer Science",
  "Sanskrit",
];

export function EditMarkModal({
  open,
  onOpenChange,
  initialMark,
  defaultTerm,
  onSaveMark,
}: EditMarkModalProps) {
  const copy = useCopy();
  const t = copy.reportCardPage;

  const [subjectName, setSubjectName] = useState("");
  const [term, setTerm] = useState("Mid-Term Examination 2026");
  const [marksObtained, setMarksObtained] = useState("");
  const [maxMarks, setMaxMarks] = useState("100");
  const [remarks, setRemarks] = useState("");

  const isEditing = Boolean(initialMark);

  useEffect(() => {
    if (initialMark) {
      setSubjectName(initialMark.subject_name || "");
      setTerm(initialMark.term || defaultTerm || "Mid-Term Examination 2026");
      setMarksObtained(initialMark.marks_obtained?.toString() || "");
      setMaxMarks(initialMark.max_marks?.toString() || "100");
      setRemarks(initialMark.remarks || "");
    } else {
      setSubjectName("");
      setTerm(defaultTerm || "Mid-Term Examination 2026");
      setMarksObtained("");
      setMaxMarks("100");
      setRemarks("");
    }
  }, [initialMark, defaultTerm, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectName.trim()) return;
    if (!term.trim()) return;
    if (marksObtained === "") return;

    onSaveMark({
      subject_id: initialMark?.subject_id || `subj-${Date.now()}`,
      subject_name: subjectName.trim(),
      term: term.trim(),
      marks_obtained: Number(marksObtained) || 0,
      max_marks: Number(maxMarks) || 100,
      remarks: remarks.trim(),
    });

    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup
          className={cn(
            "fixed top-1/2 left-1/2 z-50 w-[min(34rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2",
            "max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-xl outline-none",
            "transition data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0"
          )}
        >
          <div className="flex items-center justify-between pb-3 border-b border-hairline/60">
            <Dialog.Title className="font-serif text-lg font-bold text-foreground flex items-center gap-2">
              {isEditing ? (
                <>
                  <Edit3 className="size-5 text-terracotta" />
                  {t.editMarkTitle}
                </>
              ) : (
                <>
                  <PlusCircle className="size-5 text-terracotta" />
                  {t.addMarkTitle}
                </>
              )}
            </Dialog.Title>
            <Dialog.Close
              render={
                <button className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                  <X className="size-4" />
                </button>
              }
            />
          </div>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {/* Examination Name / Term */}
            <div>
              <Label htmlFor="exam-term" className="text-xs font-semibold">
                {t.examNameLabel} / {t.termLabel} *
              </Label>
              <Input
                id="exam-term"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="e.g. Mid-Term Examination 2026, Unit Test 1"
                className="mt-1.5"
                required
              />
            </div>

            {/* Subject Name */}
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="subject-name" className="text-xs font-semibold">
                  {t.subjectLabel} *
                </Label>
                <span className="text-[11px] text-muted-foreground">Select preset or type custom</span>
              </div>
              <Input
                id="subject-name"
                value={subjectName}
                onChange={(e) => setSubjectName(e.target.value)}
                placeholder="e.g. Mathematics, Science & Technology"
                className="mt-1.5"
                required
              />

              {/* Subject Chips */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {COMMON_SUBJECTS.map((subj) => (
                  <button
                    key={subj}
                    type="button"
                    onClick={() => setSubjectName(subj)}
                    className={cn(
                      "px-2 py-0.5 text-xs rounded-md border transition-colors cursor-pointer",
                      subjectName === subj
                        ? "bg-terracotta text-white border-terracotta"
                        : "bg-muted/50 border-hairline/80 text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    + {subj}
                  </button>
                ))}
              </div>
            </div>

            {/* Marks & Max Marks */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="marks-obtained" className="text-xs font-semibold">
                  {t.marksLabel} *
                </Label>
                <Input
                  id="marks-obtained"
                  type="number"
                  min="0"
                  max={maxMarks}
                  value={marksObtained}
                  onChange={(e) => setMarksObtained(e.target.value)}
                  placeholder="e.g. 85"
                  className="mt-1.5 font-mono"
                  required
                />
              </div>

              <div>
                <Label htmlFor="max-marks" className="text-xs font-semibold">
                  {t.maxMarksLabel}
                </Label>
                <Input
                  id="max-marks"
                  type="number"
                  min="1"
                  value={maxMarks}
                  onChange={(e) => setMaxMarks(e.target.value)}
                  placeholder="100"
                  className="mt-1.5 font-mono"
                />
              </div>
            </div>

            {/* Teacher Remarks */}
            <div>
              <Label htmlFor="remarks" className="text-xs font-semibold">
                {t.remarksLabel}
              </Label>
              <Input
                id="remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="e.g. Excellent conceptual understanding."
                className="mt-1.5"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-hairline/60">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t.cancelBtn}
              </Button>
              <Button type="submit" className="bg-terracotta text-white hover:bg-terracotta/90">
                <Check className="size-4 mr-1.5" />
                {isEditing ? t.saveChangesBtn : t.addEntryBtn}
              </Button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
