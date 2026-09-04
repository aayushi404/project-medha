"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  approveTeacher,
  getPendingTeachers,
  getPrincipalStats,
  getPrincipalStudents,
  getPrincipalTeachers,
  listFees,
  logFeePayment,
  rejectTeacher,
  type FeePayment,
  type PendingTeacher,
  type PrincipalStats,
  type StudentRosterItem,
  type TeacherRosterItem,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCopy } from "@/lib/copy";
import { RoleGate } from "@/components/auth/role-gate";
import { ConsoleShell } from "@/components/console/console-shell";
import { StatGrid } from "@/components/console/stat-grid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { AnnounceForm } from "@/components/notifications/announce-form";
import { FeesList } from "@/components/fees/fees-list";
import { PendingTeachers } from "@/components/principal/pending-teachers";
import { TeacherRoster } from "@/components/principal/teacher-roster";

function FeeLogSection() {
  const { accessToken } = useAuth();
  const copy = useCopy();
  const t = copy.feesPage;

  const [students, setStudents] = useState<StudentRosterItem[]>([]);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);

  const [amount, setAmount] = useState("");
  const [feeType, setFeeType] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    getPrincipalStudents(accessToken)
      .then((r) => {
        if (!active) return;
        setStudents(r);
        setStudentId(r[0]?.id ?? null);
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not load students."))
      .finally(() => {
        if (active) setLoadingStudents(false);
      });
    return () => {
      active = false;
    };
  }, [accessToken]);

  const loadPayments = useCallback(() => {
    if (!accessToken || !studentId) return;
    listFees(accessToken, studentId)
      .then(setPayments)
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not load payments."));
  }, [accessToken, studentId]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  async function submit() {
    if (!studentId || !amount.trim() || !feeType.trim() || !date) return;
    setSaving(true);
    try {
      await logFeePayment(accessToken, {
        student_id: studentId,
        amount: Number(amount),
        fee_type: feeType.trim(),
        payment_date: date,
        note: note.trim() || null,
      });
      toast.success(t.loggedToast);
      setAmount("");
      setFeeType("");
      setNote("");
      loadPayments();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not log payment.");
    } finally {
      setSaving(false);
    }
  }

  const studentOptions = students.map((s) => ({
    value: s.id,
    label: `${s.full_name} (${s.grade_label})`,
  }));

  if (loadingStudents) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Select
        value={studentId}
        onValueChange={setStudentId}
        options={studentOptions}
        placeholder={t.pickStudent}
      />

      {studentId && (
        <>
          <div className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <div className="flex flex-wrap gap-2">
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={t.amountLabel}
                className="w-32"
              />
              <Input
                value={feeType}
                onChange={(e) => setFeeType(e.target.value)}
                placeholder={t.typeLabel}
                className="w-40"
              />
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-40"
                aria-label={t.dateLabel}
              />
            </div>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t.noteLabel} />
            <Button
              onClick={() => void submit()}
              disabled={!amount.trim() || !feeType.trim() || !date || saving}
              className="self-start"
            >
              {saving ? t.logging : t.logBtn}
            </Button>
          </div>

          <FeesList payments={payments} />
        </>
      )}
    </div>
  );
}

function PrincipalDashboard() {
  const { accessToken } = useAuth();

  const [stats, setStats] = useState<PrincipalStats | null>(null);
  const [pending, setPending] = useState<PendingTeacher[]>([]);
  const [roster, setRoster] = useState<TeacherRosterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(() => {
    return Promise.all([
      getPrincipalStats(accessToken),
      getPendingTeachers(accessToken),
      getPrincipalTeachers(accessToken),
    ])
      .then(([s, p, r]) => {
        setStats(s);
        setPending(p);
        setRoster(r);
      })
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : "Could not load the dashboard.");
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
      throw e; // let RejectDialog keep itself open on failure
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ConsoleShell title="Principal">
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {stats && (
            <StatGrid
              stats={[
                { label: "Approved teachers", value: stats.teachers },
                { label: "Pending", value: stats.pending_teachers },
              ]}
            />
          )}

          <section>
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-foreground">
              Teacher applications
            </h2>
            <PendingTeachers
              teachers={pending}
              busyId={busyId}
              onApprove={(id) =>
                void act(id, () => approveTeacher(accessToken, id), "Teacher approved.")
              }
              onReject={(id, reason) =>
                act(id, () => rejectTeacher(accessToken, id, reason), "Application rejected.")
              }
            />
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-foreground">
              Your teachers
            </h2>
            <TeacherRoster teachers={roster} />
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-foreground">
              Announcements
            </h2>
            <AnnounceForm target={{ kind: "audience" }} />
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-foreground">Fees</h2>
            <FeeLogSection />
          </section>
        </div>
      )}
    </ConsoleShell>
  );
}

export default function PrincipalPage() {
  return (
    <RoleGate role="principal">
      <PrincipalDashboard />
    </RoleGate>
  );
}
