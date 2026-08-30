"use client";

import { Dialog } from "@base-ui/react/dialog";
import { BookOpen, Download, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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

export default function LibraryPage() {
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
    <main className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <h1 className="text-[15px]">Library</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Textbooks, reference books, story books and more — all in one place.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search books"
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
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        {books.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            No books match that search.
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
                  <Cover
                    book={selected}
                    className="h-40 w-28 shrink-0 rounded-lg"
                  />
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
                      {selected.pages} pages
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
                    onClick={() => toast("Download coming soon.")}
                  >
                    <Download className="size-3.5" />
                    Download
                  </Button>
                  <Button size="sm" onClick={() => toast("Reader coming soon.")}>
                    <BookOpen className="size-3.5" />
                    Read online
                  </Button>
                </div>
              </div>
            )}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </main>
  );
}
