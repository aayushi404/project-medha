import { en, type Copy } from "./en";
import { hi } from "./hi";

export type Locale = "en" | "hi";

export const DICTS: Record<Locale, Copy> = { en, hi };

/** Native name of each locale, for the switcher. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  hi: "हिंदी",
};

/** Short label for a compact toggle. */
export const LOCALE_SHORT: Record<Locale, string> = {
  en: "EN",
  hi: "हिं",
};

export type { Copy };
export { en };
