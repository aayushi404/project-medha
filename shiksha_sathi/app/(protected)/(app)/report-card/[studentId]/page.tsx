"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  GraduationCap,
  Award,
  Hash,
  Plus,
  PlusCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useCopy } from "@/lib/copy";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ReportCardView } from "@/components/report-card/report-card-view";
import { EditMarkModal } from "@/components/report-card/edit-mark-modal";
import { upsertReportCardMark, deleteReportCardMark, type ReportCard, type ReportCardMark } from "@/lib/api";

interface StudentDetailPageProps {
  params: Promise<{ studentId: string }>;
}

// Generates rich initial exam and subject data for student detail page
function generateHardcodedStudentCard(studentId: string, studentName: string): ReportCard {
  const now = new Date().toISOString();
  return {
    student_id: studentId,
    student_name: studentName,
    marks: [
      {
        subject_id: "subj-math",
        subject_name: "Mathematics",
        term: "Mid-Term Examination 2026",
        marks_obtained: 94,
        max_marks: 100,
        remarks: "Exceptional analytical and problem solving skills.",
        updated_at: now,
      },
      {
        subject_id: "subj-sci",
        subject_name: "Science & Technology",
        term: "Mid-Term Examination 2026",
        marks_obtained: 88,
        max_marks: 100,
        remarks: "Great performance in lab experiments and physics concepts.",
        updated_at: now,
      },
      {
        subject_id: "subj-eng",
        subject_name: "English Literature",
        term: "Mid-Term Examination 2026",
        marks_obtained: 91,
        max_marks: 100,
        remarks: "Fluent essay writing and high vocabulary grasp.",
        updated_at: now,
      },
      {
        subject_id: "subj-hin",
        subject_name: "Hindi",
        term: "Mid-Term Examination 2026",
        marks_obtained: 85,
        max_marks: 100,
        remarks: "Strong grammar and comprehension skills.",
        updated_at: now,
      },
      {
        subject_id: "subj-soc",
        subject_name: "Social Studies",
        term: "Mid-Term Examination 2026",
        marks_obtained: 89,
        max_marks: 100,
        remarks: "Thorough understanding of historical timelines and geography.",
        updated_at: now,
      },
      // Previous term
      {
        subject_id: "subj-math-t1",
        subject_name: "Mathematics",
        term: "First Term Assessment 2025",
        marks_obtained: 90,
        max_marks: 100,
        remarks: "Solid score in geometry and algebra.",
        updated_at: now,
      },
      {
        subject_id: "subj-sci-t1",
        subject_name: "Science & Technology",
        term: "First Term Assessment 2025",
        marks_obtained: 86,
        max_marks: 100,
        remarks: "Consistent performance.",
        updated_at: now,
      },
      {
        subject_id: "subj-eng-t1",
        subject_name: "English Literature",
        term: "First Term Assessment 2025",
        marks_obtained: 87,
        max_marks: 100,
        remarks: "Good effort in creative writing.",
        updated_at: now,
      },
    ],
  };
}

