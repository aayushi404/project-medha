"use client";

import type { ReportCard, ReportCardMark } from "@/lib/api";
import { useCopy } from "@/lib/copy";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Award, BookOpen, Printer, Edit2, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/alert-dialog";

interface ReportCardViewProps {
  card: ReportCard | null;
  studentName?: string;
  gradeLabel?: string;
  rollNumber?: string;
  onEditMark?: (mark: ReportCardMark) => void;
  onDeleteMark?: (mark: ReportCardMark) => void;
  onAddSubjectToExam?: (term: string) => void;
}

function calculateGrade(percentage: number) {
  if (percentage >= 90) return { letter: "A+", label: "Outstanding", color: "text-emerald-700 bg-emerald-100 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200" };
  if (percentage >= 80) return { letter: "A", label: "Excellent", color: "text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300" };
  if (percentage >= 70) return { letter: "B+", label: "Very Good", color: "text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-950 dark:text-blue-300" };
  if (percentage >= 60) return { letter: "B", label: "Good", color: "text-blue-600 bg-blue-50/70 border-blue-200 dark:bg-blue-950/60 dark:text-blue-400" };
  if (percentage >= 50) return { letter: "C", label: "Satisfactory", color: "text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950 dark:text-amber-300" };
  return { letter: "D", label: "Needs Improvement", color: "text-rose-700 bg-rose-50 border-rose-200 dark:bg-rose-950 dark:text-rose-300" };
}

