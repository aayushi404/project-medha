"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ClipboardCheck,
  ClipboardPenLine,
  GraduationCap,
  IndianRupee,
  LayoutDashboard,
  Loader2,
  Megaphone,
  Users,
} from "lucide-react";
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
import { useCopy, useLocale } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { RoleGate } from "@/components/auth/role-gate";
import { ConsoleShell } from "@/components/console/console-shell";
import { StatGrid } from "@/components/console/stat-grid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { AnnounceForm } from "@/components/notifications/announce-form";
import { FeesList } from "@/components/fees/fees-list";
import { PendingTeachers } from "@/components/principal/pending-teachers";
import { PrincipalAnalyticsHub } from "@/components/principal/principal-analytics";
import { PrincipalNoticeBoard } from "@/components/principal/principal-notice-board";
import { PrincipalWorkUpdatesFeed } from "@/components/principal/principal-work-updates";
import { TeacherRoster } from "@/components/principal/teacher-roster";
import { StudentRoster } from "@/components/students/student-roster";

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

type PrincipalTab =
  | "all"
  | "analytics"
  | "work-updates"
  | "notices"
  | "teachers"
  | "students"
  | "fees";

const PRINCIPAL_TABS = [
  { id: "all" as const, labelEn: "Overview", labelHi: "डैशबोर्ड सारांश", icon: LayoutDashboard },
  { id: "analytics" as const, labelEn: "Attendance & Syllabus", labelHi: "उपस्थिति व सिलेबस", icon: ClipboardCheck },
  { id: "work-updates" as const, labelEn: "Teacher Work Updates", labelHi: "शिक्षक कार्य अपडेट", icon: ClipboardPenLine },
  { id: "notices" as const, labelEn: "Notice Board", labelHi: "सूचना पट्ट", icon: Megaphone },
  { id: "teachers" as const, labelEn: "Teachers & Staff", labelHi: "शिक्षक दल", icon: Users },
  { id: "students" as const, labelEn: "Students", labelHi: "विद्यार्थी", icon: GraduationCap },
  { id: "fees" as const, labelEn: "Fee Records", labelHi: "शुल्क रिकॉर्ड", icon: IndianRupee },
];

function PrincipalDashboard() {
  const { accessToken } = useAuth();
  const { locale } = useLocale();
  const isHi = locale === "hi";

  const [activeTab, setActiveTab] = useState<PrincipalTab>("all");
  const [stats, setStats] = useState<PrincipalStats | null>(null);
  const [pending, setPending] = useState<PendingTeacher[]>([]);
  const [roster, setRoster] = useState<TeacherRosterItem[]>([]);
  const [students, setStudents] = useState<StudentRosterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(() => {
    return Promise.all([
      getPrincipalStats(accessToken),
      getPendingTeachers(accessToken),
      getPrincipalTeachers(accessToken),
      getPrincipalStudents(accessToken),
    ])
      .then(([s, p, r, st]) => {
        setStats(s);
        setPending(p);
        setRoster(r);
        setStudents(st);
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
    <ConsoleShell title="Principal" maxWidth="max-w-7xl">
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[230px_1fr] gap-6 items-start">
          {/* Side Icon Navigation Bar */}
          <aside className="sticky top-20 flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 rounded-2xl bg-card/85 p-2 border border-border shadow-xs backdrop-blur-sm">
            <div className="hidden lg:block px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {isHi ? "त्वरित मेनू" : "Navigation"}
            </div>
            {PRINCIPAL_TABS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-medium transition-all text-left whitespace-nowrap",
                    isActive
                      ? "bg-terracotta text-white shadow-sm shadow-terracotta/20 font-semibold"
                      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                  )}
                >
                  <Icon className={cn("size-4 shrink-0", isActive ? "text-white" : "text-terracotta")} />
                  <span className="truncate">{isHi ? item.labelHi : item.labelEn}</span>
                  {item.id === "teachers" && pending.length > 0 && (
                    <span
                      className={cn(
                        "ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                        isActive
                          ? "bg-white text-terracotta"
                          : "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                      )}
                    >
                      {pending.length}
                    </span>
                  )}
                </button>
              );
            })}
          </aside>

          {/* Main Content Pane */}
          <div className="flex flex-col gap-8 min-w-0">
            {(activeTab === "all" || activeTab === "analytics") && stats && (
              <StatGrid
                stats={[
                  { label: "Approved teachers", value: stats.teachers },
                  { label: "Pending teachers", value: stats.pending_teachers },
                  { label: "Approved students", value: stats.students },
                  { label: "Pending students", value: stats.pending_students },
                ]}
              />
            )}

            {/* 1. School Attendance & Syllabus Analytics (Smart graphs & percentages) */}
            {(activeTab === "all" || activeTab === "analytics") && (
              <section id="principal-analytics">
                <PrincipalAnalyticsHub />
              </section>
            )}

            {/* 2. Official School Notice Board (सूचना पट्ट) */}
            {(activeTab === "all" || activeTab === "notices") && (
              <section id="principal-notices">
                <PrincipalNoticeBoard />
              </section>
            )}

            {/* 3. Teacher Daily Work Updates Feed & 1-Click Appreciation */}
            {(activeTab === "all" || activeTab === "work-updates") && (
              <section id="principal-work-updates">
                <PrincipalWorkUpdatesFeed />
              </section>
            )}

            {/* Teacher Applications & Roster */}
            {(activeTab === "all" || activeTab === "teachers") && (
              <>
                <section id="principal-pending-teachers">
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

                <section id="principal-teachers">
                  <h2 className="mb-3 text-sm font-semibold tracking-wide text-foreground">
                    Your teachers
                  </h2>
                  <TeacherRoster teachers={roster} />
                </section>
              </>
            )}

            {/* Students */}
            {(activeTab === "all" || activeTab === "students") && (
              <section id="principal-students">
                <h2 className="mb-3 text-sm font-semibold tracking-wide text-foreground">
                  Students
                </h2>
                <StudentRoster students={students} />
              </section>
            )}

            {/* Announcements */}
            {(activeTab === "all" || activeTab === "notices") && (
              <section id="principal-announcements">
                <h2 className="mb-3 text-sm font-semibold tracking-wide text-foreground">
                  Direct Announcements
                </h2>
                <AnnounceForm target={{ kind: "audience" }} />
              </section>
            )}

            {/* Fees */}
            {(activeTab === "all" || activeTab === "fees") && (
              <section id="principal-fees">
                <h2 className="mb-3 text-sm font-semibold tracking-wide text-foreground">Fees</h2>
                <FeeLogSection />
              </section>
            )}
          </div>
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