export default function StudentReportCardDetailPage({ params }: StudentDetailPageProps) {
  const { studentId } = use(params);
  const searchParams = useSearchParams();
  const { accessToken } = useAuth();
  const copy = useCopy();
  const t = copy.reportCardPage;

  const studentName = searchParams.get("name") || "Student Report";
  const gradeLabel = searchParams.get("grade") || "Class";
  const rollNumber = searchParams.get("roll") || "N/A";

  const [cardData, setCardData] = useState<ReportCard | null>(null);

  // Modal State for adding/editing student exam marks
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedMarkForEdit, setSelectedMarkForEdit] = useState<ReportCardMark | null>(null);

  useEffect(() => {
    // Initial exam & marks data for this student
    const mockCard = generateHardcodedStudentCard(studentId, studentName);
    setCardData(mockCard);
  }, [studentId, studentName]);

  const handleOpenAddMark = () => {
    setSelectedMarkForEdit(null);
    setIsEditModalOpen(true);
  };

  const handleOpenEditMark = (mark: ReportCardMark) => {
    setSelectedMarkForEdit(mark);
    setIsEditModalOpen(true);
  };

  const handleSaveMark = async (markData: {
    subject_id?: string;
    subject_name: string;
    term: string;
    marks_obtained: number;
    max_marks: number;
    remarks: string;
  }) => {
    if (!cardData) return;

    const existingIndex = cardData.marks.findIndex(
      (m) =>
        (selectedMarkForEdit && m.subject_id === selectedMarkForEdit.subject_id && m.term === selectedMarkForEdit.term) ||
        (m.subject_name.toLowerCase() === markData.subject_name.toLowerCase() && m.term.toLowerCase() === markData.term.toLowerCase())
    );

    const now = new Date().toISOString();
    const updatedMark: ReportCardMark = {
      subject_id: markData.subject_id || selectedMarkForEdit?.subject_id || `subj-${Date.now()}`,
      subject_name: markData.subject_name,
      term: markData.term,
      marks_obtained: markData.marks_obtained,
      max_marks: markData.max_marks,
      remarks: markData.remarks,
      updated_at: now,
    };

    let newMarks: ReportCardMark[];
    if (existingIndex >= 0) {
      newMarks = [...cardData.marks];
      newMarks[existingIndex] = updatedMark;
      toast.success(`Updated marks for ${markData.subject_name} (${markData.term})`);
    } else {
      newMarks = [updatedMark, ...cardData.marks];
      toast.success(`Added new exam mark: ${markData.subject_name} (${markData.marks_obtained}/${markData.max_marks})`);
    }

    setCardData({
      ...cardData,
      marks: newMarks,
    });

    // Sync with API if user is authenticated
    if (accessToken && markData.subject_id) {
      try {
        await upsertReportCardMark(accessToken, {
          student_id: studentId,
          subject_id: markData.subject_id,
          term: markData.term,
          marks_obtained: markData.marks_obtained,
          max_marks: markData.max_marks,
          remarks: markData.remarks,
        });
      } catch (err) {
        // Fallback gracefully for local state demo
      }
    }
  };

  const handleDeleteMark = async (mark: ReportCardMark) => {
    if (!cardData) return;

    const confirmDelete = window.confirm(
      `Are you sure you want to delete the mark entry for ${mark.subject_name} (${mark.term})?`
    );
    if (!confirmDelete) return;

    const filteredMarks = cardData.marks.filter(
      (m) => !(m.subject_id === mark.subject_id && m.term === mark.term)
    );

    setCardData({
      ...cardData,
      marks: filteredMarks,
    });

    toast.success(`Deleted mark entry for ${mark.subject_name}`);

    // Sync with API if user is authenticated
    if (accessToken) {
      try {
        await deleteReportCardMark(accessToken, studentId, mark.subject_id, mark.term);
      } catch (err) {
        // Fallback gracefully for local state demo
      }
    }
  };

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-background">
      {/* Back Header Bar */}
      <div className="border-b border-border bg-card px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/report-card">
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="size-4" />
              {t.backToRoster}
            </Button>
          </Link>
          <span className="text-hairline">|</span>
          <h1 className="font-serif text-base font-bold text-foreground truncate">
            {studentName} — {t.studentDetails}
          </h1>
        </div>

        <Button
          onClick={handleOpenAddMark}
          className="bg-terracotta hover:bg-terracotta/90 text-white shadow-xs"
        >
          <PlusCircle className="size-4 mr-1.5" />
          Add Exam & Marks
        </Button>
      </div>

      {/* Main Detail Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-5xl space-y-6">
          {/* Top Profile Summary Header Card */}
          <Card className="border border-border bg-linear-to-r from-card via-card to-parchment/40 dark:to-card shadow-xs">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className="size-16 rounded-2xl bg-terracotta text-white flex items-center justify-center font-serif text-2xl font-bold shadow-md shrink-0">
                    {studentName
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </div>
                  <div>
                    <h2 className="font-serif text-2xl font-bold text-foreground">{studentName}</h2>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-1 font-mono">
                      <span className="flex items-center gap-1">
                        <GraduationCap className="size-4 text-terracotta" />
                        {gradeLabel}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Hash className="size-4 text-terracotta" />
                        Roll No: {rollNumber}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Performance Metrics */}
                <div className="grid grid-cols-3 gap-3 border-t md:border-t-0 md:border-l border-hairline/80 pt-4 md:pt-0 md:pl-6 text-center">
                  <div className="px-3 py-1.5 rounded-xl bg-background/60 border border-hairline/60">
                    <div className="text-xs text-muted-foreground">{t.rankInClass}</div>
                    <div className="font-serif text-lg font-bold text-terracotta font-mono mt-0.5">
                      #3 <span className="text-xs font-normal text-muted-foreground">in class</span>
                    </div>
                  </div>

                  <div className="px-3 py-1.5 rounded-xl bg-background/60 border border-hairline/60">
                    <div className="text-xs text-muted-foreground">{t.attendanceRate}</div>
                    <div className="font-serif text-lg font-bold text-emerald-700 dark:text-emerald-400 font-mono mt-0.5">
                      96.5%
                    </div>
                  </div>

                  <div className="px-3 py-1.5 rounded-xl bg-background/60 border border-hairline/60">
                    <div className="text-xs text-muted-foreground">{t.overallGrade}</div>
                    <div className="font-serif text-lg font-bold text-foreground font-mono mt-0.5">
                      A+ (89.4%)
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Report Card View Component with Edit & Delete Actions */}
          <ReportCardView
            card={cardData}
            studentName={studentName}
            gradeLabel={gradeLabel}
            rollNumber={rollNumber}
            onEditMark={handleOpenEditMark}
            onDeleteMark={handleDeleteMark}
          />
        </div>
      </div>

      {/* Edit & Create Exam Mark Modal */}
      <EditMarkModal
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        initialMark={selectedMarkForEdit}
        onSaveMark={handleSaveMark}
      />
    </main>
  );
}
