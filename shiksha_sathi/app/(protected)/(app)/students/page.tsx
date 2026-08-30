"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  approveStudent,
  getPendingStudents,
  getStudentRoster,
  getTeacherStudentStats,
  rejectStudent,
  type PendingStudent,
  type StudentRosterItem,
  type TeacherStudentStats,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { StatGrid } from "@/components/console/stat-grid";
import { PendingStudents } from "@/components/students/pending-students";
import { StudentRoster } from "@/components/students/student-roster";

export default function StudentsPage() {
  const { accessToken } = useAuth();

  const [stats, setStats] = useState<TeacherStudentStats | null>(null);
  const [pending, setPending] = useState<PendingStudent[]>([]);
  const [roster, setRoster] = useState<StudentRosterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(() => {
    return Promise.all([
      getTeacherStudentStats(accessToken),
      getPendingStudents(accessToken),
      getStudentRoster(accessToken),
    ])
      .then(([s, p, r]) => {
        setStats(s);
        setPending(p);
        setRoster(r);
      })
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : "Could not load students.");
      });
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    reload().finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [accessToken, reload]);

  async function act(id: string, run: () => Promise<unknown>, ok: string) {
    setBusyId(id);
    try {
      await run();
      toast.success(ok);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
      throw e; // keep RejectDialog open on failure
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <h1 className="text-[15px]">Students</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Approve students who register for your school, then they can ask Medha
          their doubts.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {stats && (
                <StatGrid
                  stats={[
                    { label: "Approved students", value: stats.students },
                    { label: "Pending", value: stats.pending_students },
                  ]}
                />
              )}

              <section>
                <h2 className="mb-3 text-sm font-semibold tracking-wide text-foreground">
                  Registrations
                </h2>
                <PendingStudents
                  students={pending}
                  busyId={busyId}
                  onApprove={(id) =>
                    void act(id, () => approveStudent(accessToken, id), "Student approved.")
                  }
                  onReject={(id, reason) =>
                    act(
                      id,
                      () => rejectStudent(accessToken, id, reason),
                      "Registration rejected.",
                    )
                  }
                />
              </section>

              <section>
                <h2 className="mb-3 text-sm font-semibold tracking-wide text-foreground">
                  Your students
                </h2>
                <StudentRoster students={roster} />
              </section>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
