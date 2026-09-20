"use client";

import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import {
  FileUp,
  Sparkles,
  CheckCircle2,
  FileSpreadsheet,
  AlertCircle,
  X,
  ScanLine,
  CheckLine,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useCopy } from "@/lib/copy";
import { cn } from "@/lib/utils";

interface CreateExamModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grades: { id: string; label: string }[];
  defaultGradeId?: string;
  onExamCreated?: (exam: { id: string; title: string; gradeLabel: string; totalMarks: number }) => void;
}

export function CreateExamModal({
  open,
  onOpenChange,
  grades,
  defaultGradeId,
  onExamCreated,
}: CreateExamModalProps) {
  const copy = useCopy();
  const c = copy.reportCardPage;

  const [examName, setExamName] = useState("");
  const [gradeId, setGradeId] = useState(defaultGradeId || (grades[0]?.id ?? ""));
  const [totalMarks, setTotalMarks] = useState("100");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [scanStep, setScanStep] = useState<"idle" | "scanning" | "done">("idle");
  const [extractedData, setExtractedData] = useState<{
    studentsEvaluated: number;
    avgScore: string;
    accuracy: string;
  } | null>(null);

  const handleFileDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleStartScan = () => {
    if (!examName.trim()) {
      toast.error("Please enter an exam name");
      return;
    }
    if (!gradeId) {
      toast.error("Please select a grade");
      return;
    }
    if (!selectedFile) {
      toast.error("Please upload an OMR answer sheet file");
      return;
    }

    setScanStep("scanning");

    // Simulate AI OMR scanning duration
    setTimeout(() => {
      setScanStep("done");
      setExtractedData({
        studentsEvaluated: 1,
        avgScore: "92 / 100",
        accuracy: "99.4%",
      });
      toast.success(c.omrSuccess);
    }, 2500);
  };

  const handleSubmitFinal = () => {
    const selectedGrade = grades.find((g) => g.id === gradeId)?.label || "Grade";
    onExamCreated?.({
      id: `exam-${Date.now()}`,
      title: examName,
      gradeLabel: selectedGrade,
      totalMarks: Number(totalMarks) || 100,
    });
    toast.success(`Exam "${examName}" created & OMR results saved!`);
    handleReset();
    onOpenChange(false);
  };

  const handleReset = () => {
    setExamName("");
    setSelectedFile(null);
    setScanStep("idle");
    setExtractedData(null);
  };

  return (
    <Dialog.Root open={open} onOpenChange={(val) => { onOpenChange(val); if (!val) handleReset(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup
          className={cn(
            "fixed top-1/2 left-1/2 z-50 w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2",
            "max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-xl outline-none",
            "transition data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0"
          )}
        >
          <div className="flex items-start justify-between mb-4 border-b border-hairline/60 pb-3">
            <div>
              <Dialog.Title className="font-serif text-xl font-semibold text-foreground flex items-center gap-2">
                <Sparkles className="size-5 text-terracotta" />
                {c.createExamTitle}
              </Dialog.Title>
              <p className="text-xs text-muted-foreground mt-1">{c.createExamSub}</p>
            </div>
            <Dialog.Close
              render={
                <button className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                  <X className="size-4" />
                </button>
              }
            />
          </div>

          <div className="space-y-4">
            {/* Exam Name */}
            <div>
              <Label htmlFor="exam-name" className="text-xs font-semibold">
                {c.examNameLabel} *
              </Label>
              <Input
                id="exam-name"
                value={examName}
                onChange={(e) => setExamName(e.target.value)}
                placeholder={c.examNamePlaceholder}
                className="mt-1.5"
                disabled={scanStep === "scanning"}
              />
            </div>

            {/* Grade & Total Marks */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="exam-grade" className="text-xs font-semibold">
                  {c.gradeLabel} *
                </Label>
                <div className="mt-1.5">
                  <Select
                    value={gradeId}
                    onValueChange={(val: string) => setGradeId(val)}
                    options={grades.map((g) => ({ value: g.id, label: g.label }))}
                    placeholder="Select grade"
                    disabled={scanStep === "scanning"}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="total-marks" className="text-xs font-semibold">
                  {c.totalMarksLabel}
                </Label>
                <Input
                  id="total-marks"
                  type="number"
                  value={totalMarks}
                  onChange={(e) => setTotalMarks(e.target.value)}
                  className="mt-1.5 font-mono"
                  disabled={scanStep === "scanning"}
                />
              </div>
            </div>

            {/* OMR File Upload Area */}
            <div>
              <Label className="text-xs font-semibold">{c.omrUploadLabel} *</Label>
              <label
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFileDrop}
                className={cn(
                  "mt-1.5 flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-5 text-center cursor-pointer transition-colors relative overflow-hidden",
                  selectedFile
                    ? "border-emerald-400/80 bg-emerald-50/30 dark:bg-emerald-950/20"
                    : "border-border hover:border-terracotta/60 hover:bg-muted/30"
                )}
              >
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileChange}
                  className="sr-only"
                  disabled={scanStep === "scanning"}
                />

                {/* Animated OMR Scanner Effect when scanning */}
                {scanStep === "scanning" && (
                  <div className="absolute inset-0 bg-black/5 dark:bg-white/5 pointer-events-none flex flex-col justify-between">
                    <div className="h-1 w-full bg-linear-to-r from-terracotta via-amber-400 to-terracotta animate-scan-laser shadow-sm" />
                  </div>
                )}

                {selectedFile ? (
                  <div className="flex flex-col items-center text-center">
                    <FileSpreadsheet className="size-8 text-emerald-600 dark:text-emerald-400 mb-2" />
                    <span className="text-sm font-medium text-foreground truncate max-w-[200px]">
                      {selectedFile.name}
                    </span>
                    <span className="text-xs text-muted-foreground mt-0.5">
                      {(selectedFile.size / 1024).toFixed(1)} KB • Click to change file
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <FileUp className="size-8 text-muted-foreground/70 mb-2" />
                    <span className="text-sm font-medium text-foreground">{c.omrUploadHint}</span>
                    <span className="text-xs text-muted-foreground mt-1">Supports PDF, PNG, JPG, OMR Scan Sheets</span>
                  </div>
                )}
              </label>
            </div>

            {/* Scanning Progress feedback */}
            {scanStep === "scanning" && (
              <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 p-4 text-center">
                <div className="flex items-center justify-center gap-2 text-amber-800 dark:text-amber-200 text-sm font-medium">
                  <ScanLine className="size-4 animate-spin text-terracotta" />
                  {c.processingOmr}
                </div>
                <div className="w-full bg-amber-200 dark:bg-amber-900 h-1.5 rounded-full overflow-hidden mt-3">
                  <div className="bg-terracotta h-full w-2/3 animate-pulse rounded-full" />
                </div>
              </div>
            )}

            {/* Extracted Data Card after scan */}
            {scanStep === "done" && extractedData && (
              <div className="rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 p-4 space-y-2">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200 text-sm font-semibold">
                  <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  {c.omrSuccess}
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-emerald-200/60 dark:border-emerald-900/60 text-center text-xs">
                  <div>
                    <div className="text-muted-foreground">Students</div>
                    <div className="font-semibold text-emerald-900 dark:text-emerald-100 font-mono text-sm mt-0.5">
                      {extractedData.studentsEvaluated}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Scanned Score</div>
                    <div className="font-semibold text-emerald-900 dark:text-emerald-100 font-mono text-sm mt-0.5">
                      {extractedData.avgScore}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">OMR Accuracy</div>
                    <div className="font-semibold text-emerald-900 dark:text-emerald-100 font-mono text-sm mt-0.5">
                      {extractedData.accuracy}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Dialog Action Footer */}
          <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-hairline/60">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={scanStep === "scanning"}
            >
              Cancel
            </Button>

            {scanStep === "idle" && (
              <Button
                onClick={handleStartScan}
                className="bg-terracotta text-white hover:bg-terracotta/90"
              >
                <Sparkles className="size-4 mr-1.5" />
                Process & Evaluate OMR
              </Button>
            )}

            {scanStep === "done" && (
              <Button
                onClick={handleSubmitFinal}
                className="bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700"
              >
                <CheckCircle2 className="size-4 mr-1.5" />
                Save & Update Report Cards
              </Button>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
