"use client";

import Link from "next/link";
import { ChevronRight, User, GraduationCap, Award, Hash } from "lucide-react";
import type { StudentRosterItem } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";

interface ReportCardStudentListProps {
  students: StudentRosterItem[];
  searchQuery?: string;
  selectedGradeLabel?: string;
}

// Generate consistent visual avatar color derived from student ID or name
function getAvatarBg(name: string) {
  const colors = [
    "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-200",
    "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200",
    "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950 dark:text-sky-200",
    "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-200",
    "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-200",
    "bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-200",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// Mock mock performance badge metrics based on student roll number / index
function getMockPerformance(index: number) {
  const mockPerformances = [
    { grade: "A+", percentage: "94.5%", badgeVariant: "default" as const, colorClass: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300" },
    { grade: "A", percentage: "88.0%", badgeVariant: "secondary" as const, colorClass: "text-emerald-600 bg-emerald-50/70 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400" },
    { grade: "B+", percentage: "78.2%", badgeVariant: "outline" as const, colorClass: "text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300" },
    { grade: "A+", percentage: "91.8%", badgeVariant: "default" as const, colorClass: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300" },
    { grade: "B", percentage: "71.5%", badgeVariant: "outline" as const, colorClass: "text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300" },
    { grade: "A", percentage: "85.4%", badgeVariant: "secondary" as const, colorClass: "text-emerald-600 bg-emerald-50/70 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400" },
  ];
  return mockPerformances[index % mockPerformances.length];
}

export function ReportCardStudentList({
  students,
  searchQuery = "",
  selectedGradeLabel,
}: ReportCardStudentListProps) {
  const filteredStudents = students.filter((student) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const nameMatch = student.full_name?.toLowerCase().includes(query);
    const rollMatch = student.roll_number?.toString().toLowerCase().includes(query);
    return nameMatch || rollMatch;
  });

  if (filteredStudents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-12 text-center text-muted-foreground bg-muted/20">
        <User className="size-12 stroke-[1.25] text-muted-foreground/60 mb-3" />
        <h3 className="font-serif text-lg font-medium text-foreground">No students found</h3>
        <p className="text-sm text-muted-foreground max-w-sm mt-1">
          {searchQuery
            ? `No students in ${selectedGradeLabel || "this class"} match "${searchQuery}".`
            : "No registered students in this class roster."}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {filteredStudents.map((student, index) => {
        const initials = (student.full_name || "S")
          .split(" ")
          .map((n) => n[0])
          .slice(0, 2)
          .join("")
          .toUpperCase();
        const avatarStyle = getAvatarBg(student.full_name || student.id);
        const performance = getMockPerformance(index);

        return (
          <Link
            key={student.id}
            href={`/report-card/${student.id}?name=${encodeURIComponent(student.full_name)}&grade=${encodeURIComponent(student.grade_label || selectedGradeLabel || "")}&roll=${encodeURIComponent(student.roll_number || "")}`}
            className="group block transition-transform active:scale-[0.99]"
          >
            <Card className="h-full border border-border/80 transition-all duration-200 hover:border-terracotta/40 hover:shadow-md dark:hover:border-terracotta/50 overflow-hidden">
              <CardContent className="p-5 flex flex-col justify-between h-full">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`size-12 rounded-full border flex items-center justify-center font-serif text-base font-semibold shadow-xs shrink-0 ${avatarStyle}`}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-serif text-base font-semibold text-foreground group-hover:text-terracotta transition-colors truncate">
                        {student.full_name}
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1 font-mono">
                          <Hash className="size-3 text-muted-foreground/70" />
                          Roll: {student.roll_number || "N/A"}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <GraduationCap className="size-3 text-muted-foreground/70" />
                          {student.grade_label || selectedGradeLabel || "Class"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="size-8 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground group-hover:bg-terracotta group-hover:text-white transition-all shrink-0">
                    <ChevronRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>

                <div className="pt-3 border-t border-hairline/60 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <Award className="size-3.5 text-terracotta" />
                    <span className="text-muted-foreground">Overall Performance:</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-md font-mono text-xs font-semibold border ${performance.colorClass}`}>
                    {performance.grade} ({performance.percentage})
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
