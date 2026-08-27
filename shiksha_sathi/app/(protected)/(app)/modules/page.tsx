"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { FilterChips } from "@/components/modules/filter-chips";
import { ModuleRow } from "@/components/modules/module-row";
import { listModules, type ModuleListItem } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { copy } from "@/lib/copy";

function gradeLevel(label: string): number {
  return parseInt(label.replace(/\D/g, ""), 10) || 0;
}

export default function ModulesPage() {
  const { accessToken } = useAuth();
  const [modules, setModules] = useState<ModuleListItem[] | null>(null);
  const [grade, setGrade] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    listModules(accessToken)
      .then((m) => !cancelled && setModules(m))
      .catch(() => !cancelled && setModules([]));
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const grades = useMemo(() => {
    const seen = new Set<string>();
    for (const m of modules ?? []) seen.add(m.grade_label);
    return [...seen].sort((a, b) => gradeLevel(a) - gradeLevel(b));
  }, [modules]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (modules ?? []).filter(
      (m) =>
        (grade === null || m.grade_label === grade) &&
        (q === "" || m.title.toLowerCase().includes(q)),
    );
  }, [modules, grade, query]);

  // filtered keeps the server's updated_at-desc order; first-seen group order
  // therefore lists the most recently touched subject first.
  const groups = useMemo(() => {
    const map = new Map<string, ModuleListItem[]>();
    for (const m of filtered) {
      const key = `${m.grade_label} · ${m.subject_name}`;
      let arr = map.get(key);
      if (!arr) {
        arr = [];
        map.set(key, arr);
      }
      arr.push(m);
    }
    return [...map.entries()];
  }, [filtered]);

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <h1 className="mb-3 text-[15px]">{copy.myModules}</h1>
        <FilterChips
          grades={grades}
          active={grade}
          onSelect={setGrade}
          query={query}
          onQuery={setQuery}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {modules === null ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-sm text-muted-foreground">
            <p>{copy.emptyModules}</p>
            <Link href="/dashboard" className="text-primary underline">
              {copy.nav.home}
            </Link>
          </div>
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-5">
            {groups.map(([key, rows]) => (
              <div key={key}>
                <div className="mb-2 text-[11px] tracking-wide text-muted-foreground">
                  {key.toUpperCase()}
                </div>
                <div className="flex flex-col gap-2">
                  {rows.map((m) => (
                    <ModuleRow key={m.id} module={m} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
