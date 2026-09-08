"use client";

import { useCallback, useEffect, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import {
  BookOpen,
  ClipboardCheck,
  ClipboardPenLine,
  GraduationCap,
  IndianRupee,
  LayoutDashboard,
  Loader2,
  LogOut,
  Megaphone,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
import { LanguageToggle } from "@/components/app/language-toggle";
import { NotificationBell } from "@/components/notifications/notification-bell";
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

interface PrincipalNavItem {
  id: string;
  labelEn: string;
  labelHi: string;
  icon: LucideIcon;
}

const PRINCIPAL_SIDEBAR_NAV: PrincipalNavItem[] = [
  { id: "principal-overview", labelEn: "Overview", labelHi: "डैशबोर्ड सारांश", icon: LayoutDashboard },
  { id: "principal-analytics", labelEn: "Attendance & Syllabus", labelHi: "उपस्थिति व सिलेबस", icon: ClipboardCheck },
  { id: "principal-notices", labelEn: "Notice Board", labelHi: "सूचना पट्ट (Notices)", icon: Megaphone },
  { id: "principal-work-updates", labelEn: "Teacher Work Updates", labelHi: "शिक्षक कार्य अपडेट", icon: ClipboardPenLine },
  { id: "principal-pending-teachers", labelEn: "Teacher Approvals", labelHi: "शिक्षक अनुमोदन", icon: UserPlus },
  { id: "principal-teachers", labelEn: "Faculty Staff", labelHi: "शिक्षक दल", icon: Users },
  { id: "principal-students", labelEn: "Students", labelHi: "विद्यार्थी सूची", icon: GraduationCap },
  { id: "principal-fees", labelEn: "Fee Records", labelHi: "शुल्क विवरण", icon: IndianRupee },
];

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

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function PrincipalDashboard() {
  const { teacher, accessToken, logout } = useAuth();
  const { locale } = useLocale();
  const isHi = locale === "hi";

  const [collapsed, setCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("principal-overview");

  const [stats, setStats] = useState<PrincipalStats | null>(null);
  const [pending, setPending] = useState<PendingTeacher[]>([]);
  const [roster, setRoster] = useState<TeacherRosterItem[]>([]);
  const [students, setStudents] = useState<StudentRosterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const principalName = teacher?.full_name?.trim() || "ADITYA PRABHAKAR";
  const principalEmail = teacher?.email?.trim() || "aditya4212@gmail.com";
  const initial = (principalName[0] || "A").toUpperCase();

  const reload = useCallback(() => {
    if (!accessToken) return Promise.resolve();
    return Promise.all([
      getPrincipalStats(accessToken).catch(() => null),
      getPendingTeachers(accessToken).catch(() => []),
      getPrincipalTeachers(accessToken).catch(() => []),
      getPrincipalStudents(accessToken).catch(() => []),
    ])
      .then(([s, p, r, st]) => {
        if (s) setStats(s);
        if (p) setPending(p);
        if (r) setRoster(r);
        if (st) setStudents(st);
      })
      .catch(() => {});
  }, [accessToken]);

  useEffect(() => {
    let active = true;
    if (!accessToken) {
      setLoading(false);
      return;
    }
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
      throw e;
    } finally {
      setBusyId(null);
    }
  }

  const renderNavItems = (onItemClick?: () => void) => (
    <nav className="flex flex-col gap-1 p-2">
      {!collapsed && (
        <span className="eyebrow px-3 pt-1 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {isHi ? "प्रशासनिक मेनू" : "Principal Menu"}
        </span>
      )}
      {PRINCIPAL_SIDEBAR_NAV.map((item) => {
        const Icon = item.icon;
        const isActive = activeSection === item.id;
        const label = isHi ? item.labelHi : item.labelEn;
        const badge = item.id === "principal-pending-teachers" && pending.length > 0 ? pending.length : null;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setActiveSection(item.id);
              scrollToSection(item.id);
              onItemClick?.();
            }}
            title={collapsed ? label : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-medium transition-colors text-left",
              collapsed && "justify-center px-0",
              isActive
                ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground shadow-xs"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
            )}
          >
            <div className="relative flex size-4 shrink-0 items-center justify-center">
              <Icon
                className={cn(
                  "size-4 shrink-0 transition-colors",
                  isActive ? "text-terracotta" : "text-sidebar-foreground/60",
                )}
              />
              {item.id === "principal-work-updates" && (
                <span className="absolute -top-1 -right-1 size-2 animate-pulse rounded-full bg-emerald-500 ring-2 ring-background" />
              )}
            </div>

            {!collapsed && (
              <div className="flex flex-1 items-center justify-between min-w-0">
                <span className="truncate">{label}</span>
                {badge !== null && (
                  <span className="rounded-full bg-amber-500/20 px-1.5 py-0.2 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                    {badge}
                  </span>
                )}
                {item.id === "principal-work-updates" && (
                  <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.2 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    Live
                  </span>
                )}
              </div>
            )}
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="app-shell flex h-dvh flex-col overflow-hidden bg-background text-foreground md:flex-row">
      {/* 1. Desktop Left Sidebar (side me open karne wala) */}
      <aside
        className={cn(
          "hidden h-dvh shrink-0 flex-col overflow-hidden bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-[width] duration-200 md:flex",
          collapsed ? "w-16" : "w-60",
        )}
      >
        {/* Brand with Medha Logo */}
        <div
          className={cn(
            "flex flex-col items-center justify-center px-4 pt-4 pb-2 text-center",
            collapsed && "px-2",
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/Logo.jpeg"
            alt="Medha"
            className={cn(
              "object-contain transition-all",
              collapsed ? "size-9 rounded-full" : "h-24 w-auto drop-shadow-xs",
            )}
          />
          {!collapsed && (
            <div className="mt-1">
              <span className="inline-block rounded-full bg-terracotta/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-terracotta uppercase">
                Principal Desk
              </span>
              <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                नालंदा विद्यापीठ
              </p>
            </div>
          )}
        </div>

        {/* Sidebar Nav List */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {renderNavItems()}

          {!collapsed && (
            <div className="mt-auto p-2">
              <div className="rounded-xl border border-sidebar-border bg-card/60 p-3 text-center">
                <p className="text-[11px] font-serif leading-snug text-sidebar-foreground/80">
                  &ldquo;विद्या ददाति विनयं&rdquo;
                </p>
                <span
                  className="mx-auto mt-2 block h-[2px] w-12 rounded-full"
                  style={{ background: "linear-gradient(90deg, #FF9933, #FFFFFF, #138808)" }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Footer with Language Toggle, Notifications, Profile and Collapse */}
        <div
          className={cn(
            "flex flex-col gap-2 border-t border-sidebar-border p-2",
            collapsed && "items-center",
          )}
        >
          {!collapsed && (
            <div className="flex items-center gap-1 self-stretch px-1">
              <LanguageToggle className="self-start" />
              <NotificationBell className="ml-auto" />
            </div>
          )}

          {collapsed ? (
            <button
              type="button"
              onClick={() => void logout()}
              title={`Log out (${principalName})`}
              className="flex size-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
            >
              <LogOut className="size-4" />
            </button>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-2 text-left">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-terracotta/15 text-xs font-semibold text-terracotta">
                {initial}
              </span>
              <div className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-foreground">
                  {principalName}
                </span>
                <span className="block truncate text-[10px] text-muted-foreground">
                  {principalEmail}
                </span>
              </div>
              <button
                type="button"
                onClick={() => void logout()}
                title="Log out"
                aria-label="Log out"
                className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <LogOut className="size-3.5" />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-sidebar-border py-1.5 text-xs text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-3.5" />
            ) : (
              <>
                <PanelLeftClose className="size-3.5" /> Collapse
              </>
            )}
          </button>
        </div>
      </aside>

      {/* 2. Mobile Header with Hamburger Drawer */}
      <div className="flex items-center gap-2 border-b border-sidebar-border bg-sidebar px-3 py-2 text-sidebar-foreground md:hidden">
        <Dialog.Root open={mobileDrawerOpen} onOpenChange={setMobileDrawerOpen}>
          <Dialog.Trigger
            aria-label="Menu"
            className="flex size-9 items-center justify-center rounded-xl outline-hidden hover:bg-sidebar-accent focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Menu className="size-5" />
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0" />
            <Dialog.Popup className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col overflow-hidden bg-sidebar text-sidebar-foreground shadow-xl transition-transform duration-200 data-ending-style:-translate-x-full data-starting-style:-translate-x-full">
              <div className="flex items-center justify-center p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/Logo.jpeg" alt="Medha" className="h-16 w-auto object-contain" />
              </div>
              <div className="flex-1 overflow-y-auto">
                {renderNavItems(() => setMobileDrawerOpen(false))}
              </div>
              <div className="border-t border-sidebar-border p-3">
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  <LogOut className="size-3.5" /> Log out ({principalName})
                </button>
              </div>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/Logo.jpeg" alt="Medha" className="h-8 w-auto object-contain" />
        <span className="font-serif text-xs font-semibold tracking-wider uppercase text-terracotta">
          Principal Desk
        </span>
        <NotificationBell className="ml-auto" />
        <LanguageToggle />
      </div>

      {/* 3. Main Scrollable Dashboard Content */}
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-background">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-8 space-y-6">
          {/* Welcome Banner */}
          <div id="principal-overview" className="flex flex-col gap-2 rounded-2xl border border-border bg-gradient-to-r from-amber-500/10 via-terracotta/5 to-transparent p-6 shadow-xs">
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
              {isHi ? `नमस्ते, ${principalName}` : `Welcome, ${principalName}`} <span className="align-middle">👋</span>
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
          </div>

          {/* Quick Metrics Bar */}
          {stats && (
            <div id="principal-stats">
              <StatGrid
                stats={[
                  { label: isHi ? "स्वीकृत शिक्षक" : "Approved teachers", value: stats.teachers },
                  { label: isHi ? "लंबित शिक्षक आवेदन" : "Pending teachers", value: stats.pending_teachers },
                  { label: isHi ? "स्वीकृत छात्र" : "Approved students", value: stats.students },
                  { label: isHi ? "लंबित छात्र प्रवेश" : "Pending students", value: stats.pending_students },
                ]}
              />
            </div>
          )}

          {/* Feature 1: School Attendance & Syllabus Analytics (Smart graphs & percentages) */}
          <section id="principal-analytics" className="rounded-2xl border border-border bg-card p-6 shadow-xs">
            <PrincipalAnalyticsHub />
          </section>

          {/* Feature 2: Official School Notice Board (Quick Notice / Circular) */}
          <section id="principal-notices" className="rounded-2xl border border-border bg-card p-6 shadow-xs">
            <PrincipalNoticeBoard />
          </section>

          {/* Feature 3 & 4: Teacher Work Updates Feed & 1-Click Appreciation */}
          <section id="principal-work-updates" className="rounded-2xl border border-border bg-card p-6 shadow-xs">
            <PrincipalWorkUpdatesFeed />
          </section>

          {/* Feature 5: Teacher Applications & Approvals */}
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

          {/* Feature 6: Faculty Roster */}
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

          {/* Feature 7: Students Directory */}
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

          {/* Feature 8: Direct Announcements */}
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

          {/* Feature 9: Fee Management */}
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
      </div>
    </div>
  );
}

export default function PrincipalPage() {
  return (
    <RoleGate role={["principal", "teacher", "admin"]}>
      <PrincipalDashboard />
    </RoleGate>
  );
}
