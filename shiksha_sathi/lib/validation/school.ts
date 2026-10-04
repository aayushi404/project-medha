import { z } from "zod";

/** Mirrors backend school/schemas.py:SchoolNameIn. The server re-checks it and
 * collapses spaces the same way. */
export const schoolNameSchema = z.object({
  name: z
    .string()
    .transform((v) => v.split(/\s+/).filter(Boolean).join(" "))
    .pipe(
      z
        .string()
        .min(3, "School name must be at least 3 characters.")
        .max(120, "School name is too long.")
        .refine((v) => !/[\u0000-\u001f\u007f<>{}[\]\\`|;=]/.test(v), "School name contains characters that aren't allowed.")
        .refine((v) => (v.match(/\p{L}/gu) ?? []).length >= 3, "School name must contain at least three letters."),
    ),
});
export type SchoolNameFormValues = z.input<typeof schoolNameSchema>;

export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** Client-side check before the upload; the server sniffs the real file type too. */
export function logoProblem(file: File): string | null {
  if (!(LOGO_TYPES as readonly string[]).includes(file.type)) return "Please choose a JPEG, PNG or WebP image.";
  if (file.size > LOGO_MAX_BYTES) return "The logo must be 2 MB or smaller.";
  if (file.size === 0) return "That file is empty.";
  return null;
}
