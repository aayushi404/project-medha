"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Search, Users, Award, BookCheck, Filter, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

import {
  getMySections,
  getStudentRoster,
  type StudentRosterItem,
  type TeacherSection,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCopy } from "@/lib/copy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { ReportCardStudentList } from "@/components/report-card/report-card-student-list";
import { CreateExamModal } from "@/components/report-card/create-exam-modal";

export default function TeacherReportCardPage() {
  const { accessToken } = useAuth();
  const copy = useCopy();
  const t = copy.reportCardPage;

  const [sections, setSections] = useState<TeacherSection[]>([]);
  const [roster, setRoster] = useState<StudentRosterItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isExamModalOpen, setIsExamModalOpen] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;

    Promise.all([getMySections(accessToken), getStudentRoster(accessToken)])
      .then(([s, r]) => {
        if (!active) return;
        setSections(s);
        setRoster(r);
        setSelectedSectionId((cur) => cur ?? s[0]?.id ?? null);
      })
      .catch((err: unknown) => {
        toast.error(err instanceof Error ? err.message : "Failed to load class roster");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [accessToken]);

  const sectionOptions: SelectOption[] = useMemo(
    () => sections.map((s) => ({ value: s.id, label: `${s.grade_label} · ${s.section}` })),
    [sections],
  );

  // Filter students by selected class_section
  const studentsInSelectedGrade = useMemo(() => {
    if (!selectedSectionId) return roster;
    return roster.filter((s) => s.class_section_id === selectedSectionId);
  }, [roster, selectedSectionId]);

  const selectedGradeLabel = useMemo(() => {
    return sectionOptions.find((g) => g.value === selectedSectionId)?.label || "Class";
  }, [sectionOptions, selectedSectionId]);

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-background">
      {/* Header Bar */}
      <div className="border-b border-border bg-card px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-xl font-bold text-foreground tracking-tight">{t.title}</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">{t.sub}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          <Link href="/report-card/update-marks">
            <Button
              variant="outline"
              className="border-terracotta/40 text-terracotta hover:bg-terracotta/10 hover:text-terracotta shadow-2xs font-medium"
            >
              <FileSpreadsheet className="size-4 mr-1.5" />
              {t.updateMarksBtn || "Update Marks"}
            </Button>
          </Link>

          <Button
            onClick={() => setIsExamModalOpen(true)}
            className="bg-terracotta hover:bg-terracotta/90 text-white shadow-2xs font-medium"
          >
            <Plus className="size-4 mr-1.5" />
            {t.createExamBtn}
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="mx-auto max-w-6xl space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
              <Loader2 className="size-8 animate-spin text-terracotta mb-2" />
              <p className="text-sm">Fetching class rosters and profile...</p>
            </div>
          ) : (
            <>
              {/* Controls Bar: Class Selector & Student Search */}
              <Card className="border border-border shadow-2xs">
                <CardContent className="p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                  {/* Teacher's Class Selector */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground shrink-0">
                      <Filter className="size-4 text-terracotta" />
                      {t.selectClass}:
                    </div>
                    <Select
                      value={selectedSectionId}
                      onValueChange={(val) => setSelectedSectionId(val)}
                      options={sectionOptions}
                      placeholder={t.selectClass}
                      className="min-w-44 h-9 font-medium"
                    />
                  </div>

                  {/* Student Search Box */}
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={t.searchStudent}
                      className="pl-9 h-9 text-sm bg-background"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Class Summary Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border border-border/70 bg-card">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{t.totalStudents}</p>
                      <p className="font-serif text-2xl font-bold text-foreground mt-0.5 font-mono">
                        {studentsInSelectedGrade.length}
                      </p>
                    </div>
                    <div className="size-10 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 flex items-center justify-center">
                      <Users className="size-5" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-border/70 bg-card">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{t.avgPerformance}</p>
                      <p className="font-serif text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono">
                        84.6%
                      </p>
                    </div>
                    <div className="size-10 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center justify-center">
                      <Award className="size-5" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-border/70 bg-card">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{t.examsConducted}</p>
                      <p className="font-serif text-2xl font-bold text-foreground mt-0.5 font-mono">
                        4 Assessments
                      </p>
                    </div>
                    <div className="size-10 rounded-full bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 flex items-center justify-center">
                      <BookCheck className="size-5" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Roster Section Title */}
              <div className="flex items-center justify-between pt-2">
                <h2 className="font-serif text-lg font-semibold text-foreground flex items-center gap-2">
                  <span>Student Roster for {selectedGradeLabel}</span>
                  <span className="text-xs font-mono font-normal px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                    {studentsInSelectedGrade.length} Students
                  </span>
                </h2>
              </div>

              {/* Student Roster Cards List */}
              <ReportCardStudentList
                students={studentsInSelectedGrade}
                searchQuery={searchQuery}
                selectedGradeLabel={selectedGradeLabel}
              />
            </>
          )}
        </div>
      </div>

      {/* Create Exam & OMR Scanner Modal */}
      <CreateExamModal
        open={isExamModalOpen}
        onOpenChange={setIsExamModalOpen}
        grades={sectionOptions.map((g) => ({ id: g.value, label: g.label }))}
        defaultGradeId={selectedSectionId || undefined}
        onExamCreated={(exam) => {
          // Add exam feedback if needed
        }}
      />
    </main>
  );
}
