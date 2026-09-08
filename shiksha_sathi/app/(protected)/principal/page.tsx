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

const SECTIONS = [
  { id: "principal-stats", labelEn: "Overview", labelHi: "डैशबोर्ड सारांश", icon: LayoutDashboard },
  { id: "principal-analytics", labelEn: "Attendance & Syllabus", labelHi: "उपस्थिति व सिलेबस", icon: ClipboardCheck },
  { id: "principal-notices", labelEn: "Notice Board", labelHi: "सूचना पट्ट", icon: Megaphone },
  { id: "principal-work-updates", labelEn: "Teacher Work Updates", labelHi: "शिक्षक कार्य अपडेट", icon: ClipboardPenLine },
  { id: "principal-pending-teachers", labelEn: "Teacher Approvals", labelHi: "शिक्षक अनुमोदन", icon: Users },
  { id: "principal-teachers", labelEn: "Staff Roster", labelHi: "शिक्षक दल", icon: Users },
  { id: "principal-students", labelEn: "Students", labelHi: "विद्यार्थी", icon: GraduationCap },
  { id: "principal-fees", labelEn: "Fees", labelHi: "शुल्क रिकॉर्ड", icon: IndianRupee },
];

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function PrincipalDashboard() {
  const { accessToken } = useAuth();
  const { locale } = useLocale();
  const isHi = locale === "hi";

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
    <ConsoleShell title="Principal" maxWidth="max-w-5xl">
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Hero Welcome Banner */}
          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-gradient-to-r from-amber-500/10 via-terracotta/5 to-transparent p-6 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-terracotta/15 px-3 py-0.5 text-xs font-bold text-terracotta">
                  {isHi ? "प्रधानाचार्य कक्ष" : "Principal Console"}
                </span>
                <span className="text-xs text-muted-foreground font-medium">• सत्र 2026-27</span>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                {isHi ? "कैंपस एक्टिव" : "Campus Active"}
              </span>
            </div>

            <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {isHi ? "नमस्ते, प्रधानाचार्य जी" : "Welcome, Principal"} <span className="align-middle">👋</span>
            </h1>

            <p className="text-xs sm:text-sm text-muted-foreground">
              {isHi
                ? "विद्यालय प्रबंधन, शिक्षक कार्य समीक्षा एवं स्मार्ट विश्लेषिकी डैशबोर्ड"
                : "Institutional management, teacher daily work reviews, notices, and analytics dashboard"}
            </p>

            <div className="mt-1 flex items-center gap-3">
              <span className="text-xs font-semibold text-foreground/85">
                {isHi ? "बड़े सपने शिक्षा के साथ • शिक्षा से समृद्ध बिहार" : "Building Bihar's Future Through Quality Education"}
              </span>
              <span
                aria-hidden
                className="h-[3px] w-20 rounded-full shrink-0"
                style={{ background: "linear-gradient(90deg, #FF9933 0%, #FFFFFF 50%, #138808 100%)" }}
              />
            </div>

            {/* Quick Section Jump Chips */}
            <div className="mt-4 flex flex-wrap items-center gap-1.5 pt-3 border-t border-border/60">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mr-1">
                {isHi ? "त्वरित लिंक:" : "Quick Jump:"}
              </span>
              {SECTIONS.map((s) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => scrollToSection(s.id)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-terracotta/40 hover:bg-terracotta/10 hover:text-terracotta"
                  >
                    <Icon className="size-3 text-terracotta" />
                    <span>{isHi ? s.labelHi : s.labelEn}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stats Grid */}
          {stats && (
            <section id="principal-stats">
              <StatGrid
                stats={[
                  { label: isHi ? "स्वीकृत शिक्षक" : "Approved teachers", value: stats.teachers },
                  { label: isHi ? "लंबित शिक्षक आवेदन" : "Pending teachers", value: stats.pending_teachers },
                  { label: isHi ? "स्वीकृत छात्र" : "Approved students", value: stats.students },
                  { label: isHi ? "लंबित छात्र प्रवेश" : "Pending students", value: stats.pending_students },
                ]}
              />
            </section>
          )}

          {/* 1. School Attendance & Syllabus Analytics */}
          <section id="principal-analytics" className="rounded-2xl border border-border bg-card p-6 shadow-xs">
            <PrincipalAnalyticsHub />
          </section>

          {/* 2. Official School Notice Board */}
          <section id="principal-notices" className="rounded-2xl border border-border bg-card p-6 shadow-xs">
            <PrincipalNoticeBoard />
          </section>

          {/* 3. Teacher Daily Work Updates Feed & 1-Click Appreciation */}
          <section id="principal-work-updates" className="rounded-2xl border border-border bg-card p-6 shadow-xs">
            <PrincipalWorkUpdatesFeed />
          </section>

          {/* 4. Teacher Applications & Approvals */}
          <section id="principal-pending-teachers" className="rounded-2xl border border-border bg-card p-6 shadow-xs">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold tracking-wide text-foreground">
                  {isHi ? "शिक्षक आवेदन (Teacher Applications)" : "Teacher Applications"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {isHi ? "नए शिक्षकों के पंजीकरण आवेदन स्वीकृत या अस्वीकृत करें" : "Review and approve new teacher registrations"}
                </p>
              </div>
              {pending.length > 0 && (
                <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                  {pending.length} {isHi ? "लंबित" : "pending"}
                </span>
              )}
            </div>
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

          {/* 5. Teacher Roster */}
          <section id="principal-teachers" className="rounded-2xl border border-border bg-card p-6 shadow-xs">
            <div className="mb-3">
              <h2 className="text-sm font-semibold tracking-wide text-foreground">
                {isHi ? "विद्यालय शिक्षक दल (Faculty Staff)" : "Faculty Staff"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {isHi ? "विद्यालय में अनुमोदित सभी सक्रिय शिक्षक" : "All approved teachers currently active"}
              </p>
            </div>
            <TeacherRoster teachers={roster} />
          </section>

          {/* 6. Students */}
          <section id="principal-students" className="rounded-2xl border border-border bg-card p-6 shadow-xs">
            <div className="mb-3">
              <h2 className="text-sm font-semibold tracking-wide text-foreground">
                {isHi ? "नामांकित विद्यार्थी (Students)" : "Enrolled Students"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {isHi ? "कक्षा-वार सभी नामांकित छात्र सूची" : "Class roster and student profiles"}
              </p>
            </div>
            <StudentRoster students={students} />
          </section>

          {/* 7. Direct Announcements */}
          <section id="principal-announcements" className="rounded-2xl border border-border bg-card p-6 shadow-xs">
            <div className="mb-3">
              <h2 className="text-sm font-semibold tracking-wide text-foreground">
                {isHi ? "सीधी घोषणा (Direct Announcement)" : "Direct Announcement"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {isHi ? "शिक्षकों या विद्यार्थियों को सीधा संदेश भेजें" : "Broadcast direct notices to staff or students"}
              </p>
            </div>
            <AnnounceForm target={{ kind: "audience" }} />
          </section>

          {/* 8. Fees */}
          <section id="principal-fees" className="rounded-2xl border border-border bg-card p-6 shadow-xs">
            <div className="mb-3">
              <h2 className="text-sm font-semibold tracking-wide text-foreground">
                {isHi ? "शुल्क प्रबंधन (Fees)" : "Fee Management"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {isHi ? "छात्रों के शुल्क भुगतान की रसीद दर्ज करें और देखें" : "Log student fee payments and view records"}
              </p>
            </div>
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
