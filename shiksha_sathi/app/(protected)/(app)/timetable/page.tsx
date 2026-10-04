"use client";

import { SchoolDayBoard } from "@/components/timetable/school-day-board";

export default function TeacherTimetablePage() {
  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <SchoolDayBoard />
    </main>
  );
}
