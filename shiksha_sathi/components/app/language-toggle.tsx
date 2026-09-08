"use client";

import { LOCALE_NAMES, LOCALE_SHORT, type Locale } from "@/lib/i18n";
import { useLocale } from "@/lib/locale-context";
import { cn } from "@/lib/utils";

const LOCALES: Locale[] = ["en", "hi"];

/**
 * Segmented EN | हिं switch for the app chrome language. Labelled in both
 * scripts so it reads for someone who knows only one of them.
 */
export function LanguageToggle({ className }: { className?: string }) {
  const { locale, setLocale } = useLocale();

  return (
    <div
      role="group"
      aria-label="Language / भाषा"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-border bg-background p-0.5 text-xs",
        className,
      )}
    >
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLocale(l)}
          aria-pressed={locale === l}
          title={LOCALE_NAMES[l]}
          className={cn(
            "rounded-md px-2 py-1 leading-none transition-colors",
            locale === l
              ? "bg-accent font-medium text-accent-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {LOCALE_SHORT[l]}
        </button>
      ))}
    </div>
  );
}
