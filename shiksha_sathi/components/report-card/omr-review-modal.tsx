"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileCheck,
  HelpCircle,
  XCircle,
  Sliders,
  Sparkles,
} from "lucide-react";

import type { OMREvaluationResult, StudentOMRResult, StudentRosterItem } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface OMRReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evaluationResult: OMREvaluationResult | null;
  classRoster: StudentRosterItem[];
  maxMarks: number;
  onApplyMarks: (reviewedMarks: Record<string, { marks_obtained: string; remarks: string }>) => void;
}

export function OMRReviewModal({
  open,
  onOpenChange,
  evaluationResult,
  classRoster,
  maxMarks,
  onApplyMarks,
}: OMRReviewModalProps) {
  const [editedResults, setEditedResults] = useState<Record<number, string>>({});
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  // Initialize override inputs when evaluationResult changes
  useEffect(() => {
    if (!evaluationResult) return;
    const initial: Record<number, string> = {};
    evaluationResult.results.forEach((res) => {
      initial[res.roll_number] = res.detected_marks !== null ? String(res.detected_marks) : "";
    });
    setEditedResults(initial);
  }, [evaluationResult]);

  if (!open || !evaluationResult) return null;

  const handleScoreOverride = (roll: number, val: string) => {
    setEditedResults((prev) => ({
      ...prev,
      [roll]: val,
    }));
  };

  const handleApply = () => {
    const marksToApply: Record<string, { marks_obtained: string; remarks: string }> = {};

    evaluationResult.results.forEach((res) => {
      const valStr = editedResults[res.roll_number] ?? "";
      // Match by student_id or roll number in roster
      const studentMatch = classRoster.find(
        (s) => String(s.roll_number || "").replace(/^0+/, "") === String(res.roll_number) || s.roll_number === String(res.roll_number) || s.id === res.student_id
      );

      const targetId = studentMatch?.id || res.student_id;
      if (targetId && valStr.trim() !== "") {
        marksToApply[targetId] = {
          marks_obtained: valStr.trim(),
          remarks: res.issues.length > 0 ? `OMR: ${res.issues.join("; ")}` : "Evaluated via OMR",
        };
      }
    });

    onApplyMarks(marksToApply);
    onOpenChange(false);
  };

  const summary = evaluationResult.summary;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-background border border-border rounded-2xl shadow-2xl overflow-hidden my-8 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="border-b border-border bg-card px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-terracotta/10 text-terracotta flex items-center justify-center shrink-0">
              <Sparkles className="size-5" />
            </div>
            <div>
              <h2 className="font-serif text-lg font-bold text-foreground">OMR Evaluation Results</h2>
              <p className="text-xs text-muted-foreground">
                Review detected scores before filling the student marks table.
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:text-foreground"
          >
            ✕
          </Button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Summary Badges Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="border border-border/80 bg-card">
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground">Total Rows</p>
                  <p className="font-serif text-xl font-bold text-foreground font-mono mt-0.5">{summary.total_rows}</p>
                </div>
                <FileCheck className="size-5 text-muted-foreground/60" />
              </CardContent>
            </Card>

            <Card className="border border-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/20">
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300">Valid Scores</p>
                  <p className="font-serif text-xl font-bold text-emerald-700 dark:text-emerald-400 font-mono mt-0.5">{summary.valid_count}</p>
                </div>
                <CheckCircle2 className="size-5 text-emerald-600" />
              </CardContent>
            </Card>

            <Card className="border border-amber-200 bg-amber-50/40 dark:bg-amber-950/20">
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-amber-800 dark:text-amber-300">Needs Review</p>
                  <p className="font-serif text-xl font-bold text-amber-700 dark:text-amber-400 font-mono mt-0.5">{summary.needs_review_count}</p>
                </div>
                <AlertTriangle className="size-5 text-amber-600" />
              </CardContent>
            </Card>

            <Card className="border border-slate-200 bg-slate-50/50 dark:bg-slate-900/40">
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-slate-700 dark:text-slate-300">Incomplete</p>
                  <p className="font-serif text-xl font-bold text-slate-700 dark:text-slate-300 font-mono mt-0.5">{summary.missing_count}</p>
                </div>
                <HelpCircle className="size-5 text-slate-500" />
              </CardContent>
            </Card>
          </div>

          {/* Results Table */}
          <div className="border border-border rounded-xl overflow-hidden bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold text-muted-foreground">
                    <th className="py-3 px-4 w-16">Roll</th>
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4 w-32">Digits (100s-10s-1s)</th>
                    <th className="py-3 px-4 w-28">Score</th>
                    <th className="py-3 px-4 w-36">Status</th>
                    <th className="py-3 px-4 w-28 text-right">Confirmed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {evaluationResult.results.map((res) => {
                    const studentMatch = classRoster.find(
                      (s) => String(s.roll_number || "").replace(/^0+/, "") === String(res.roll_number)
                    );

                    const currentVal = editedResults[res.roll_number] ?? "";
                    const isExpanded = expandedRow === res.roll_number;

                    const digitsStr = `${res.hundreds ?? "—"}${res.tens ?? "—"}${res.units ?? "—"}`;

                    return (
                      <React.Fragment key={res.roll_number}>
                        <tr className="hover:bg-muted/20 transition-colors">
                          <td className="py-3 px-4 font-mono text-xs font-semibold text-muted-foreground">
                            {res.roll_number}
                          </td>

                          <td className="py-3 px-4">
                            <span className="font-medium text-foreground">
                              {studentMatch?.full_name || res.student_name || `Student Roll ${res.roll_number}`}
                            </span>
                          </td>

                          <td className="py-3 px-4 font-mono text-xs text-muted-foreground">
                            {digitsStr}
                          </td>

                          <td className="py-3 px-4 font-mono font-semibold text-foreground">
                            {res.detected_marks !== null ? `${res.detected_marks} / ${maxMarks}` : "—"}
                          </td>

                          <td className="py-3 px-4">
                            {res.status === "valid" ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300">
                                <CheckCircle2 className="size-3 text-emerald-600" />
                                Valid
                              </span>
                            ) : res.status === "ambiguous" ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950 dark:text-amber-300">
                                <AlertTriangle className="size-3 text-amber-600" />
                                Review
                              </span>
                            ) : res.status === "invalid_max" ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950 dark:text-rose-300">
                                <XCircle className="size-3 text-rose-600" />
                                Exceeds Max
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
                                Incomplete
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Input
                                type="number"
                                value={currentVal}
                                onChange={(e) => handleScoreOverride(res.roll_number, e.target.value)}
                                placeholder="—"
                                className="w-20 h-8 text-xs font-mono text-center bg-background"
                              />

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setExpandedRow(isExpanded ? null : res.roll_number)}
                                className="h-8 size-8 p-0 text-muted-foreground hover:text-foreground"
                                title="Inspect Digit Breakdown"
                              >
                                {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                              </Button>
                            </div>
                          </td>
                        </tr>

                        {/* Expanded Row Detail Inspector */}
                        {isExpanded && (
                          <tr className="bg-muted/30 border-b border-border">
                            <td colSpan={6} className="p-4">
                              <div className="space-y-3 text-xs">
                                <div className="flex items-center justify-between font-semibold text-muted-foreground">
                                  <span>Digit Breakdown Inspection for Roll {res.roll_number}</span>
                                  <span>Confidence: {(res.confidence * 100).toFixed(0)}%</span>
                                </div>

                                {res.issues.length > 0 && (
                                  <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs dark:bg-amber-950/40 dark:border-amber-900">
                                    ⚠️ {res.issues.join(" ")}
                                  </div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                  {["hundreds", "tens", "units"].map((place) => {
                                    const digitEval = res.digit_evaluations[place as "hundreds" | "tens" | "units"];
                                    if (!digitEval) return null;

                                    return (
                                      <div key={place} className="p-3 bg-background border border-border rounded-lg space-y-1.5">
                                        <div className="flex items-center justify-between font-medium capitalize text-foreground">
                                          <span>{place} Place</span>
                                          <span className="font-mono text-terracotta">
                                            Digit: {digitEval.selected_digit ?? "—"}
                                          </span>
                                        </div>
                                        <div className="text-[11px] text-muted-foreground font-mono">
                                          Status: {digitEval.status}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="border-t border-border bg-card px-6 py-3.5 flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            Clicking apply populates the student marks table where you can review and save.
          </p>

          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="h-9 px-4 text-xs">
              Cancel
            </Button>
            <Button
              onClick={handleApply}
              className="h-9 px-5 text-xs font-semibold bg-terracotta hover:bg-terracotta/90 text-white shadow-xs"
            >
              Apply to Marks Table
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// React import fix helper
import React from "react";
