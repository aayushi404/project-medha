"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { motion } from "motion/react";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useStudentLoginFlow } from "@/components/auth/student-login-flow";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { lookupStudentProfiles } from "@/lib/api";
import { useCopy } from "@/lib/copy";
import { studentPhoneSchema, type StudentPhoneFormValues } from "@/lib/validation/auth";

/** Step 1 of the student login: the phone number. */
export default function StudentPhonePage() {
  const copy = useCopy();
  const router = useRouter();
  const flow = useStudentLoginFlow();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const form = useForm<StudentPhoneFormValues>({
    resolver: zodResolver(studentPhoneSchema),
    defaultValues: { phone: "" },
    mode: "onTouched",
    reValidateMode: "onChange",
  });

  async function onSubmit(values: StudentPhoneFormValues) {
    setBusy(true);
    setNotice(null);
    try {
      const profiles = await lookupStudentProfiles(values.phone);
      if (profiles.length === 0) {
        setNotice(copy.login.noProfiles);
        setBusy(false);
        return;
      }
      flow.begin(values.phone, profiles);
      router.push("/login/student/profiles");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.login.couldNotLogIn);
      setBusy(false);
    }
  }

  return (
    <Form {...form}>
      <motion.form
        onSubmit={form.handleSubmit(onSubmit)}
        className="mlogin-form"
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.18 }}
        noValidate
      >
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <div className="mlogin-field">
                <FormControl>
                  <input
                    {...field}
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder={copy.login.phonePlaceholder}
                    autoFocus
                  />
                </FormControl>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {notice && (
          <p role="alert" className="text-center text-sm text-destructive">
            {notice}
          </p>
        )}

        <button type="submit" disabled={busy} className="mlogin-submit">
          {busy ? (
            <>
              <Loader2 size={16} className="animate-spin" /> {copy.login.findingProfiles}
            </>
          ) : (
            <>
              {copy.login.continue} <ArrowRight size={16} />
            </>
          )}
        </button>
      </motion.form>
    </Form>
  );
}
