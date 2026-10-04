import { z } from "zod";

import { passwordProblem } from "@/lib/password-policy";
import type { SchoolSearchResult } from "@/lib/api";

/**
 * Zod schemas for the login/register forms. These exist for fast, in-browser
 * feedback only -- every rule here mirrors a real check the backend re-runs
 * (see backend/src/backend/{auth,student}/schemas.py, core/validators.py,
 * auth/password_policy.py). The backend is the authority; nothing here is
 * ever trusted on its own.
 */

// --- primitives -------------------------------------------------------------

const FORBIDDEN_NAME_CHARS = /[<>{}[\]\\/;`"|=@#$%^*~]/;

/** Mirrors core/validators.py:clean_name -- collapse whitespace, 2-120 chars,
 * no control/forbidden characters, at least 2 letters. */
export function nameField(label = "Name") {
  return z
    .string()
    .transform((v) => v.split(/\s+/).filter(Boolean).join(" "))
    .refine((v) => v.length >= 2, `${label} is too short.`)
    .refine((v) => v.length <= 120, `${label} is too long.`)
    .refine((v) => !FORBIDDEN_NAME_CHARS.test(v), `${label} contains invalid characters.`)
    .refine((v) => (v.match(/\p{L}/gu) ?? []).length >= 2, `${label} must contain letters.`);
}

/** Mirrors core/validators.py:indian_mobile -- returns the bare 10 digits. */
export function normalizeMobile(v: string): string {
  let digits = v.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}

/** True when `v` normalises to a valid 10-digit Indian mobile number. */
export function isIndianMobile(v: string): boolean {
  return /^[6-9]\d{9}$/.test(normalizeMobile(v));
}

export const mobileField = z
  .string()
  .transform(normalizeMobile)
  .refine((v) => /^[6-9]\d{9}$/.test(v), "Enter a valid 10-digit Indian mobile number.");

/** Mirrors core/validators.py:employee_code. */
const employeeCodeField = z
  .string()
  .trim()
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9\-_/]{2,59}$/,
    "Employee code may contain only letters, digits, - _ / (3-60 characters).",
  );

/** Mirrors auth/schemas.py's `email: EmailStr`. */
export const emailField = z
  .string()
  .trim()
  .min(1, "Email is required.")
  .max(254, "Email is too long.")
  .email("Enter a valid email address.")
  .transform((v) => v.toLowerCase());

/** Length/complexity only -- the identity (name/email) containment check runs
 * separately in `.superRefine`, once both fields are known. */
export const passwordShapeField = z.string().superRefine((pw, ctx) => {
  const problem = passwordProblem(pw);
  if (problem) ctx.addIssue({ code: "custom", message: problem });
});

const schoolField = z
  .custom<SchoolSearchResult | null>()
  .refine((v): v is SchoolSearchResult => v !== null && typeof v === "object" && "id" in v, {
    message: "Pick your school.",
  });

// --- login -------------------------------------------------------------------

/** Principal login. Only principals and admins log in by email. */
export const principalLoginSchema = z.object({
  email: z.string().trim().min(1, "Enter your email.").max(254, "Email is too long.").email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password.").max(128, "That password is too long."),
});
export type PrincipalLoginFormValues = z.infer<typeof principalLoginSchema>;

const loginPasswordField = z
  .string()
  .min(1, "Enter your password.")
  .max(128, "That password is too long.");

/** Teacher login, and the phone step of the student login. */
export const phoneLoginSchema = z.object({
  phone: mobileField,
  password: loginPasswordField,
});
export type PhoneLoginFormValues = z.infer<typeof phoneLoginSchema>;

/** Student password step: the phone is already known from the earlier step. */
export const studentPasswordSchema = z.object({
  password: loginPasswordField,
});
export type StudentPasswordFormValues = z.infer<typeof studentPasswordSchema>;

/** Student phone step. Same rule as login; kept separate so the copy can differ later. */
export const studentPhoneSchema = z.object({
  phone: mobileField,
});
export type StudentPhoneFormValues = z.infer<typeof studentPhoneSchema>;

// --- register: teacher / principal -------------------------------------------

export const staffRegisterSchema = z
  .object({
    role: z.enum(["teacher", "principal"]),
    full_name: nameField(),
    // Principals need an email (they reset by email). Teachers may leave it blank.
    email: z.string().trim().max(254, "Email is too long.").transform((v) => v.toLowerCase()),
    password: passwordShapeField,
    confirm_password: z.string(),
    mobile_number: mobileField,
    school: schoolField,
    employee_code: z.string().trim().optional().default(""),
    years_of_experience: z.string().trim().optional().default(""),
    qualification: z.string().trim().max(120, "Too long.").optional().default(""),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirm_password) {
      ctx.addIssue({ code: "custom", path: ["confirm_password"], message: "Passwords don't match." });
    }
    if (data.role === "principal" && !emailField.safeParse(data.email).success) {
      ctx.addIssue({ code: "custom", path: ["email"], message: "Enter a valid email address." });
    }
    if (data.email && !emailField.safeParse(data.email).success) {
      ctx.addIssue({ code: "custom", path: ["email"], message: "Enter a valid email address, or leave it blank." });
    }
    const problem = passwordProblem(data.password, {
      email: data.email || undefined,
      name: data.full_name,
    });
    if (problem) ctx.addIssue({ code: "custom", path: ["password"], message: problem });

    if (data.role === "teacher") {
      const parsed = employeeCodeField.safeParse(data.employee_code);
      if (!parsed.success) {
        ctx.addIssue({
          code: "custom",
          path: ["employee_code"],
          message: "Employee code (government teacher ID) is required (letters, digits, - _ / only).",
        });
      }
    }
    if (data.years_of_experience) {
      const n = Number(data.years_of_experience);
      if (!Number.isInteger(n) || n < 0 || n > 50) {
        ctx.addIssue({
          code: "custom",
          path: ["years_of_experience"],
          message: "Years of experience must be between 0 and 50.",
        });
      }
    }
  });
export type StaffRegisterFormValues = z.infer<typeof staffRegisterSchema>;

// --- register: student --------------------------------------------------------

export const studentRegisterSchema = z
  .object({
    role: z.literal("student"),
    full_name: nameField(),
    login_phone: mobileField,
    password: passwordShapeField,
    confirm_password: z.string(),
    school: schoolField,
    grade_id: z.string().min(1, "Select your class."),
    section_id: z.string().min(1, "Select your section."),
    roll_number: z
      .string()
      .trim()
      .min(1, "Enter your roll number.")
      .regex(/^\d{1,3}$/, "Enter a valid roll number.")
      .refine((v) => Number(v) >= 1 && Number(v) <= 999, "Roll number must be between 1 and 999."),
    guardian_name: nameField("Guardian's name"),
    guardian_relation: z.enum(["father", "mother", "guardian"], {
      error: "Select your guardian's relation.",
    }),
    guardian_phone: mobileField,
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirm_password) {
      ctx.addIssue({ code: "custom", path: ["confirm_password"], message: "Passwords don't match." });
    }
    const problem = passwordProblem(data.password, { name: data.full_name });
    if (problem) ctx.addIssue({ code: "custom", path: ["password"], message: problem });
  });
export type StudentRegisterFormValues = z.infer<typeof studentRegisterSchema>;

// --- reset with a staff-issued code (teachers and students) -----------------

export const resetWithCodeSchema = z
  .object({
    role: z.enum(["teacher", "student"]),
    phone: mobileField,
    student_id: z.string().optional().default(""),
    code: z
      .string()
      .transform((v) => v.replace(/[\s-]/g, "").toUpperCase())
      .refine((v) => v.length === 10, "Enter the 10-character code, for example ABCDE-FGHJK."),
    password: passwordShapeField,
    confirm_password: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.role === "student" && !data.student_id) {
      ctx.addIssue({ code: "custom", path: ["student_id"], message: "Choose which profile to reset." });
    }
    if (data.password !== data.confirm_password) {
      ctx.addIssue({ code: "custom", path: ["confirm_password"], message: "Passwords don't match." });
    }
  });
export type ResetWithCodeFormValues = z.input<typeof resetWithCodeSchema>;

// --- admission: a principal admits one student ------------------------------

/** Mirrors backend principal/student_import.py rules. The backend re-checks
 * every field (and the duplicate roll/phone checks, which need the database). */
export const admissionSchema = z
  .object({
    full_name: z.string().trim().min(1, "Enter the student's full name.").pipe(nameField()),
    grade: z.string().min(1, "Choose the class."),
    section: z
      .string()
      .trim()
      .transform((v) => v.toUpperCase())
      .refine((v) => /^[A-Z0-9]{1,5}$/.test(v), "Section should be a letter like A or B."),
    roll_number: z
      .string()
      .trim()
      .min(1, "Enter the roll number.")
      .regex(/^\d{1,3}$/, "Roll number must be a whole number.")
      .refine((v) => Number(v) >= 1 && Number(v) <= 999, "Roll number must be between 1 and 999."),
    login_phone: mobileField,
    password: passwordShapeField,
    confirm_password: z.string(),
    email: z.string().trim().max(254, "Email is too long."),
    guardian_name: z.string().trim(),
    guardian_relation: z.enum(["", "father", "mother", "guardian"]),
    guardian_phone: z.string().trim(),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirm_password) {
      ctx.addIssue({ code: "custom", path: ["confirm_password"], message: "Passwords don't match." });
    }
    const problem = passwordProblem(data.password, {
      email: data.email || undefined,
      name: data.full_name,
    });
    if (problem) ctx.addIssue({ code: "custom", path: ["password"], message: problem });

    if (data.email && !emailField.safeParse(data.email).success) {
      ctx.addIssue({
        code: "custom",
        path: ["email"],
        message: "Enter a valid email address, or leave it blank.",
      });
    }
    if (data.guardian_name) {
      if (!nameField("Guardian's name").safeParse(data.guardian_name).success) {
        ctx.addIssue({
          code: "custom",
          path: ["guardian_name"],
          message: "Enter the guardian's name (letters only, at least 2 characters).",
        });
      }
      if (!data.guardian_relation) {
        ctx.addIssue({
          code: "custom",
          path: ["guardian_relation"],
          message: "Choose the guardian's relation to the student.",
        });
      }
    }
    if (data.guardian_phone && !mobileField.safeParse(data.guardian_phone).success) {
      ctx.addIssue({
        code: "custom",
        path: ["guardian_phone"],
        message: "Enter a valid 10-digit mobile number, or leave it blank.",
      });
    }
  });
export type AdmissionFormValues = z.input<typeof admissionSchema>;