export function ReportCardView({
  card,
  studentName,
  gradeLabel,
  rollNumber,
  onEditMark,
  onDeleteMark,
  onAddSubjectToExam,
}: ReportCardViewProps) {
  const copy = useCopy();
  const t = copy.reportCardPage;

  if (!card || card.marks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed p-10 text-center text-muted-foreground bg-muted/20">
        <BookOpen className="size-10 text-muted-foreground/60 mb-2" />
        <p className="text-sm font-medium text-foreground">{t.empty}</p>
      </div>
    );
  }

  // Calculate totals across all marks
  let totalObtained = 0;
  let totalMax = 0;
  for (const m of card.marks) {
    totalObtained += m.marks_obtained;
    totalMax += m.max_marks;
  }
  const overallPercentage = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;
  const overallGrade = calculateGrade(overallPercentage);

  // Group marks by term / exam
  const byTerm = new Map<string, ReportCardMark[]>();
  for (const m of card.marks) {
    byTerm.set(m.term, [...(byTerm.get(m.term) ?? []), m]);
  }

  const handlePrint = () => {
    document.body.classList.add("printing");
    window.print();
    document.body.classList.remove("printing");
  };

  return (
    <div className="space-y-6 print-region">
      {/* Overview Metric Banner */}
      <Card className="border border-border shadow-xs bg-linear-to-br from-card via-card to-parchment/30 dark:to-card">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-terracotta">
                <Award className="size-4" />
                {t.officialSummary}
              </div>
              <h3 className="font-serif text-2xl font-bold text-foreground mt-1">
                {studentName || card.student_name || t.studentReport}
              </h3>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-1 font-mono">
                {gradeLabel && <span>{t.gradeLabel}: {gradeLabel}</span>}
                {rollNumber && (
                  <>
                    <span>•</span>
                    <span>{t.rollNo}: {rollNumber}</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4 self-stretch md:self-auto justify-between md:justify-end border-t md:border-t-0 md:border-l border-hairline/80 pt-3 md:pt-0 md:pl-6">
              <div className="text-right">
                <div className="text-xs text-muted-foreground">{t.cumulativeScore}</div>
                <div className="font-serif text-2xl font-bold text-foreground font-mono">
                  {totalObtained} <span className="text-sm font-normal text-muted-foreground">/ {totalMax}</span>
                </div>
              </div>

              <div className="text-center px-4 py-2 rounded-xl border bg-background/80 shadow-xs">
                <div className="text-xs font-medium text-muted-foreground">{t.overallGrade}</div>
                <div className={`mt-0.5 px-3 py-0.5 rounded-md font-mono text-base font-bold border ${overallGrade.color}`}>
                  {overallGrade.letter} ({overallPercentage.toFixed(1)}%)
                </div>
              </div>

              <Button
                variant="outline"
                size="icon"
                onClick={handlePrint}
                className="print:hidden hidden sm:flex shrink-0 text-muted-foreground hover:text-foreground"
                title="Print Report Card"
              >
                <Printer className="size-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Terms Breakdown */}
      {Array.from(byTerm.entries()).map(([term, marks]) => {
        let termObtained = 0;
        let termMax = 0;
        marks.forEach((m) => {
          termObtained += m.marks_obtained;
          termMax += m.max_marks;
        });
        const termPercentage = termMax > 0 ? (termObtained / termMax) * 100 : 0;
        const termGrade = calculateGrade(termPercentage);

        return (
          <Card key={term} className="border border-border overflow-hidden">
            <CardHeader className="bg-muted/40 border-b border-border py-3 px-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <CardTitle className="font-serif text-base font-semibold flex items-center gap-2">
                  <BookOpen className="size-4 text-terracotta" />
                  {t.term}: {term}
                </CardTitle>

                {onAddSubjectToExam && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onAddSubjectToExam(term)}
                    className="h-7 text-xs gap-1 border-terracotta/30 text-terracotta hover:bg-terracotta/10 print:hidden"
                  >
                    <Plus className="size-3" />
                    {t.addSubjectToExam}
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs">
                <span className="font-mono text-muted-foreground">
                  {t.termTotal}: <strong className="text-foreground">{termObtained}/{termMax}</strong>
                </span>
                <span className={`px-2 py-0.5 rounded font-mono font-semibold border ${termGrade.color}`}>
                  {termGrade.letter} ({termPercentage.toFixed(1)}%)
                </span>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-hairline/80 text-left text-xs font-medium text-muted-foreground bg-muted/10">
                      <th className="py-3 px-5">{t.subject}</th>
                      <th className="py-3 px-5">{t.marks}</th>
                      <th className="py-3 px-5">{t.percentageLabel}</th>
                      <th className="py-3 px-5">{t.performanceBar}</th>
                      <th className="py-3 px-5">{t.remarksLabel}</th>
                      {(onEditMark || onDeleteMark) && (
                        <th className="py-3 px-5 text-right print:hidden">{t.actionsLabel}</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline/60">
                    {marks.map((m) => {
                      const pct = m.max_marks > 0 ? (m.marks_obtained / m.max_marks) * 100 : 0;
                      const subjGrade = calculateGrade(pct);

                      return (
                        <tr key={m.subject_id} className="hover:bg-muted/20 transition-colors">
                          <td className="py-3 px-5 font-medium text-foreground">
                            {m.subject_name}
                          </td>
                          <td className="py-3 px-5 font-mono text-foreground">
                            <span className="font-semibold">{m.marks_obtained}</span>
                            <span className="text-muted-foreground text-xs"> / {m.max_marks}</span>
                          </td>
                          <td className="py-3 px-5 font-mono">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold border ${subjGrade.color}`}>
                              {pct.toFixed(0)}% ({subjGrade.letter})
                            </span>
                          </td>
                          <td className="py-3 px-5 w-44">
                            <div className="w-full bg-muted/80 h-2 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-blue-500" : "bg-amber-500"
                                }`}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                          </td>
                          <td className="py-3 px-5 text-xs text-muted-foreground">
                            {m.remarks || "Satisfactory progress"}
                          </td>
                          {(onEditMark || onDeleteMark) && (
                            <td className="py-3 px-5 text-right print:hidden">
                              <div className="flex items-center justify-end gap-1.5">
                                {onEditMark && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onEditMark(m)}
                                    className="h-8 size-8 p-0 text-muted-foreground hover:text-terracotta hover:bg-terracotta/10"
                                    title="Edit Marks"
                                  >
                                    <Edit2 className="size-3.5" />
                                  </Button>
                                )}

                                {onDeleteMark && (
                                  <ConfirmDialog
                                    title={t.deleteMarkTitle}
                                    description={`Are you sure you want to delete the mark entry for ${m.subject_name} (${m.term})?`}
                                    confirmLabel={t.confirmDeleteBtn}
                                    cancelLabel={t.cancelBtn}
                                    destructive
                                    onConfirm={() => onDeleteMark(m)}
                                    trigger={
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 size-8 p-0 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                        title="Delete Mark Entry"
                                      >
                                        <Trash2 className="size-3.5" />
                                      </Button>
                                    }
                                  />
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
