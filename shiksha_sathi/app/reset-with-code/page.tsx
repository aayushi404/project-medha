"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { SimpleAuthCard } from "@/components/auth/simple-auth-card";
import { Select } from "@/components/ui/select";
import {
  lookupStudentProfiles,
  resetWithCode,
  type StudentProfileSummary,
} from "@/lib/api";
import { passwordProblem } from "@/lib/password-policy";
import { resetWithCodeSchema } from "@/lib/validation/auth";

type Role = "teacher" | "student";

/**
 * Teachers and students set a new password with a one-time code that their
 * principal (teachers) or class teacher (students) reads out to them. The code
 * works once and expires after 15 minutes.
 */
export default function ResetWithCodePage() {
  const [role, setRole] = useState<Role>("teacher");
  const [phone, setPhone] = useState("");
  const [profiles, setProfiles] = useState<StudentProfileSummary[] | null>(null);
  const [studentId, setStudentId] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [finding, setFinding] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const problem = password ? passwordProblem(password) : null;
  const mismatch = confirm.length > 0 && confirm !== password;

  function chooseRole(next: Role) {
    setRole(next);
    setProfiles(null);
    setStudentId("");
    setError(null);
  }

  async function findProfiles() {
    setFinding(true);
    setError(null);
    try {
      const found = await lookupStudentProfiles(phone);
      setProfiles(found);
      setStudentId(found.length === 1 ? found[0].id : "");
      if (found.length === 0) setError("No student profile is linked to this number.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not look up profiles.");
    } finally {
      setFinding(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    const parsed = resetWithCodeSchema.safeParse({
      role,
      phone,
      student_id: studentId,
      code,
      password,
      confirm_password: confirm,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the details and try again.");
      return;
    }
    setBusy(true);
    try {
      await resetWithCode({
        phone: parsed.data.phone,
        role: parsed.data.role,
        student_id: parsed.data.role === "student" ? parsed.data.student_id : undefined,
        code: parsed.data.code,
        new_password: parsed.data.password,
      });
      setDone(true);
    } catch (err) {
      // the backend's message is deliberately generic ("invalid or expired"), so show it as is
      setError(err instanceof Error ? err.message : "Could not reset the password.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <SimpleAuthCard title="Password changed" subtitle="You can now log in with your mobile number.">
        <div className="mlogin-form">
          <Link href="/login" className="mlogin-submit text-center">
            Go to log in
          </Link>
        </div>
      </SimpleAuthCard>
    );
  }

  const canSubmit = !busy && phone.length >= 10 && code.length >= 10 && password.length > 0 && !problem && !mismatch;

  return (
    <SimpleAuthCard
      title="Enter your reset code"
      subtitle="Your principal or class teacher gives you this code. It works once and expires after 15 minutes."
    >
      <form onSubmit={submit} className="mlogin-form" noValidate>
        <div className="grid grid-cols-2 gap-2">
          {(["teacher", "student"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => chooseRole(r)}
              className={`mlogin-tab${role === r ? " mlogin-tab--active" : ""}`}
            >
              {r === "teacher" ? "Teacher" : "Student"}
            </button>
          ))}
        </div>

        <div className="mlogin-field">
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setProfiles(null);
              setStudentId("");
            }}
            placeholder="Your mobile number"
            maxLength={20}
          />
        </div>

        {role === "student" && (
          <>
            {profiles === null ? (
              <button type="button" className="mlogin-link-muted self-center" onClick={findProfiles} disabled={finding || phone.length < 10}>
                {finding ? "Finding profiles…" : "Find my profiles"}
              </button>
            ) : profiles.length > 1 ? (
              <Select
                ariaLabel="Which profile"
                placeholder="Which profile?"
                value={studentId || null}
                options={profiles.map((p) => ({
                  value: p.id,
                  label: `${p.full_name} · ${p.class_label ?? "Class not set"}${p.roll_number ? ` · Roll ${p.roll_number}` : ""}`,
                }))}
                onValueChange={setStudentId}
                className="h-11 w-full"
              />
            ) : null}
          </>
        )}

        <div className="mlogin-field">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Reset code, e.g. ABCDE-FGHJK"
            autoComplete="one-time-code"
            maxLength={12}
            autoCapitalize="characters"
            spellCheck={false}
          />
        </div>

        <div className="mlogin-field">
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password (10+ characters)"
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
            placeholder="Repeat new password"
            maxLength={128}
          />
        </div>
        {mismatch && <p className="text-xs text-destructive">Passwords don&apos;t match.</p>}

        {error && (
          <p role="alert" className="text-center text-sm text-destructive">
            {error}
          </p>
        )}

        <button type="submit" disabled={!canSubmit} className="mlogin-submit">
          {busy ? <Loader2 size={16} className="animate-spin" /> : "Set new password"}
        </button>
        <Link href="/login" className="mlogin-link text-center">
          Back to log in
        </Link>
      </form>
    </SimpleAuthCard>
  );
}
