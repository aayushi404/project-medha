"use client";

import { Download, Loader2, Presentation } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  libraryPptUrl,
  listLibraryPresentations,
  type LibraryPresentationItem,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCopy, useLocale } from "@/lib/copy";
import { downloadFile } from "@/lib/download";

/**
 * "Ready-made slides for this chapter" - shows curated decks that match the
 * current chapter so a teacher can grab one before spending a generation.
 * Renders nothing while loading, on error, or when there are no matches.
 */
export function LibrarySuggestions({ chapterId }: { chapterId: string }) {
  const copy = useCopy();
  const { locale } = useLocale();
  const { accessToken } = useAuth();
  const key = `${chapterId}|${locale}`;
  const [result, setResult] = useState<{
    key: string;
    items: LibraryPresentationItem[];
  } | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listLibraryPresentations(accessToken, { chapterId, language: locale, limit: 3 })
      .then((rows) => !cancelled && setResult({ key, items: rows }))
      .catch(() => !cancelled && setResult({ key, items: [] }));
    return () => {
      cancelled = true;
    };
  }, [key, accessToken, chapterId, locale]);

  const items = result && result.key === key ? result.items : [];
  if (items.length === 0) return null;

  async function onDownload(item: LibraryPresentationItem) {
    if (downloading) return;
    setDownloading(item.id);
    try {
      await downloadFile(
        libraryPptUrl(item.id),
        accessToken,
        `${item.title || "medha-slides"}.pptx`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.streamError);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-2.5 px-3.5 py-3">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-accent text-terracotta">
          <Presentation className="size-3.5" />
        </span>
        <span className="text-[13px] font-medium">{copy.readyMadeSlides}</span>
      </div>
      <div className="flex flex-col border-t border-border">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 border-b border-border px-3.5 py-2.5 last:border-b-0"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium">{item.title}</div>
              {item.description ? (
                <div className="truncate text-[11px] text-muted-foreground">
                  {item.description}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => onDownload(item)}
              disabled={downloading === item.id}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              {downloading === item.id ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Download className="size-3" />
              )}
              {copy.deckDownload}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
