"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ArrowLeft } from "lucide-react";

import { LanguageToggle } from "@/components/app/language-toggle";
import { PendingScreen } from "@/components/auth/pending-screen";
import { RejectedNotice } from "@/components/auth/rejected-notice";
import {
  StudentLoginFlowContext,
  type StudentLoginFlow,
  type StudentLoginOutcome,
} from "@/components/auth/student-login-flow";
import type { StudentProfileSummary } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCopy } from "@/lib/copy";

/**
 * Frame for the three student steps. The state here survives moves between
 * the steps (a layout stays mounted across client-side navigation) and is
 * dropped on a refresh, which returns the student to the phone step.
 */
export default function StudentLoginLayout({ children }: { children: ReactNode }) {
  const copy = useCopy();
  const router = useRouter();
  const { status } = useAuth();

  const [phone, setPhone] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<StudentProfileSummary[]>([]);
  const [selected, setSelected] = useState<StudentProfileSummary | null>(null);
  const [outcome, setOutcome] = useState<StudentLoginOutcome | null>(null);

  // Once the password step establishes a session, leave the login screens.
  useEffect(() => {
    if (status === "authenticated") router.replace("/home");
  }, [status, router]);

  const flow: StudentLoginFlow = useMemo(
    () => ({
      phone,
      profiles,
      selected,
      outcome,
      begin: (nextPhone, nextProfiles) => {
        setPhone(nextPhone);
        setProfiles(nextProfiles);
        setSelected(null);
        setOutcome(null);
      },
      choose: setSelected,
      setOutcome,
      restart: () => {
        setPhone(null);
        setProfiles([]);
        setSelected(null);
        setOutcome(null);
      },
    }),
    [phone, profiles, selected, outcome],
  );

  return (
    <StudentLoginFlowContext.Provider value={flow}>
      <main className="mlogin-root">
        <motion.div
          className="mlogin-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, ease: "easeOut" }}
        >
          <div className="flex items-center justify-between gap-2">
            <Link href="/login" className="mlogin-link-muted inline-flex items-center gap-1">
              <ArrowLeft size={13} /> {copy.login.backToAllLogins}
            </Link>
            <LanguageToggle />
          </div>

          <div className="mlogin-heading">
            <h1>{copy.login.studentTitle}</h1>
            <p>{copy.login.studentSubtitle}</p>
          </div>

          {outcome?.kind === "pending" && <PendingScreen message={copy.login.pendingMessage} />}
          {outcome?.kind === "rejected" && (
            <RejectedNotice
              reason={outcome.reason}
              onBack={() => {
                flow.restart();
                router.replace("/login/student");
              }}
            />
          )}
          {!outcome && children}
        </motion.div>
      </main>
    </StudentLoginFlowContext.Provider>
  );
}
