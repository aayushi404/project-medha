"use client";

import { useEffect } from "react";

import { useLocale } from "@/lib/locale-context";

/** Keeps <html lang> in sync with the chosen UI language. Renders nothing. */
export function LocaleHtmlLang() {
  const { locale } = useLocale();

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return null;
}
