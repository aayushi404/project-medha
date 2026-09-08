"use client";

import { Dialog } from "@base-ui/react/dialog";
import { BookOpen, Download, Loader2, Presentation, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  libraryPptUrl,
  listLibraryPresentations,
  type LibraryPresentationItem,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCopy, useLocale } from "@/lib/copy";
import { downloadFile } from "@/lib/download";
import { BOOK_CATEGORIES, LIBRARY_BOOKS, type Book } from "@/lib/student-content";
import { cn } from "@/lib/utils";

const TINTS = [
  "from-terracotta/25 to-terracotta/5 text-earth",
  "from-sage/25 to-sage/5 text-sage",
  "from-gold/30 to-gold/5 text-earth",
  "from-earth/20 to-earth/5 text-earth",
];

function tintFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return TINTS[Math.abs(h) % TINTS.length];
}

function Cover({ book, className }: { book: Book; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-end bg-gradient-to-br p-3",
        tintFor(book.subject),
        className,
      )}
    >
      <span className="font-serif text-sm leading-tight font-medium">{book.title}</span>
    </div>
  );
}

type Tab = "books" | "presentations";

export default function LibraryPage() {
  const copy = useCopy();
  const [tab, setTab] = useState<Tab>("presentations");

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <h1 className="text-[15px]">{copy.student.libraryTitle}</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {tab === "books" ? copy.student.librarySub : copy.student.presentationsSub}
        </p>
      </div>

      <div className="flex gap-2 border-b border-border px-5 py-2.5">
        <TabChip active={tab === "presentations"} onClick={() => setTab("presentations")}>
          {copy.student.presentationsTab}
        </TabChip>
        <TabChip active={tab === "books"} onClick={() => setTab("books")}>
          {copy.student.booksTab}
        </TabChip>
      </div>

      {tab === "books" ? <BooksView /> : <PresentationsView />}
    </main>
  );
}

function TabChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        active
          ? "border-transparent bg-accent text-accent-foreground"
          : "border-border text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

// --- presentations (API-backed) -------------------------------------------

function PresentationsView() {
  const copy = useCopy();
  const { locale } = useLocale();
  const { accessToken, teacher } = useAuth();
  const gradeId = teacher?.grade_id ?? undefined;
  const key = `${gradeId ?? ""}|${locale}`;
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<
    { key: string; rows: LibraryPresentationItem[] } | { key: string; failed: true } | null
  >(null);
  const [selected, setSelected] = useState<LibraryPresentationItem | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listLibraryPresentations(accessToken, { gradeId, language: locale })
      .then((r) => !cancelled && setResult({ key, rows: r }))
      .catch(() => !cancelled && setResult({ key, failed: true }));
    return () => {
      cancelled = true;
    };
  }, [key, accessToken, gradeId, locale]);

  const settled = result && result.key === key ? result : null;
  const rows = settled && !("failed" in settled) ? settled.rows : null;
  const failed = !!(settled && "failed" in settled);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows ?? []).filter(
      (p) =>
        !q ||
        p.title.toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q) ||
        (p.chapter_title ?? "").toLowerCase().includes(q),
    );
  }, [rows, query]);

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
    <>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={copy.student.searchPresentations}
            className="h-8 w-56 rounded-lg border border-border bg-background pr-2 pl-8 text-xs outline-none focus-visible:border-ring"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        {rows === null ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : failed ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            {copy.chapterHistoryFailed}
          </p>
        ) : filtered.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            {copy.student.noPresentations}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelected(p)}
                className="group flex flex-col gap-2 rounded-xl border border-border bg-card p-3.5 text-left transition-colors hover:border-foreground/20 hover:bg-muted"
              >
                <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-terracotta">
                  <Presentation className="size-4" />
                </span>
                <span className="line-clamp-2 text-[13px] font-medium">{p.title}</span>
                {p.description ? (
                  <span className="line-clamp-2 text-[11px] text-muted-foreground">
                    {p.description}
                  </span>
                ) : null}
                <div className="mt-auto flex flex-wrap gap-1 pt-1.5">
                  {p.chapter_title ? (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {p.chapter_title}
                    </span>
                  ) : null}
                  {p.slide_count ? (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {copy.student.slidesCount(p.slide_count)}
                    </span>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <Dialog.Root open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
          <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-lg outline-none transition data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
            {selected && (
              <div className="flex flex-col">
                <div className="flex flex-col gap-2 p-5">
                  <Dialog.Title className="text-base font-medium">
                    {selected.title}
                  </Dialog.Title>
                  <div className="flex flex-wrap gap-1">
                    {[selected.subject_name, selected.chapter_title]
                      .filter(Boolean)
                      .map((t) => (
                        <span
                          key={t as string}
                          className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                        >
                          {t}
                        </span>
                      ))}
                    {selected.slide_count ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        {copy.student.slidesCount(selected.slide_count)}
                      </span>
                    ) : null}
                  </div>
                  {selected.description ? (
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {selected.description}
                    </p>
                  ) : null}
                </div>
                <div className="flex justify-end gap-2 border-t border-border bg-muted/40 px-5 py-3">
                  <Button
                    size="sm"
                    disabled={downloading === selected.id}
                    onClick={() => onDownload(selected)}
                  >
                    {downloading === selected.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Download className="size-3.5" />
                    )}
                    {copy.deckDownload}
                  </Button>
                </div>
              </div>
            )}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

