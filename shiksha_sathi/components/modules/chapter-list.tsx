"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { ModuleRow } from "@/components/modules/module-row";
import type { Chapter, ModuleListItem } from "@/lib/api";
import { useCopy, useCurriculumT } from "@/lib/copy";
import { cn } from "@/lib/utils";

type ChapterListProps = {
  chapters: Chapter[];
  modulesByChapter: Map<string, ModuleListItem[]>;
  otherModules: ModuleListItem[];
  onStartLesson: (chapterId: string) => void;
  search: string;
};

export function ChapterList({
  chapters,
  modulesByChapter,
  otherModules,
  onStartLesson,
  search,
}: ChapterListProps) {
  const copy = useCopy();
  const t = useCurriculumT();
  const [open, setOpen] = useState<Set<string>>(() => new Set());

  const q = search.trim().toLowerCase();
  const searching = q.length > 0;
  const hit = (mods: ModuleListItem[]) =>
    searching ? mods.filter((m) => m.title.toLowerCase().includes(q)) : mods;

  const rows = chapters.map((ch) => ({
    ch,
    mods: hit(modulesByChapter.get(ch.id) ?? []),
  }));
  const other = hit(otherModules);

  const visibleRows = searching ? rows.filter((r) => r.mods.length > 0) : rows;
  const totalHits =
    visibleRows.reduce((n, r) => n + r.mods.length, 0) + other.length;

  if (searching && totalHits === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
        {copy.noSearchHits}
      </p>
    );
  }

  const isOpen = (id: string) => searching || open.has(id);
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const withModules = rows.filter((r) => r.mods.length > 0).length;

  return (
    <div className="flex flex-col gap-2.5">
      {!searching && chapters.length > 0 ? (
        <div className="flex items-center justify-between px-0.5 text-[11px] text-muted-foreground">
          <span>{copy.chaptersStarted(withModules, chapters.length)}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOpen(new Set(chapters.map((c) => c.id)))}
              className="hover:text-foreground"
            >
              {copy.expandAll}
            </button>
            <span aria-hidden>·</span>
            <button
              type="button"
              onClick={() => setOpen(new Set())}
              className="hover:text-foreground"
            >
              {copy.collapseAll}
            </button>
          </div>
        </div>
      ) : null}

      {visibleRows.map(({ ch, mods }) => {
        const covered = (modulesByChapter.get(ch.id)?.length ?? 0) > 0;
        const expanded = isOpen(ch.id);
        return (
          <div key={ch.id} className="overflow-hidden rounded-xl border border-border bg-card">
            <button
              type="button"
              onClick={() => toggle(ch.id)}
              aria-expanded={expanded}
              className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-muted"
            >
              <span
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  covered ? "bg-terracotta" : "bg-border",
                )}
                aria-hidden
              />
              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                {String(ch.chapter_number).padStart(2, "0")}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                {t.chapter(ch.title)}
              </span>
              {mods.length > 0 ? (
                <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-accent-foreground">
                  {copy.moduleCount(mods.length)}
                </span>
              ) : (
                <span className="shrink-0 text-[10px] text-muted-foreground/70">
                  {copy.chapterEmpty}
                </span>
              )}
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 text-muted-foreground transition-transform",
                  expanded && "rotate-180",
                )}
              />
            </button>

            <div
              className={cn(
                "grid transition-[grid-template-rows] duration-200 ease-out",
                expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
              )}
            >
              <div className="overflow-hidden">
                <div className="border-t border-border px-3.5 py-3">
                  {mods.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {mods.map((m) => (
                        <ModuleRow key={m.id} module={m} />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-start gap-2 py-2 text-sm text-muted-foreground">
                      <span>{copy.chapterNothingYet}</span>
                      <button
                        type="button"
                        onClick={() => onStartLesson(ch.id)}
                        className="text-xs text-primary underline underline-offset-2 hover:no-underline"
                      >
                        {copy.startLesson}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {other.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <button
            type="button"
            onClick={() => toggle("__other__")}
            aria-expanded={isOpen("__other__")}
            className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-muted"
          >
            <span className="size-1.5 shrink-0 rounded-full bg-border" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-muted-foreground">
              {copy.otherModules}
            </span>
            <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-accent-foreground">
              {copy.moduleCount(other.length)}
            </span>
            <ChevronDown
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform",
                isOpen("__other__") && "rotate-180",
              )}
            />
          </button>
          <div
            className={cn(
              "grid transition-[grid-template-rows] duration-200 ease-out",
              isOpen("__other__") ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
            )}
          >
            <div className="overflow-hidden">
              <div className="flex flex-col gap-2 border-t border-border px-3.5 py-3">
                {other.map((m) => (
                  <ModuleRow key={m.id} module={m} />
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
