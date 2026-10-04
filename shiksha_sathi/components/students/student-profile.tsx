"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Loader2, Mail, Phone, User } from "lucide-react";
import { toast } from "sonner";

import { ResetCodePanel } from "@/components/auth/reset-code-panel";
import { RejectDialog } from "@/components/console/reject-dialog";
import { Button } from "@/components/ui/button";
import { ProfileImage } from "@/components/ui/profile-image";
import {
  approveStudent,
  getStudentProfile,
  issueStudentResetCode,
  rejectStudent,
  type ResetCodeIssued,
  type StudentProfile,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCopy } from "@/lib/copy";
import { formatIndianPhone } from "@/lib/phone-format";

type Props = {
  studentId: string;
  /** where the back button goes, e.g. "/students" or "/principal" */
  backHref: string;
};

/**
 * The student's full profile, shared by the teacher's and the principal's
 * routes. The server decides who may open it and which actions they get
 * (`profile.viewer`); this component only shows what it's given.
 */
export function StudentProfileView({ studentId, backHref }: Props) {
  const { accessToken } = useAuth();
  const copy = useCopy();
  const router = useRouter();

  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<ResetCodeIssued | null>(null);

  const load = useCallback(() => {
    if (!accessToken) return Promise.resolve();
    return getStudentProfile(accessToken, studentId)
      .then(setProfile)
      .catch((e: unknown) => {
        setNotFound(true);
        toast.error(e instanceof Error ? e.message : copy.students.notFound);
      });
  }, [accessToken, studentId, copy.students.notFound]);

  useEffect(() => {
    void load();
  }, [load]);

  async function approve() {
    if (!accessToken) return;
    setBusy(true);
    try {
      await approveStudent(accessToken, studentId);
      toast.success(copy.students.approved);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : copy.students.loadFailed);
    } finally {
      setBusy(false);
    }
  }

  async function reject(reason: string) {
    if (!accessToken) return;
    try {
      await rejectStudent(accessToken, studentId, reason);
      toast.success(copy.students.rejected);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : copy.students.loadFailed);
      throw e; // keep the dialog open so the reason can be corrected
    }
  }

  async function resetCode() {
    if (!accessToken) return;
    setBusy(true);
    try {
      setIssued(await issueStudentResetCode(accessToken, studentId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : copy.resetCode.failed);
    } finally {
      setBusy(false);
    }
  }

  const back = (
    <button
      type="button"
      onClick={() => router.push(backHref)}
      className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
      aria-label={copy.students.back}
    >
      <ChevronLeft className="size-4" />
    </button>
  );

  if (notFound) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-sm text-muted-foreground">{copy.students.notFound}</p>
        <button type="button" onClick={() => router.push(backHref)} className="text-xs font-medium text-terracotta hover:underline">
          {copy.students.back}
        </button>
      </div>
    );
  }

  if (profile === null) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const phone = formatIndianPhone(profile.login_phone);
  const classLine = profile.grade_label && profile.section ? `${profile.grade_label} · ${profile.section}` : copy.students.noClassSet;
  const { viewer } = profile;
  const hasActions = viewer.can_approve || viewer.can_reject;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        {back}
        <h1 className="text-lg font-semibold text-foreground">{copy.students.profileTitle}</h1>
      </div>

      <section className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10 sm:p-6">
        <div className="flex items-center gap-4">
          <ProfileImage url={profile.photo_url} name={profile.full_name} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-foreground">{profile.full_name}</h2>
            <p className="truncate text-sm text-muted-foreground">
              {classLine}
              {profile.roll_number != null ? ` · ${copy.students.roll(String(profile.roll_number))}` : ""}
            </p>
          </div>
          <StatusChip status={profile.approval_status} />
        </div>

        {hasActions && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
            {viewer.can_approve && (
              <Button size="sm" onClick={approve} disabled={busy} aria-label={copy.students.approvePending}>
                {copy.students.approve}
              </Button>
            )}
            {viewer.can_reject && (
              <RejectDialog
                subjectName={profile.full_name}
                onConfirm={reject}
                trigger={
                  <Button variant="destructive" size="sm" disabled={busy} aria-label={copy.students.rejectPending}>
                    {copy.students.reject}
                  </Button>
                }
              />
            )}
          </div>
        )}
      </section>

      <Section title={copy.students.contact}>
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <Field label={copy.students.phone} icon={<Phone className="size-3.5" />}>
            {phone ? (
              <a href={`tel:${profile.login_phone}`} className="text-terracotta hover:underline">
                {phone}
              </a>
            ) : (
              "—"
            )}
          </Field>
          <Field label={copy.students.email} icon={<Mail className="size-3.5" />}>
            {profile.email ?? <span className="text-muted-foreground">{copy.students.noEmail}</span>}
          </Field>
        </dl>
      </Section>

      <Section title={copy.students.guardian}>
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <Field label={copy.students.guardianName} icon={<User className="size-3.5" />}>
            {profile.guardian_name ?? "—"}
          </Field>
          <Field label={copy.students.guardianRelation}>{profile.guardian_relation ?? "—"}</Field>
          <Field label={copy.students.guardianPhone} icon={<Phone className="size-3.5" />}>
            {profile.guardian_phone ? (
              <a href={`tel:${profile.guardian_phone.replace(/\s/g, "")}`} className="text-terracotta hover:underline">
                {profile.guardian_phone}
              </a>
            ) : (
              "—"
            )}
          </Field>
        </dl>
      </Section>

      <Section title={copy.students.enrolment}>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <Field label={copy.students.classLabel}>{classLine}</Field>
          <Field label={copy.students.rollLabel}>{profile.roll_number ?? "—"}</Field>
          <Field label={copy.students.yearLabel}>{profile.academic_year_label ?? "—"}</Field>
          <Field label={copy.students.classTeacher}>{profile.class_teacher_name ?? "—"}</Field>
          <Field label={copy.students.approvedOn}>
            {profile.approved_at ? new Date(profile.approved_at).toLocaleDateString() : "—"}
          </Field>
        </dl>
      </Section>

      {viewer.can_reset_login && (
        <Section title={copy.students.loginSection}>
          <p className="mb-3 text-xs text-muted-foreground">{copy.students.loginHint}</p>
          {issued ? (
            <ResetCodePanel issued={issued} onClose={() => setIssued(null)} />
          ) : (
            <Button variant="outline" size="sm" onClick={resetCode} disabled={busy}>
              {busy ? copy.resetCode.issuing : copy.resetCode.button}
            </Button>
          )}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10 sm:p-6">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 text-xs text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-foreground">{children}</dd>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const copy = useCopy();
  const styles: Record<string, string> = {
    approved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    rejected: "bg-destructive/10 text-destructive",
  };
  const labels: Record<string, string> = {
    approved: copy.students.approvedChip,
    pending: copy.students.pendingChip,
    rejected: copy.students.rejectedChip,
  };
  return (
    <span className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium ${styles[status] ?? "bg-muted text-muted-foreground"}`}>
      {labels[status] ?? status}
    </span>
  );
}
