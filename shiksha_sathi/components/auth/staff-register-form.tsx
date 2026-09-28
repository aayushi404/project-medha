"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import {
  register as registerRequest,
  type RegisterRole,
} from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { SchoolTypeahead } from "@/components/auth/school-typeahead";
import { staffRegisterSchema, type StaffRegisterFormValues } from "@/lib/validation/auth";

export function StaffRegisterForm({
  role,
  onDone,
}: {
  role: RegisterRole;
  onDone: (email: string) => void;
}) {
  const form = useForm<
    z.input<typeof staffRegisterSchema>,
    unknown,
    StaffRegisterFormValues
  >({
    resolver: zodResolver(staffRegisterSchema),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: {
      role,
      full_name: "",
      email: "",
      password: "",
      confirm_password: "",
      mobile_number: "",
      school: null,
      employee_code: "",
      years_of_experience: "",
      qualification: "",
    },
  });

  const isTeacher = role === "teacher";

  async function onSubmit(values: StaffRegisterFormValues) {
    try {
      await registerRequest({
        role: values.role,
        full_name: values.full_name,
        email: values.email,
        password: values.password,
        mobile_number: values.mobile_number,
        school_id: values.school.id,
        employee_code: isTeacher ? values.employee_code || null : null,
        years_of_experience: isTeacher && values.years_of_experience ? Number(values.years_of_experience) : null,
        qualification: values.qualification || null,
      });
      onDone(values.email);
    } catch (err) {
      form.setError("root", {
        message: err instanceof Error ? err.message : "Could not register.",
      });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="mreg-actual-form" noValidate>
        <FormField
          control={form.control}
          name="full_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full name</FormLabel>
              <FormControl>
                <Input {...field} placeholder="e.g. Anita Kumari" className="h-11 text-base" autoFocus />
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
                <Input {...field} type="email" autoComplete="email" placeholder="you@example.com" className="h-11 text-base" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input {...field} type="password" autoComplete="new-password" placeholder="10+ characters" className="h-11 text-base" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirm_password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm</FormLabel>
                <FormControl>
                  <Input {...field} type="password" autoComplete="new-password" placeholder="Repeat password" className="h-11 text-base" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="mobile_number"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mobile number</FormLabel>
              <FormControl>
                <Input {...field} type="tel" inputMode="numeric" autoComplete="tel" placeholder="10-digit number" className="h-11 text-base" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="school"
          render={({ field }) => (
            <FormItem>
              <FormLabel>School</FormLabel>
              <FormControl>
                <SchoolTypeahead value={field.value ?? null} onChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {isTeacher && (
          <FormField
            control={form.control}
            name="employee_code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Employee code (government teacher ID)</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="As on your service record" className="h-11 text-base" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="grid grid-cols-2 gap-3">
          {isTeacher && (
            <FormField
              control={form.control}
              name="years_of_experience"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Years of experience</FormLabel>
                  <FormControl>
                    <Input {...field} type="number" min={0} max={50} placeholder="e.g. 7" className="h-11 text-base" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          <FormField
            control={form.control}
            name="qualification"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{isTeacher ? "Qualification" : "Qualification (optional)"}</FormLabel>
                <FormControl>
                  <Input {...field} placeholder={isTeacher ? "e.g. B.Ed" : "e.g. M.Ed"} className="h-11 text-base" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {form.formState.errors.root && (
          <p className="text-sm font-medium text-destructive">{form.formState.errors.root.message}</p>
        )}

        <button type="submit" disabled={form.formState.isSubmitting} className="mreg-submit-btn">
          {form.formState.isSubmitting ? "Submitting…" : "Create account"}
        </button>
      </form>
    </Form>
  );
}
