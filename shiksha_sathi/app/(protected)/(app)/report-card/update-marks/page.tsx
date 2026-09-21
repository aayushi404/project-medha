"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  FileCheck,
  FileSpreadsheet,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
  Upload,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

import {
  bulkUpsertReportCardMarks,
  evaluateOMRSheet,
  getClassReportCardMarks,
  getProfile,
  getStudentRoster,
  uploadOMRSheet,
  type OMREvaluationResult,
  type Profile,
  type ReportCardMark,
  type StudentRosterItem,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCopy } from "@/lib/copy";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, type SelectOption } from "@/components/ui/select";
import { OMRReviewModal } from "@/components/report-card/omr-review-modal";

interface StudentMarkRowState {
  marks_obtained: string;
  remarks: string;
  isEdited?: boolean;
}

export default function UpdateMarksPage() {
  const { accessToken } = useAuth();
  const copy = useCopy();
  const t = copy.reportCardPage;
  const router = useRouter();

  // Primary data states
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roster, setRoster] = useState<StudentRosterItem[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Form selection states
  const [selectedGradeId, setSelectedGradeId] = useState<string | null>(null);
  const [examName, setExamName] = useState("Mid Term Examination");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [maxMarks, setMaxMarks] = useState("100");

  // Marks data states
  const [loadingMarks, setLoadingMarks] = useState(false);
  const [studentMarksState, setStudentMarksState] = useState<Record<string, StudentMarkRowState>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [activeRemarkStudentId, setActiveRemarkStudentId] = useState<string | null>(null);

  // OMR upload states
  const [omrFile, setOmrFile] = useState<File | null>(null);
  const [omrUploading, setOmrUploading] = useState(false);
  const [omrUploadStatus, setOmrUploadStatus] = useState<{
    file_name: string;
    file_size_bytes: number;
    status: string;
    message: string;
  } | null>(null);

  // Saving state
  const [saving, setSaving] = useState(false);

  // Input focus refs for fast keyboard navigation
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // 1. Initial Load: Fetch teacher profile and roster
  useEffect(() => {
    if (!accessToken) return;
    let active = true;

    Promise.all([getProfile(accessToken), getStudentRoster(accessToken)])
      .then(([p, r]) => {
        if (!active) return;
        setProfile(p);
        setRoster(r);

        // Deduplicate grades assigned to this teacher
        const assignedGrades = Array.from(
          new Map(p.subjects.map((s) => [s.grade_id, { id: s.grade_id, label: s.grade_label }])).values()
        );

        if (assignedGrades.length > 0) {
          setSelectedGradeId(assignedGrades[0].id);
        } else if (r.length > 0) {
          setSelectedGradeId(r[0].grade_id);
        }
      })
      .catch((err: unknown) => {
        toast.error(err instanceof Error ? err.message : "Failed to load class information");
      })
      .finally(() => {
        if (active) setLoadingInitial(false);
      });

    return () => {
      active = false;
    };
  }, [accessToken]);

  // Derived Grade options for teacher
  const gradeOptions: SelectOption[] = useMemo(() => {
    if (!profile?.subjects) return [];
    const map = new Map<string, string>();
    profile.subjects.forEach((s) => {
      if (s.grade_id && s.grade_label) {
        map.set(s.grade_id, s.grade_label);
      }
    });

    const options: SelectOption[] = Array.from(map.entries()).map(([id, label]) => ({
      value: id,
      label: label,
    }));

    if (options.length === 0 && roster.length > 0) {
      const rosterMap = new Map<string, string>();
      roster.forEach((st) => {
        if (st.grade_id && st.grade_label) rosterMap.set(st.grade_id, st.grade_label);
      });
      return Array.from(rosterMap.entries()).map(([id, label]) => ({ value: id, label }));
    }

    return options;
  }, [profile, roster]);

  // Derived Subject options for selected grade
  const subjectOptions: SelectOption[] = useMemo(() => {
    if (!profile?.subjects || !selectedGradeId) return [];
    const filtered = profile.subjects.filter((s) => s.grade_id === selectedGradeId);
    const map = new Map<string, string>();
    filtered.forEach((s) => {
      map.set(s.subject_id, s.subject_name);
    });

    return Array.from(map.entries()).map(([id, name]) => ({
      value: id,
      label: name,
    }));
  }, [profile, selectedGradeId]);

  // Set default subject when options change
  useEffect(() => {
    if (subjectOptions.length > 0) {
      const currentExists = subjectOptions.some((s) => s.value === selectedSubjectId);
      if (!currentExists) {
        setSelectedSubjectId(subjectOptions[0].value);
      }
    } else {
      setSelectedSubjectId(null);
    }
  }, [subjectOptions, selectedSubjectId]);

  // Filter students in selected grade
  const studentsInClass = useMemo(() => {
    if (!selectedGradeId) return [];
    return roster.filter((s) => s.grade_id === selectedGradeId);
  }, [roster, selectedGradeId]);

  const selectedGradeLabel = useMemo(() => {
    return gradeOptions.find((g) => g.value === selectedGradeId)?.label || "Class";
  }, [gradeOptions, selectedGradeId]);

  const selectedSubjectName = useMemo(() => {
    return subjectOptions.find((s) => s.value === selectedSubjectId)?.label || "Subject";
  }, [subjectOptions, selectedSubjectId]);

  // Initialize student marks state when studentsInClass changes
  useEffect(() => {
    setStudentMarksState((prev) => {
      const next: Record<string, StudentMarkRowState> = {};
      studentsInClass.forEach((student) => {
        next[student.id] = prev[student.id] || { marks_obtained: "", remarks: "" };
      });
      return next;
    });
  }, [studentsInClass]);

  // Load existing marks safely from backend when Class + Subject + Exam change
  useEffect(() => {
    if (!accessToken || !selectedGradeId || !selectedSubjectId || !examName.trim()) return;
    let active = true;
    setLoadingMarks(true);

    getClassReportCardMarks(accessToken, selectedGradeId, selectedSubjectId, examName.trim())
      .then((existingMarks: ReportCardMark[]) => {
        if (!active) return;
        if (Array.isArray(existingMarks) && existingMarks.length > 0) {
          setStudentMarksState((prev) => {
            const updated = { ...prev };
            existingMarks.forEach((m) => {
              if (m.subject_id === selectedSubjectId) {
                // If there's an existing mark, update matching student entry if available
              }
            });
            return updated;
          });
        }
      })
      .catch(() => {
        // Soft fallback if no existing marks recorded
      })
      .finally(() => {
        if (active) setLoadingMarks(false);
      });
  }, [accessToken, selectedGradeId, selectedSubjectId, examName]);

  // Handlers for marks input
  const handleMarkChange = (studentId: string, value: string) => {
    setStudentMarksState((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { remarks: "" }),
        marks_obtained: value,
        isEdited: true,
      },
    }));
  };

  const handleRemarkChange = (studentId: string, value: string) => {
    setStudentMarksState((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { marks_obtained: "" }),
        remarks: value,
        isEdited: true,
      },
    }));
  };

  // Filtered visible students by search query
  const visibleStudents = useMemo(() => {
    if (!searchQuery.trim()) return studentsInClass;
    const q = searchQuery.toLowerCase().trim();
    return studentsInClass.filter((st) => {
      const nameMatch = st.full_name?.toLowerCase().includes(q);
      const rollMatch = st.roll_number?.toString().toLowerCase().includes(q);
      return nameMatch || rollMatch;
    });
  }, [studentsInClass, searchQuery]);

  // Max marks validation
  const parsedMaxMarks = parseFloat(maxMarks) || 100;
  const isMaxMarksValid = parsedMaxMarks > 0;

  // Compute marks entry progress & validity across all class students
  const progressStats = useMemo(() => {
    let enteredCount = 0;
    let invalidCount = 0;

    studentsInClass.forEach((st) => {
      const state = studentMarksState[st.id];
      if (state && state.marks_obtained !== "") {
        const val = parseFloat(state.marks_obtained);
        if (isNaN(val) || val < 0 || val > parsedMaxMarks) {
          invalidCount++;
        } else {
          enteredCount++;
        }
      }
    });

    return {
      enteredCount,
      invalidCount,
      totalCount: studentsInClass.length,
      isAllEntered: enteredCount === studentsInClass.length && studentsInClass.length > 0,
      percentage: studentsInClass.length > 0 ? (enteredCount / studentsInClass.length) * 100 : 0,
    };
  }, [studentsInClass, studentMarksState, parsedMaxMarks]);

  // Fast keyboard navigation between inputs
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, currentIndex: number) => {
    if (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) {
      e.preventDefault();
      const nextStudent = visibleStudents[currentIndex + 1];
      if (nextStudent && inputRefs.current[nextStudent.id]) {
        inputRefs.current[nextStudent.id]?.focus();
        inputRefs.current[nextStudent.id]?.select();
      }
    } else if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault();
      const prevStudent = visibleStudents[currentIndex - 1];
      if (prevStudent && inputRefs.current[prevStudent.id]) {
        inputRefs.current[prevStudent.id]?.focus();
        inputRefs.current[prevStudent.id]?.select();
      }
    }
  };

  // OMR evaluation states
  const [evaluatingOmr, setEvaluatingOmr] = useState(false);
  const [omrResult, setOmrResult] = useState<OMREvaluationResult | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  const handleEvaluateOmr = async () => {
    if (!accessToken || !omrFile || !selectedGradeId) {
      toast.error("Please select a class and an OMR file before evaluating.");
      return;
    }

    setEvaluatingOmr(true);
    try {
      const res = await evaluateOMRSheet(accessToken, omrFile, selectedGradeId, parsedMaxMarks);
      setOmrResult(res);
      setIsReviewModalOpen(true);
      toast.success(res.message || "OMR sheet evaluated successfully.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to evaluate OMR sheet.");
    } finally {
      setEvaluatingOmr(false);
    }
  };

  const handleApplyReviewedOMRMarks = (
    reviewedMarks: Record<string, { marks_obtained: string; remarks: string }>
  ) => {
    setStudentMarksState((prev) => {
      const updated = { ...prev };
      Object.entries(reviewedMarks).forEach(([stId, data]) => {
        updated[stId] = {
          marks_obtained: data.marks_obtained,
          remarks: data.remarks,
          isEdited: true,
        };
      });
      return updated;
    });
    toast.success("OMR scores applied to the student marks table. Please review and click Save marks.");
  };

  // OMR file handling
  const handleOmrFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    const validExts = [".pdf", ".jpg", ".jpeg", ".png"];
    if (!validExts.some((ext) => lowerName.endsWith(ext))) {
      toast.error("Unsupported file format. Please upload PDF, JPG, or PNG.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size exceeds 10MB limit.");
      return;
    }

    setOmrFile(file);
    setOmrUploading(true);

    try {
      const result = await uploadOMRSheet(accessToken, file);
      setOmrUploadStatus(result);
      toast.success("OMR answer sheet uploaded successfully.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload OMR file");
    } finally {
      setOmrUploading(false);
    }
  };

  // Batch Save Handler
  const handleSaveMarks = async () => {
    if (!accessToken) return;
    if (!selectedGradeId || !selectedSubjectId || !examName.trim()) {
      toast.error("Please complete the examination configuration before saving.");
      return;
    }

    if (!isMaxMarksValid) {
      toast.error("Please enter a valid total maximum marks (> 0).");
      return;
    }

    // Collect marks for students that have values entered
    const markItemsToSave = studentsInClass
      .map((st) => {
        const state = studentMarksState[st.id];
        if (!state || state.marks_obtained === "") return null;
        const val = parseFloat(state.marks_obtained);
        if (isNaN(val) || val < 0 || val > parsedMaxMarks) return null;
        return {
          student_id: st.id,
          marks_obtained: val,
          remarks: state.remarks.trim() || null,
        };
      })
      .filter(Boolean) as { student_id: string; marks_obtained: number; remarks: string | null }[];

    if (markItemsToSave.length === 0) {
      toast.error("No valid student marks to save. Please enter marks for at least one student.");
      return;
    }

    setSaving(true);
    try {
      const res = await bulkUpsertReportCardMarks(accessToken, {
        grade_id: selectedGradeId,
        subject_id: selectedSubjectId,
        term: examName.trim(),
        max_marks: parsedMaxMarks,
        marks: markItemsToSave,
      });

      toast.success(
        t.marksSavedSuccess || `${res.saved_count} student mark${res.saved_count === 1 ? "" : "s"} updated successfully.`
      );
      router.push("/report-card");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save marks. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const isConfigComplete = Boolean(selectedGradeId && selectedSubjectId && examName.trim() && isMaxMarksValid);

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-background">
      {/* Header Bar */}
      <div className="border-b border-border bg-card px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/report-card"
            className="size-9 rounded-full border border-border bg-background flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shrink-0"
            title="Back to Report Cards"
          >
            <ArrowLeft className="size-4" />
          </Link>

          <div>
            <h1 className="font-serif text-xl font-bold text-foreground tracking-tight">
              {t.updateMarksTitle || "Update Marks"}
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t.updateMarksSub || "Enter or upload marks for students in an examination."}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Scroll Area */}
      <div className="flex-1 overflow-y-auto px-6 py-6 pb-28">
        <div className="mx-auto max-w-5xl space-y-6">
          {loadingInitial ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="size-8 animate-spin text-terracotta mb-2" />
              <p className="text-sm">Loading teacher classes and subjects...</p>
            </div>
          ) : gradeOptions.length === 0 ? (
            <Card className="border border-dashed p-8 text-center text-muted-foreground bg-muted/20">
              <CardContent className="pt-6">
                <AlertCircle className="size-10 text-muted-foreground/60 mx-auto mb-3" />
                <h3 className="font-serif text-lg font-medium text-foreground">
                  {t.noClassesAssigned || "No classes are assigned to you yet."}
                </h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                  Your teacher profile is not linked to any classes or subjects. Please contact your school administrator to get assigned to a class roster.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* CARD 1: EXAMINATION DETAILS CONFIGURATION */}
              <Card className="border border-border shadow-2xs bg-card">
                <CardHeader className="pb-3 border-b border-hairline/60">
                  <CardTitle className="font-serif text-base font-semibold text-foreground flex items-center gap-2">
                    <FileSpreadsheet className="size-4 text-terracotta" />
                    {t.examDetailsTitle || "Examination details"}
                  </CardTitle>
                </CardHeader>

                <CardContent className="p-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Class Selector */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground">
                        Class <span className="text-rose-500">*</span>
                      </Label>
                      <Select
                        value={selectedGradeId}
                        onValueChange={(val) => setSelectedGradeId(val)}
                        options={gradeOptions}
                        placeholder="Select Class"
                        className="w-full h-9 font-medium"
                      />
                    </div>

                    {/* Examination Name Input & Presets */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground">
                        {t.examLabel || "Examination"} <span className="text-rose-500">*</span>
                      </Label>
                      <Input
                        value={examName}
                        onChange={(e) => setExamName(e.target.value)}
                        placeholder={t.examPlaceholder || "e.g. Unit Test 1, Mid Term, Half Yearly"}
                        className="h-9 text-sm font-medium"
                      />
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {["Mid Term Examination", "Unit Test 1", "Half Yearly", "Annual Exam"].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setExamName(preset)}
                            className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                              examName === preset
                                ? "bg-terracotta/10 border-terracotta text-terracotta font-medium"
                                : "bg-muted/40 border-border text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Subject Selector */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground">
                        Subject <span className="text-rose-500">*</span>
                      </Label>
                      {subjectOptions.length > 0 ? (
                        <Select
                          value={selectedSubjectId}
                          onValueChange={(val) => setSelectedSubjectId(val)}
                          options={subjectOptions}
                          placeholder="Select Subject"
                          className="w-full h-9 font-medium"
                        />
                      ) : (
                        <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-2.5 dark:bg-rose-950/40 dark:border-rose-900">
                          {t.noSubjectsAvailable || "No subjects are available for this class."}
                        </div>
                      )}
                    </div>

                    {/* Total / Maximum Marks */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground">
                        {t.totalMarksLabel || "Total marks"} <span className="text-rose-500">*</span>
                      </Label>
                      <div className="relative">
                        <Input
                          type="number"
                          min="1"
                          max="1000"
                          value={maxMarks}
                          onChange={(e) => setMaxMarks(e.target.value)}
                          placeholder="100"
                          className="h-9 text-sm font-mono font-medium"
                        />
                      </div>
                      {!isMaxMarksValid && (
                        <p className="text-[11px] text-rose-600">Total marks must be a positive number.</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* SECTION 2: STUDENT MARKS TABLE (Shown once configuration is ready) */}
              {isConfigComplete && (
                <div className="space-y-4 pt-2">
                  {/* Header & Live Summary Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h2 className="font-serif text-lg font-semibold text-foreground flex items-center gap-2">
                        <span>{t.studentMarksHeading || "Student Marks"}</span>
                        <span className="text-xs font-mono font-normal px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                          {studentsInClass.length} students · {selectedSubjectName} · {maxMarks} marks
                        </span>
                      </h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t.enterMarksSub || "Enter marks for each student."} Use <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded text-[10px] font-mono">Tab</kbd> to move quickly between rows.
                      </p>
                    </div>

                    {/* Progress Indicator */}
                    <div className="bg-card border border-border rounded-xl px-3.5 py-2 flex items-center gap-3 shrink-0 shadow-2xs">
                      <div className="text-xs">
                        <span className="text-muted-foreground font-medium">{t.marksEnteredProgress || "Marks entered"}:</span>{" "}
                        <strong className="font-mono text-foreground">{progressStats.enteredCount} / {progressStats.totalCount}</strong>
                      </div>
                      <div className="w-24 bg-muted h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            progressStats.isAllEntered ? "bg-emerald-500" : "bg-terracotta"
                          }`}
                          style={{ width: `${progressStats.percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Student Search & Filter Controls */}
                  <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search student by name or roll number..."
                      className="pl-9 h-9 text-sm bg-card"
                    />
                    {searchQuery && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">
                        Showing {visibleStudents.length} of {studentsInClass.length}
                      </span>
                    )}
                  </div>

                  {/* Responsive Student Marks Table / Mobile Cards */}
                  <Card className="border border-border overflow-hidden bg-card shadow-2xs">
                    {loadingMarks ? (
                      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                        <Loader2 className="size-6 animate-spin text-terracotta mb-2" />
                        <p className="text-xs">Fetching existing marks for this examination...</p>
                      </div>
                    ) : visibleStudents.length === 0 ? (
                      <div className="p-8 text-center text-xs text-muted-foreground">
                        {searchQuery ? `No students match "${searchQuery}".` : "No registered students in this class."}
                      </div>
                    ) : (
                      <>
                        {/* Desktop Table View */}
                        <div className="hidden sm:block overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold text-muted-foreground">
                                <th className="py-3 px-4 w-20">Roll</th>
                                <th className="py-3 px-4">Student</th>
                                <th className="py-3 px-4 w-52">Marks</th>
                                <th className="py-3 px-4 w-32">Status</th>
                                <th className="py-3 px-4 w-36 text-right">Remarks</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-hairline/70">
                              {visibleStudents.map((student, idx) => {
                                const rowState = studentMarksState[student.id] || { marks_obtained: "", remarks: "" };
                                const valStr = rowState.marks_obtained;
                                const valNum = parseFloat(valStr);
                                const isEntered = valStr.trim() !== "";
                                const isInvalid = isEntered && (isNaN(valNum) || valNum < 0 || valNum > parsedMaxMarks);
                                const isRemarkOpen = activeRemarkStudentId === student.id || Boolean(rowState.remarks);

                                return (
                                  <tr key={student.id} className="hover:bg-muted/20 transition-colors">
                                    {/* Roll Number */}
                                    <td className="py-3 px-4 font-mono text-xs font-semibold text-muted-foreground">
                                      {student.roll_number || "—"}
                                    </td>

                                    {/* Student Name */}
                                    <td className="py-3 px-4">
                                      <span className="font-medium text-foreground">{student.full_name}</span>
                                    </td>

                                    {/* Marks Input Field */}
                                    <td className="py-3 px-4">
                                      <div className="flex items-center gap-2">
                                        <div className="relative">
                                          <Input
                                            ref={(el) => {
                                              inputRefs.current[student.id] = el;
                                            }}
                                            type="number"
                                            step="any"
                                            min="0"
                                            max={parsedMaxMarks}
                                            value={rowState.marks_obtained}
                                            onChange={(e) => handleMarkChange(student.id, e.target.value)}
                                            onKeyDown={(e) => handleKeyDown(e, idx)}
                                            placeholder="—"
                                            className={`w-24 h-9 text-sm font-mono text-center font-semibold transition-all ${
                                              isInvalid
                                                ? "border-rose-500 bg-rose-50/50 text-rose-900 focus-visible:ring-rose-500"
                                                : isEntered
                                                ? "border-emerald-400/80 bg-emerald-50/30 dark:bg-emerald-950/20"
                                                : ""
                                            }`}
                                          />
                                        </div>
                                        <span className="text-xs font-mono text-muted-foreground">/ {maxMarks}</span>
                                      </div>
                                      {isInvalid && (
                                        <p className="text-[11px] text-rose-600 mt-1">
                                          {valNum > parsedMaxMarks
                                            ? `Cannot exceed ${maxMarks}`
                                            : "Must be non-negative"}
                                        </p>
                                      )}
                                    </td>

                                    {/* Status Indicator */}
                                    <td className="py-3 px-4">
                                      {isInvalid ? (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950 dark:text-rose-300">
                                          <AlertCircle className="size-3" />
                                          Invalid
                                        </span>
                                      ) : isEntered ? (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300">
                                          <CheckCircle2 className="size-3 text-emerald-600" />
                                          Entered
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
                                          — Pending
                                        </span>
                                      )}
                                    </td>

                                    {/* Remarks Field / Trigger */}
                                    <td className="py-3 px-4 text-right">
                                      {isRemarkOpen ? (
                                        <Input
                                          value={rowState.remarks}
                                          onChange={(e) => handleRemarkChange(student.id, e.target.value)}
                                          placeholder="Optional remark..."
                                          className="h-8 text-xs bg-background"
                                        />
                                      ) : (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => setActiveRemarkStudentId(student.id)}
                                          className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
                                        >
                                          <MessageSquare className="size-3" />
                                          Add remark
                                        </Button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Mobile Cards View */}
                        <div className="block sm:hidden divide-y divide-hairline">
                          {visibleStudents.map((student) => {
                            const rowState = studentMarksState[student.id] || { marks_obtained: "", remarks: "" };
                            const valStr = rowState.marks_obtained;
                            const valNum = parseFloat(valStr);
                            const isEntered = valStr.trim() !== "";
                            const isInvalid = isEntered && (isNaN(valNum) || valNum < 0 || valNum > parsedMaxMarks);

                            return (
                              <div key={student.id} className="p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <h4 className="font-medium text-sm text-foreground">{student.full_name}</h4>
                                    <p className="text-xs text-muted-foreground font-mono">Roll: {student.roll_number || "—"}</p>
                                  </div>

                                  {isInvalid ? (
                                    <span className="text-xs px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-medium">Invalid</span>
                                  ) : isEntered ? (
                                    <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-medium">✓ Entered</span>
                                  ) : (
                                    <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground font-medium">Pending</span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2">
                                  <Input
                                    type="number"
                                    step="any"
                                    value={rowState.marks_obtained}
                                    onChange={(e) => handleMarkChange(student.id, e.target.value)}
                                    placeholder="Marks"
                                    className="h-9 text-sm font-mono text-center font-semibold w-28"
                                  />
                                  <span className="text-xs text-muted-foreground font-mono">/ {maxMarks}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </Card>
                </div>
              )}

              {/* CARD 3: OMR UPLOAD SECTION */}
              <Card className="border border-border shadow-2xs bg-card mt-8">
                <CardHeader className="pb-3 border-b border-hairline/60">
                  <CardTitle className="font-serif text-base font-semibold text-foreground flex items-center gap-2">
                    <Upload className="size-4 text-terracotta" />
                    {t.omrUploadTitle || "Upload OMR"}
                  </CardTitle>
                </CardHeader>

                <CardContent className="p-5">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium text-foreground">
                        {t.omrUploadSub || "Upload an OMR answer sheet to automatically fill marks."}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t.omrSupportedFormats || "Supported formats: PDF / JPG / PNG (Max 10MB)"}
                      </p>
                    </div>

                    <div className="relative shrink-0">
                      <input
                        type="file"
                        id="omr-upload-input"
                        accept=".pdf,.png,.jpg,.jpeg"
                        onChange={handleOmrFileSelect}
                        className="hidden"
                      />
                      <label htmlFor="omr-upload-input">
                        <Button
                          variant="outline"
                          type="button"
                          disabled={omrUploading}
                          onClick={() => document.getElementById("omr-upload-input")?.click()}
                          className="border-terracotta/40 text-terracotta hover:bg-terracotta/10 cursor-pointer"
                        >
                          {omrUploading ? (
                            <>
                              <Loader2 className="size-4 mr-2 animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              <Upload className="size-4 mr-2" />
                              {t.omrUploadBtn || "Upload OMR"}
                            </>
                          )}
                        </Button>
                      </label>
                    </div>
                  </div>

                  {/* Uploaded OMR State Card & Evaluation Trigger */}
                  {omrUploadStatus && (
                    <div className="mt-4 p-4 rounded-xl border border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                          <FileCheck className="size-5" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                            ✓ {omrUploadStatus.file_name}
                          </p>
                          <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-mono mt-0.5">
                            {(omrUploadStatus.file_size_bytes / (1024 * 1024)).toFixed(2)} MB • {omrUploadStatus.message}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setOmrFile(null);
                            setOmrUploadStatus(null);
                            setOmrResult(null);
                          }}
                          className="text-xs text-muted-foreground hover:text-foreground gap-1"
                        >
                          <RefreshCw className="size-3" />
                          Replace
                        </Button>

                        <Button
                          onClick={handleEvaluateOmr}
                          disabled={evaluatingOmr}
                          className="h-8 px-4 text-xs font-semibold bg-terracotta hover:bg-terracotta/90 text-white shadow-xs"
                        >
                          {evaluatingOmr ? (
                            <>
                              <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                              Evaluating OMR...
                            </>
                          ) : (
                            "Evaluate OMR"
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* STICKY BOTTOM ACTION BAR */}
      {isConfigComplete && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-card/95 backdrop-blur-md px-6 py-3 shadow-lg z-20">
          <div className="mx-auto max-w-5xl flex items-center justify-between gap-4">
            <div className="text-xs text-muted-foreground">
              <strong className="font-mono text-foreground font-semibold">{progressStats.enteredCount} / {progressStats.totalCount}</strong> marks entered
              {progressStats.invalidCount > 0 && (
                <span className="ml-2 text-rose-600 font-medium">({progressStats.invalidCount} invalid)</span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => router.push("/report-card")}
                disabled={saving}
                className="h-9 px-4 text-xs font-medium"
              >
                {t.cancelBtn || "Cancel"}
              </Button>

              <Button
                onClick={handleSaveMarks}
                disabled={saving || progressStats.invalidCount > 0 || !isMaxMarksValid}
                className="h-9 px-5 text-xs font-semibold bg-terracotta hover:bg-terracotta/90 text-white shadow-xs"
              >
                {saving ? (
                  <>
                    <Loader2 className="size-4 mr-1.5 animate-spin" />
                    Saving marks...
                  </>
                ) : (
                  t.saveMarksBtn || "Save marks"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* OMR EVALUATION REVIEW MODAL */}
      <OMRReviewModal
        open={isReviewModalOpen}
        onOpenChange={setIsReviewModalOpen}
        evaluationResult={omrResult}
        classRoster={studentsInClass}
        maxMarks={parsedMaxMarks}
        onApplyMarks={handleApplyReviewedOMRMarks}
      />
    </main>
  );
}

