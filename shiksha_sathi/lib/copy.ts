/**
 * UI strings. `copy` is the English dictionary (a stable default, safe to read
 * outside React); components should call `useCopy()` so the text follows the
 * language switch. See lib/i18n/ and lib/locale-context.tsx.
 */
export { en as copy } from "@/lib/i18n";
export type { Copy, Locale } from "@/lib/i18n";
export { useCopy, useLocale, setLocale } from "@/lib/locale-context";
export { useCurriculumT } from "@/lib/i18n/curriculum";
