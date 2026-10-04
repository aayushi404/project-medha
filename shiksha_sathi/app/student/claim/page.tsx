"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { SchoolTypeahead } from "@/components/auth/school-typeahead";
import { SimpleAuthCard } from "@/components/auth/simple-auth-card";
import { Select } from "@/components/ui/select";
import {
  claimStudentAccount,
  getGrades,
  getRegistrationClassSections,
  type ClassSectionOption,
  type Grade,
  type SchoolSearchResult,
} from "@/lib/api";
import { passwordProblem } from "@/lib/password-policy";
import { isIndianMobile, normalizeMobile } from "@/lib/validation/auth";

/**
 * For students whose school imported them from a CSV without an email: they
 * prove who they are with the details the school recorded, then set their own
 * login. (Imported students who were given an email are sent a set-password
 * link instead and never need this page.)
 */
export default function ClaimAccountPage() {
  const [school, setSchool] = useState<SchoolSearchResult | null>(null);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [gradeId, setGradeId] = useState<string | null>(null);
  const [sections, setSections] = useState<ClassSectionOption[] | null>(null);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [roll, setRoll] = useState("");
  const [name, setName] = useState("");
  const [loginPhone, setLoginPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    getGrades()
      .then(setGrades)
      .catch(() => {});
  }, []);

  // sections depend on (school, class); changing either clears the stale list
  // at the handler, so this effect only ever fetches
  useEffect(() => {
    if (!school || !gradeId) return;
    let active = true;
    getRegistrationClassSections(school.id, gradeId)
      .then((r) => active && setSections(r))
      .catch(() => active && setSections([]));
    return () => {
      active = false;
    };
  }, [school, gradeId]);

  const sectionsLoading = !!school && !!gradeId && sections === null;
  const rollNumber = /^\d{1,3}$/.test(roll.trim()) ? Number(roll.trim()) : 0;
  const problem = password ? passwordProblem(password, { name }) : null;
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit =
    !!school &&
    !!sectionId &&
    rollNumber >= 1 &&
    name.trim().length >= 2 &&
    isIndianMobile(loginPhone) &&
    password.length > 0 &&
    !problem &&
    confirm === password &&
    !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !school || !sectionId) return;
    setBusy(true);
    try {
      await claimStudentAccount({
        school_id: school.id,
        class_section_id: sectionId,
        roll_number: rollNumber,
        full_name: name.trim(),
        login_phone: normalizeMobile(loginPhone),
        password,
      });
      setDone(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not claim the account.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <SimpleAuthCard title="Your account is ready">
        <div className="mlogin-form">
          <p className="text-center text-sm">
            Log in with the mobile number and the password you just chose.
          </p>
          <Link href="/login" className="mlogin-submit text-center">
            Go to log in
          </Link>
        </div>
      </SimpleAuthCard>
    );
  }

  return (
    <SimpleAuthCard
      title="Claim your account"
      subtitle="Your school has already added you. Enter the details it has on record, then choose a login."
    >
      <form onSubmit={submit} className="mlogin-form">
        <SchoolTypeahead
          value={school}
          onChange={(s) => {
            setSchool(s);
            setSections(null);
            setSectionId(null);
          }}
        />

        <div className="grid grid-cols-2 gap-3">
          <Select
            ariaLabel="Class"
            placeholder="Class"
            value={gradeId}
            options={grades.map((g) => ({ value: g.id, label: g.label }))}
            onValueChange={(v) => {
              setGradeId(v);
              setSections(null);
              setSectionId(null);
            }}
            className="h-11 w-full"
          />
          <Select
            ariaLabel="Section"
            placeholder={sectionsLoading ? "Loading…" : "Section"}
            value={sectionId}
            options={(sections ?? []).map((s) => ({ value: s.id, label: s.section }))}
            onValueChange={setSectionId}
            disabled={!gradeId || sectionsLoading}
            className="h-11 w-full"
          />
        </div>
        {gradeId && sections !== null && sections.length === 0 && (
          <p className="text-xs text-destructive">
            This school has no sections for that class yet. Ask your principal.
          </p>
        )}

        <div className="mlogin-field">
          <input
            inputMode="numeric"
            value={roll}
            onChange={(e) => setRoll(e.target.value)}
            placeholder="Roll number"
            maxLength={3}
          />
        </div>
        <div className="mlogin-field">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name, as your school has it"
            maxLength={120}
          />
        </div>
        <div className="mlogin-field">
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            value={loginPhone}
            onChange={(e) => setLoginPhone(e.target.value)}
            placeholder="Your mobile number (you log in with it)"
            maxLength={20}
          />
        </div>
        <div className="mlogin-field">
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Choose a password (10+ characters)"
            maxLength={128}
          />
        </div>
        {problem && <p className="text-xs text-destructive">{problem}</p>}
        <div className="mlogin-field">
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repeat password"
            maxLength={128}
          />
        </div>
        {mismatch && <p className="text-xs text-destructive">Passwords don&apos;t match.</p>}

        <button type="submit" disabled={!canSubmit} className="mlogin-submit">
          {busy ? <Loader2 size={16} className="animate-spin" /> : "Claim account"}
        </button>
        <p className="text-center text-xs text-muted-foreground">
          Not added by your school yet?{" "}
          <Link href="/register?role=student" className="mlogin-link">
            Register instead
          </Link>
        </p>
      </form>
    </SimpleAuthCard>
  );
}
