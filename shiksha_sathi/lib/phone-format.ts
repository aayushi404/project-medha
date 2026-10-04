/** `+919876543210` -> `+91 98765 43210`. Anything else is returned unchanged. */
export function formatIndianPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const m = /^\+91(\d{5})(\d{5})$/.exec(e164);
  return m ? `+91 ${m[1]} ${m[2]}` : e164;
}
