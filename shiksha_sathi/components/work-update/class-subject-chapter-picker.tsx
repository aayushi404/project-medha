"use client";

import { Loader2 } from "lucide-react";

import type { Chapter, TeacherSection, TeacherSectionSubject } from "@/lib/api";

const selectCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta disabled:opacity-50";

/** Class / subject / chapter selects for a work update. Purely presentational
 * -- the page owns fetching sections and chapters and just hands this the
 * current options and selection. */
export function ClassSubjectChapterPicker({
  isHi,
  loading,
  sections,
  subjects,
  chapterList,
  pickSection,
  pickSubject,
  pickChapter,
  onSectionChange,
  onSubjectChange,
  onChapterChange,
}: {
  isHi: boolean;
  loading: boolean;
  sections: TeacherSection[];
  subjects: TeacherSectionSubject[];
  chapterList: Chapter[];
  pickSection: string;
  pickSubject: string;
  pickChapter: string;
  onSectionChange: (id: string) => void;
  onSubjectChange: (id: string) => void;
  onChapterChange: (id: string) => void;
}) {
  if (loading) {
    return (
      <div className="flex justify-center rounded-xl border border-border bg-card p-8">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-3">
      <label className="space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">{isHi ? "कक्षा" : "Class"}</span>
        <select value={pickSection} onChange={(e) => onSectionChange(e.target.value)} className={selectCls}>
          <option value="">{isHi ? "चुनें" : "Select"}</option>
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.grade_label} · {s.section}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">{isHi ? "विषय" : "Subject"}</span>
        <select
          value={pickSubject}
          onChange={(e) => onSubjectChange(e.target.value)}
          disabled={!pickSection}
          className={selectCls}
        >
          <option value="">{isHi ? "चुनें" : "Select"}</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">{isHi ? "अध्याय" : "Chapter"}</span>
        <select
          value={pickChapter}
          onChange={(e) => onChapterChange(e.target.value)}
          disabled={!pickSubject}
          className={selectCls}
        >
          <option value="">{isHi ? "अध्याय चुनें" : "Select chapter"}</option>
          {chapterList.map((c) => (
            <option key={c.id} value={c.id}>
              {c.chapter_number}. {c.title}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
