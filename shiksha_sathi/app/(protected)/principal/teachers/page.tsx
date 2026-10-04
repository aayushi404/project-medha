"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  approveTeacher,
  getPendingTeachers,
  getPrincipalTeachers,
  rejectTeacher,
  type PendingTeacher,
  type TeacherRosterItem,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { RoleGate } from "@/components/auth/role-gate";
import { PendingTeachers } from "@/components/principal/pending-teachers";
import { PrincipalShell } from "@/components/principal/principal-shell";
import { TeacherRoster } from "@/components/principal/teacher-roster";

type Tab = "approvals" | "faculty";

function TeachersPageContent() {
  const { accessToken } = useAuth();
  const { locale } = useLocale();
  const isHi = locale === "hi";

  const [pending, setPending] = useState<PendingTeacher[]>([]);
  const [roster, setRoster] = useState<TeacherRosterItem[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  // null until the first choice: open "Approvals" when something is waiting, else "Faculty"
  const [tab, setTab] = useState<Tab | null>(null);

  const reload = useCallback(() => {
    if (!accessToken) return Promise.resolve();
    return Promise.all([
      getPendingTeachers(accessToken).catch(() => null),
      getPrincipalTeachers(accessToken).catch(() => null),
    ]).then(([p, r]) => {
      if (p) setPending(p);
      if (r) setRoster(r);
    });
  }, [accessToken]);

  useEffect(() => {
    void reload();
  }, [reload]);

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

  const active: Tab = tab ?? (pending.length > 0 ? "approvals" : "faculty");
  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "approvals", label: isHi ? "शिक्षक अनुमोदन" : "Approvals", count: pending.length },
    { id: "faculty", label: isHi ? "शिक्षक दल" : "Faculty staff", count: roster.length },
  ];

  return (
    <PrincipalShell activeId="principal-teachers">
      <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6 sm:px-8">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">
            {isHi ? "शिक्षक" : "Teachers"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isHi
              ? "नए शिक्षकों के आवेदन स्वीकृत करें और विद्यालय के शिक्षक दल को देखें"
              : "Approve new teacher applications, and see everyone on the faculty"}
          </p>
        </div>

        <div role="tablist" aria-label={isHi ? "शिक्षक" : "Teachers"} className="flex gap-1 border-b border-border">
          {tabs.map((t) => {
            const selected = active === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setTab(t.id)}
                className={cn(
                  "-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  selected
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs",
                    t.id === "approvals" && t.count > 0
                      ? "bg-amber-500/15 font-bold text-amber-600 dark:text-amber-400"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>

        <section
          role="tabpanel"
          aria-label={tabs.find((t) => t.id === active)?.label}
          className="rounded-2xl border border-border bg-card p-6 shadow-xs"
        >
          {active === "approvals" ? (
            <>
              <p className="mb-4 text-xs text-muted-foreground">
                {isHi
                  ? "नए शिक्षकों के पंजीकरण आवेदन स्वीकृत या अस्वीकृत करें"
                  : "Review and approve new teacher registrations"}
              </p>
              <PendingTeachers
                teachers={pending}
                busyId={busyId}
                onApprove={(id) => void act(id, () => approveTeacher(accessToken, id), "Teacher approved.")}
                onReject={(id, reason) =>
                  act(id, () => rejectTeacher(accessToken, id, reason), "Application rejected.")
                }
              />
            </>
          ) : (
            <>
              <p className="mb-4 text-xs text-muted-foreground">
                {isHi ? "विद्यालय में अनुमोदित सभी सक्रिय शिक्षक" : "All approved teachers currently active"}
              </p>
              <TeacherRoster teachers={roster} />
            </>
          )}
        </section>
      </div>
    </PrincipalShell>
  );
}

export default function PrincipalTeachersPage() {
  return (
    <RoleGate role={["principal"]}>
      <TeachersPageContent />
    </RoleGate>
  );
}
