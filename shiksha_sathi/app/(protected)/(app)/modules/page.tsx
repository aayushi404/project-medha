"use client";

import { Loader2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ChapterList } from "@/components/modules/chapter-list";
import {
  getChapters,
  getTopics,
  listModules,
  type Chapter,
  type ModuleListItem,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { copy } from "@/lib/copy";
import { useLessonContext } from "@/lib/lesson-context";
import { useProfile } from "@/lib/profile-context";
import { cn } from "@/lib/utils";

type Pair = {
  key: string;
  gradeId: string;
  subjectId: string;
  label: string;
  numeric: number;
  primary: boolean;
};

type LoadOk = {
  key: string;
  chapters: Chapter[];
  topicToChapter: Map<string, string>;
  modules: ModuleListItem[];
};
type LoadResult = LoadOk | { key: string; failed: true } | null;

export default function ModulesPage() {
  const { accessToken } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const { setGradeSubject, setChapter } = useLessonContext();
  const router = useRouter();

  const pairs = useMemo<Pair[]>(() => {
    const seen = new Map<string, Pair>();
    for (const s of profile?.subjects ?? []) {
      const key = `${s.grade_id}:${s.subject_id}`;
      if (!seen.has(key)) {
        seen.set(key, {
          key,
          gradeId: s.grade_id,
          subjectId: s.subject_id,
          label: `${s.grade_label} · ${s.subject_name}`,
          numeric: s.numeric_level,
          primary: s.is_primary,
        });
      }
    }
    return [...seen.values()].sort(
      (a, b) =>
        Number(b.primary) - Number(a.primary) ||
        a.numeric - b.numeric ||
        a.label.localeCompare(b.label),
    );
  }, [profile]);

  const [picked, setPicked] = useState<string | null>(null);
  const active = pairs.find((p) => p.key === picked) ?? pairs[0] ?? null;
  const activeKey = active?.key ?? "";

  const [result, setResult] = useState<LoadResult>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!active) return;
    const key = activeKey;
    let cancelled = false;
    (async () => {
      try {
        const [chapters, modules] = await Promise.all([
          getChapters(active.gradeId, active.subjectId),
          listModules(accessToken, { gradeId: active.gradeId, subjectId: active.subjectId }),
        ]);
        const topicLists = await Promise.all(
          chapters.map((c) => getTopics(c.id).catch(() => [])),
        );
        const topicToChapter = new Map<string, string>();
        chapters.forEach((c, i) =>
          topicLists[i].forEach((t) => topicToChapter.set(t.id, c.id)),
        );
        if (!cancelled) setResult({ key, chapters, topicToChapter, modules });
      } catch {
        if (!cancelled) setResult({ key, failed: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeKey, accessToken, active]);

  const settled = result && result.key === activeKey ? result : null;
  const ok: LoadOk | null = settled && !("failed" in settled) ? settled : null;
  const failed = !!(settled && "failed" in settled);
  const loading = active != null && !settled;

  const { byChapter, other } = useMemo(() => {
    const map = new Map<string, ModuleListItem[]>();
    const rest: ModuleListItem[] = [];
    if (ok) {
      for (const m of ok.modules) {
        const chId = m.topic_id ? ok.topicToChapter.get(m.topic_id) : undefined;
        if (chId) {
          const arr = map.get(chId) ?? [];
          arr.push(m);
          map.set(chId, arr);
        } else {
          rest.push(m);
        }
      }
    }
    return { byChapter: map, other: rest };
  }, [ok]);

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <h1 className="text-[15px]">{copy.myModules}</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">{copy.myModulesSub}</p>

        {!profileLoading && pairs.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">{copy.noSubjects}</p>
        ) : null}

        {pairs.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {pairs.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPicked(p.key)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  active?.key === p.key
                    ? "border-transparent bg-accent text-accent-foreground"
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                {p.label}
              </button>
            ))}
            <div className="relative ml-auto">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={copy.searchPlaceholder}
                className="h-8 w-44 rounded-lg border border-border bg-background pr-2 pl-8 text-xs outline-none focus-visible:border-ring"
              />
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="mx-auto w-full max-w-2xl">
          {!active ? (
            profileLoading ? (
              <Spinner />
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">
                {copy.pickClassSubject}
              </p>
            )
          ) : loading ? (
            <Spinner />
          ) : failed ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              Couldn&apos;t load this class. Please try again.
            </p>
          ) : ok && ok.chapters.length === 0 && other.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              {copy.chaptersEmpty}
            </p>
          ) : ok ? (
            <ChapterList
              chapters={ok.chapters}
              modulesByChapter={byChapter}
              otherModules={other}
              search={query}
              onStartLesson={(chapterId) => {
                setGradeSubject(active.gradeId, active.subjectId);
                setChapter(chapterId);
                router.push("/dashboard");
              }}
            />
          ) : null}
        </div>
      </div>
    </main>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-16">
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
    </div>
  );
}
