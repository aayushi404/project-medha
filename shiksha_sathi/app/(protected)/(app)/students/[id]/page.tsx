"use client";

import { useParams } from "next/navigation";

import { StudentProfileView } from "@/components/students/student-profile";

/** A teacher's view of one student. The server limits it to the teacher's classes. */
export default function TeacherStudentProfilePage() {
  const params = useParams<{ id: string }>();

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="mx-auto w-full max-w-3xl">
          <StudentProfileView studentId={params.id} backHref="/students" />
        </div>
      </div>
    </main>
  );
}
