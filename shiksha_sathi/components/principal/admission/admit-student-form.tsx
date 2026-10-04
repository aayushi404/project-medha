"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type FieldPath } from "react-hook-form";
import type { z } from "zod";
import { CheckCircle2, Copy, Eye, EyeOff, RefreshCw, UserPlus } from "lucide-react";
import { toast } from "sonner";

import {
  admitStudent,
  getGrades,
  type Grade,
  type StudentAdmissionInput,
  type StudentImportRowResult,
} from "@/lib/api";
import { suggestPassword } from "@/lib/password-policy";
import { admissionSchema, type AdmissionFormValues } from "@/lib/validation/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

type Admitted = {
  studentId: string;
  name: string;
  classLabel: string;
  roll: string;
  phone: string;
  /** kept only so "Copy login details" works; cleared by "Admit another" */
  password: string;
};

const RELATIONS = [
  { value: "father", label: "Father" },
  { value: "mother", label: "Mother" },
  { value: "guardian", label: "Guardian" },
];

const EMPTY: AdmissionFormValues = {
  full_name: "",
  grade: "",
  section: "A",
  roll_number: "",
  login_phone: "",
  password: "",
  confirm_password: "",
  email: "",
  guardian_name: "",
  guardian_relation: "",
  guardian_phone: "",
};

/** Server messages that name one field. Anything else shows as a form-level alert. */
const FIELD_FOR_MESSAGE: [RegExp, FieldPath<AdmissionFormValues>][] = [
  [/roll/i, "roll_number"],
  [/phone/i, "login_phone"],
  [/password/i, "password"],
  [/section/i, "section"],
  [/class/i, "grade"],
  [/name/i, "full_name"],
];

/** The Admission form. Every rule runs in the browser first (lib/validation/auth.ts),
 * and the server re-checks all of it plus the duplicate checks. Approved at once. */
export function AdmitStudentForm({ token }: { token: string | null }) {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [admitted, setAdmitted] = useState<Admitted | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<AdmissionFormValues, unknown, z.output<typeof admissionSchema>>({
    resolver: zodResolver(admissionSchema),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: EMPTY,
  });

  useEffect(() => {
    getGrades()
      .then(setGrades)
      .catch(() => toast.error("Could not load the classes. Refresh and try again."));
  }, []);

  function reset() {
    form.reset(EMPTY);
    setAdmitted(null);
    setServerError(null);
    setShowPassword(false);
  }

  function generatePassword() {
    const pw = suggestPassword();
    form.setValue("password", pw, { shouldValidate: true, shouldDirty: true });
    form.setValue("confirm_password", pw, { shouldValidate: true });
    setShowPassword(true);
  }

  async function onSubmit(values: z.output<typeof admissionSchema>) {
    setServerError(null);
    const orNull = (v: string) => (v.trim() === "" ? null : v.trim());
    const payload: StudentAdmissionInput = {
      full_name: values.full_name,
      grade: values.grade,
      section: values.section,
      roll_number: values.roll_number,
      login_phone: values.login_phone,
      // sent exactly as typed: the policy check already ran on this value
      password: values.password,
      email: orNull(values.email),
      guardian_name: orNull(values.guardian_name),
      guardian_relation: orNull(values.guardian_relation),
      guardian_phone: orNull(values.guardian_phone),
    };
    try {
      const row: StudentImportRowResult = await admitStudent(token, payload);
      if (!row.student_id) throw new Error("The student was admitted, but the profile link is missing.");
      setAdmitted({
        studentId: row.student_id,
        name: values.full_name,
        classLabel: row.class_label ?? "",
        roll: values.roll_number,
        phone: values.login_phone,
        password: values.password,
      });
      form.reset(EMPTY);
      setShowPassword(false);
      toast.success(`${values.full_name} is admitted`);
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : "The student couldn't be admitted.";
      const target = FIELD_FOR_MESSAGE.find(([pattern]) => pattern.test(message));
      if (target) {
        form.setError(target[1], { type: "server", message });
      } else {
        setServerError(message);
      }
    }
  }

  async function copyLogin() {
    if (!admitted) return;
    const text = `Medha login\nPhone: ${admitted.phone}\nPassword: ${admitted.password}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Login details copied");
    } catch {
      toast.error("Could not copy. Select the details and copy them by hand.");
    }
  }

  if (admitted) {
    return (
      <div className="flex flex-col gap-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div>
            <p className="text-sm font-semibold text-foreground">{admitted.name} is admitted</p>
            <p className="text-xs text-muted-foreground">
              {admitted.classLabel} · Roll {admitted.roll} · Approved, and can log in now with the phone number
              and password.
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Give the student their password in person. It is not shown again once you admit another student. If it is
          lost, a teacher can issue a reset code.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href={`/principal/students/${admitted.studentId}`} className={buttonVariants({ size: "sm" })}>
            View profile
          </Link>
          <Button variant="outline" size="sm" onClick={copyLogin}>
            <Copy className="size-4" />
            Copy login details
          </Button>
          <Button variant="outline" size="sm" onClick={reset}>
            <UserPlus className="size-4" />
            Admit another student
          </Button>
        </div>
      </div>
    );
  }

  const submitting = form.formState.isSubmitting;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
        {serverError ? (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {serverError}
          </p>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2">
          <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase sm:col-span-2">
            Student
          </h2>

          <FormField
            control={form.control}
            name="full_name"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Full name</FormLabel>
                <FormControl>
                  <Input autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="grade"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Class</FormLabel>
                <FormControl>
                  <Select
                    ariaLabel="Class"
                    placeholder="Choose class"
                    value={field.value || null}
                    options={grades.map((g) => ({ value: String(g.numeric_level), label: g.label }))}
                    onValueChange={field.onChange}
                    className="h-9 w-full"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="section"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Section</FormLabel>
                <FormControl>
                  <Input autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="roll_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Roll number</FormLabel>
                <FormControl>
                  <Input inputMode="numeric" autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="login_phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Login phone</FormLabel>
                <FormControl>
                  <Input inputMode="tel" autoComplete="off" placeholder="10-digit mobile" {...field} />
                </FormControl>
                <FormDescription>The number the student logs in with. Siblings may share one.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2">
            <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Login password</h2>
            <Button type="button" variant="ghost" size="sm" onClick={generatePassword}>
              <RefreshCw className="size-4" />
              Suggest a password
            </Button>
          </div>

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <div className="relative">
                  <FormControl>
                    <Input
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      className="pr-9"
                      {...field}
                    />
                  </FormControl>
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-0 flex items-center px-2.5 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <FormDescription>At least 10 characters, with letters and a number or symbol.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirm_password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm password</FormLabel>
                <FormControl>
                  <Input
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase sm:col-span-2">
            Guardian and contact (optional)
          </h2>

          <FormField
            control={form.control}
            name="guardian_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Guardian name</FormLabel>
                <FormControl>
                  <Input autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="guardian_relation"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Relation to student</FormLabel>
                <FormControl>
                  <Select
                    ariaLabel="Relation to student"
                    placeholder="Choose"
                    value={field.value || null}
                    options={RELATIONS}
                    onValueChange={field.onChange}
                    className="h-9 w-full"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="guardian_phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Guardian phone</FormLabel>
                <FormControl>
                  <Input inputMode="tel" autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </section>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={reset} disabled={submitting}>
            Clear
          </Button>
          <Button type="submit" disabled={submitting}>
            <UserPlus className="size-4" />
            {submitting ? "Admitting…" : "Admit student"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
