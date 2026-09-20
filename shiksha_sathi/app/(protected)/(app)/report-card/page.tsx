"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Search, Users, Award, BookCheck, Filter } from "lucide-react";
import { toast } from "sonner";

import { getProfile, getStudentRoster, type Profile, type StudentRosterItem } from "@/lib/api";
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

  const [profile, setProfile] = useState<Profile | null>(null);
  const [roster, setRoster] = useState<StudentRosterItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedGradeId, setSelectedGradeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isExamModalOpen, setIsExamModalOpen] = useState(false);

  // Load teacher profile and roster from DB APIs
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
        toast.error(err instanceof Error ? err.message : "Failed to load class roster");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [accessToken]);

  // Extract unique grades assigned to this teacher from profile.subjects
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

    // If teacher has no assigned subjects in profile, fallback to grades found in roster
    if (options.length === 0 && roster.length > 0) {
      const rosterMap = new Map<string, string>();
      roster.forEach((st) => {
        if (st.grade_id && st.grade_label) rosterMap.set(st.grade_id, st.grade_label);
      });
      return Array.from(rosterMap.entries()).map(([id, label]) => ({ value: id, label }));
    }

    return options;
  }, [profile, roster]);

  // Filter students by selected class grade ID
  const studentsInSelectedGrade = useMemo(() => {
    if (!selectedGradeId) return roster;
    return roster.filter((s) => s.grade_id === selectedGradeId);
  }, [roster, selectedGradeId]);

  const selectedGradeLabel = useMemo(() => {
    return gradeOptions.find((g) => g.value === selectedGradeId)?.label || "Class";
  }, [gradeOptions, selectedGradeId]);

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-background">
      {/* Header Bar */}
      <div className="border-b border-border bg-card px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-xl font-bold text-foreground tracking-tight">{t.title}</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">{t.sub}</p>
        </div>

        <Button
          onClick={() => setIsExamModalOpen(true)}
          className="bg-terracotta hover:bg-terracotta/90 text-white shadow-xs self-start sm:self-auto"
        >
          <Plus className="size-4 mr-1.5" />
          {t.createExamBtn}
        </Button>
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
                      value={selectedGradeId}
                      onValueChange={(val) => setSelectedGradeId(val)}
                      options={gradeOptions}
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
        grades={gradeOptions.map((g) => ({ id: g.value, label: g.label }))}
        defaultGradeId={selectedGradeId || undefined}
        onExamCreated={(exam) => {
          // Add exam feedback if needed
        }}
      />
    </main>
  );
}
