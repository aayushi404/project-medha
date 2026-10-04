"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { motion } from "motion/react";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useStudentLoginFlow, maskPhone } from "@/components/auth/student-login-flow";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { AuthError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCopy } from "@/lib/copy";
import { studentPasswordSchema, type StudentPasswordFormValues } from "@/lib/validation/auth";

/** Step 3: the password for the chosen profile. */
export default function StudentPasswordPage() {
  const copy = useCopy();
  const router = useRouter();
  const flow = useStudentLoginFlow();
  const { loginWithPhone } = useAuth();
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const phone = flow.phone;
  const selected = flow.selected;
  const ready = phone !== null && selected !== null;

  const form = useForm<StudentPasswordFormValues>({
    resolver: zodResolver(studentPasswordSchema),
    defaultValues: { password: "" },
    mode: "onTouched",
    reValidateMode: "onChange",
  });

  useEffect(() => {
    if (ready) return;
    router.replace(phone ? "/login/student/profiles" : "/login/student");
  }, [ready, phone, router]);

  if (!ready || !phone || !selected) return null;

  async function onSubmit(values: StudentPasswordFormValues) {
    if (!phone || !selected) return;
    setSubmitting(true);
    try {
      await loginWithPhone({
        phone,
        password: values.password,
        role: "student",
        studentId: selected.id,
      });
      // The layout sends the student to /home once the session exists. Stay
      // disabled until then so a second click can't fire a second login.
    } catch (err) {
      setSubmitting(false);
      if (err instanceof AuthError && err.code === "PENDING_APPROVAL") {
        flow.setOutcome({ kind: "pending" });
      } else if (err instanceof AuthError && err.code === "REGISTRATION_REJECTED") {
        flow.setOutcome({ kind: "rejected", reason: err.reason });
      } else {
        toast.error(err instanceof Error ? err.message : copy.login.couldNotLogIn);
      }
    }
  }

  return (
    <motion.div
      className="flex flex-col gap-4"
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.18 }}
    >
      <div className="mlogin-profile mlogin-profile--static">
        <span className="mlogin-profile-name">{selected.full_name}</span>
        <span className="mlogin-profile-meta">
          {selected.class_label ?? copy.login.classNotSet}
          {selected.roll_number ? ` · ${copy.login.rollNumber(selected.roll_number)}` : ""}
          {` · ${maskPhone(phone)}`}
        </span>
      </div>

      <p className="text-center text-sm text-muted-foreground">{copy.login.passwordFor(selected.full_name)}</p>

      <Form {...form}>
        <motion.form
          onSubmit={form.handleSubmit(onSubmit)}
          className="mlogin-form"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.18 }}
          noValidate
        >
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="mlogin-field mlogin-field--pass">
                  <FormControl>
                    <input
                      {...field}
                      type={showPass ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder={copy.login.password}
                      autoFocus
                    />
                  </FormControl>
                  <button
                    type="button"
                    className="mlogin-eye"
                    onClick={() => setShowPass((v) => !v)}
                    tabIndex={-1}
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <p className="self-end text-xs text-muted-foreground">{copy.login.forgotStudent}</p>

          <button type="submit" disabled={submitting} className="mlogin-submit">
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" /> {copy.login.submitting}
              </>
            ) : (
              <>
                {copy.login.submit} <ArrowRight size={16} />
              </>
            )}
          </button>
        </motion.form>
      </Form>

      <button
        type="button"
        className="mlogin-link-muted self-center"
        onClick={() => router.push("/login/student/profiles")}
      >
        {copy.login.chooseAnotherProfile}
      </button>
    </motion.div>
  );
}
