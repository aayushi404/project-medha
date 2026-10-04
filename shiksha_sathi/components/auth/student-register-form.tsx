"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";

import {
  getGrades,
  getRegistrationClassSections,
  registerStudent,
  type ClassSectionOption,
  type Grade,
} from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { SchoolTypeahead } from "@/components/auth/school-typeahead";
import { studentRegisterSchema, type StudentRegisterFormValues } from "@/lib/validation/auth";

/** `onDone` gets nothing: a student may have no email, and the screen that
 * follows doesn't need the address. */
export function StudentRegisterForm({ onDone }: { onDone: () => void }) {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [sections, setSections] = useState<ClassSectionOption[] | null>(null);

  const form = useForm<
    z.input<typeof studentRegisterSchema>,
    unknown,
    StudentRegisterFormValues
  >({
    resolver: zodResolver(studentRegisterSchema),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: {
      role: "student",
      full_name: "",
      login_phone: "",
      password: "",
      confirm_password: "",
      school: null,
      grade_id: "",
      section_id: "",
      roll_number: "",
      guardian_name: "",
      guardian_relation: undefined,
      guardian_phone: "",
    },
  });

  const school = useWatch({ control: form.control, name: "school" });
  const gradeId = useWatch({ control: form.control, name: "grade_id" });
  // Derived, not stored: true exactly while a (school, grade) pair is chosen
  // but the fetch below hasn't resolved into `sections` yet.
  const sectionsLoading = !!school && !!gradeId && sections === null;

  useEffect(() => {
    getGrades()
      .then(setGrades)
      .catch(() => {});
  }, []);

  // Sections depend on (school, grade) -- this effect only ever fetches; the
  // "cleared" case is handled at the call sites that blank school/grade (see
  // the `school` and `grade_id` field handlers below), not reactively here.
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

  async function onSubmit(values: StudentRegisterFormValues) {
    try {
      await registerStudent({
        full_name: values.full_name,
        school_id: values.school.id,
        class_section_id: values.section_id,
        roll_number: Number(values.roll_number),
        guardian_name: values.guardian_name,
        guardian_relation: values.guardian_relation,
        guardian_phone: values.guardian_phone,
        login_phone: values.login_phone,
        password: values.password,
      });
      onDone();
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
          name="login_phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Your mobile number</FormLabel>
              <FormControl>
                <Input {...field} type="tel" inputMode="numeric" autoComplete="tel" placeholder="10-digit number" className="h-11 text-base" />
              </FormControl>
              <p className="text-xs text-muted-foreground">
                You log in with this number. Use a number you can keep, since it is how you get back in.
              </p>
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
          name="school"
          render={({ field }) => (
            <FormItem>
              <FormLabel>School</FormLabel>
              <FormControl>
                <SchoolTypeahead
                  value={field.value ?? null}
                  onChange={(s) => {
                    field.onChange(s);
                    form.setValue("section_id", "");
                    setSections(null);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="grade_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Class</FormLabel>
                <FormControl>
                  <Select
                    ariaLabel="Class"
                    placeholder="Select"
                    value={field.value || null}
                    options={grades.map((g) => ({ value: g.id, label: g.label }))}
                    onValueChange={(v) => {
                      field.onChange(v);
                      form.setValue("section_id", "");
                      setSections(null);
                    }}
                    className="h-11 w-full"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="section_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Section</FormLabel>
                <FormControl>
                  <Select
                    ariaLabel="Section"
                    placeholder={sectionsLoading ? "Loading…" : "Select"}
                    value={field.value || null}
                    options={(sections ?? []).map((s) => ({ value: s.id, label: s.section }))}
                    onValueChange={field.onChange}
                    disabled={!gradeId || sectionsLoading}
                    className="h-11 w-full"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        {gradeId && sections !== null && sections.length === 0 && (
          <p className="-mt-1 text-xs text-destructive">
            This school hasn&apos;t set up this class yet. Ask your principal to set it up first.
          </p>
        )}

        <FormField
          control={form.control}
          name="roll_number"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Roll number</FormLabel>
              <FormControl>
                <Input {...field} inputMode="numeric" placeholder="e.g. 23" className="h-11 text-base" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="guardian_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Guardian&apos;s name</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="e.g. Sunita Devi" className="h-11 text-base" />
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
                <FormLabel>Relation</FormLabel>
                <FormControl>
                  <Select
                    ariaLabel="Guardian's relation"
                    placeholder="Select"
                    value={field.value ?? null}
                    options={[
                      { value: "father", label: "Father" },
                      { value: "mother", label: "Mother" },
                      { value: "guardian", label: "Guardian" },
                    ]}
                    onValueChange={field.onChange}
                    className="h-11 w-full"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="guardian_phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Guardian&apos;s mobile</FormLabel>
              <FormControl>
                <Input {...field} type="tel" placeholder="e.g. 98765 43210" className="h-11 text-base" />
              </FormControl>
              <p className="text-xs text-muted-foreground">
                The school calls this number if the student is marked absent.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        {form.formState.errors.root && (
          <p className="text-sm font-medium text-destructive">{form.formState.errors.root.message}</p>
        )}

        <button type="submit" disabled={form.formState.isSubmitting} className="mreg-submit-btn">
          {form.formState.isSubmitting ? "Submitting…" : "Register"}
        </button>
      </form>
    </Form>
  );
}