// --- books (hardcoded demo content, unchanged) --------------------------

function BooksView() {
  const copy = useCopy();
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string>("All");
  const [selected, setSelected] = useState<Book | null>(null);

  const books = useMemo(() => {
    const q = query.trim().toLowerCase();
    return LIBRARY_BOOKS.filter((b) => {
      if (cat !== "All" && b.category !== cat) return false;
      if (!q) return true;
      return (
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.subject.toLowerCase().includes(q)
      );
    });
  }, [query, cat]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={copy.student.searchBooks}
            className="h-8 w-52 rounded-lg border border-border bg-background pr-2 pl-8 text-xs outline-none focus-visible:border-ring"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {["All", ...BOOK_CATEGORIES].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                cat === c
                  ? "border-transparent bg-accent text-accent-foreground"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {c === "All" ? copy.student.categoryAll : c}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        {books.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            {copy.student.noBooksMatch}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {books.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setSelected(b)}
                className="group flex flex-col overflow-hidden rounded-xl bg-card text-left ring-1 ring-foreground/10 transition-shadow hover:shadow-md"
              >
                <Cover book={b} className="aspect-[3/4]" />
                <div className="flex flex-1 flex-col gap-1 p-3">
                  <span className="line-clamp-2 text-[13px] font-medium">{b.title}</span>
                  <span className="text-[11px] text-muted-foreground">{b.author}</span>
                  <div className="mt-auto flex flex-wrap gap-1 pt-1.5">
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {b.subject}
                    </span>
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {b.classLabel}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <Dialog.Root open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
          <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-lg outline-none transition data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
            {selected && (
              <div className="flex flex-col">
                <div className="flex gap-4 p-5">
                  <Cover book={selected} className="h-40 w-28 shrink-0 rounded-lg" />
                  <div className="min-w-0">
                    <Dialog.Title className="text-base font-medium">
                      {selected.title}
                    </Dialog.Title>
                    <p className="text-sm text-muted-foreground">{selected.author}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {[selected.category, selected.subject, selected.classLabel].map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      {copy.student.pagesCount(selected.pages)}
                    </p>
                  </div>
                </div>
                <p className="px-5 text-sm leading-relaxed text-muted-foreground">
                  {selected.blurb}
                </p>
                <div className="mt-4 flex justify-end gap-2 border-t border-border bg-muted/40 px-5 py-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toast(copy.student.downloadSoon)}
                  >
                    <Download className="size-3.5" />
                    {copy.student.downloadBtn}
                  </Button>
                  <Button size="sm" onClick={() => toast(copy.student.readerSoon)}>
                    <BookOpen className="size-3.5" />
                    {copy.student.readOnlineBtn}
                  </Button>
                </div>
              </div>
            )}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
