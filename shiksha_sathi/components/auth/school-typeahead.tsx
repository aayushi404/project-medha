"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, MapPin, School as SchoolIcon, Search, X } from "lucide-react";

import { apiFetch, type SchoolSearchResult } from "@/lib/api";
import { findBiharSchool } from "@/lib/bihar-schools";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { Input } from "@/components/ui/input";

type Props = {
  id?: string;
  value: SchoolSearchResult | null;
  onChange: (school: SchoolSearchResult | null) => void;
  placeholder?: string;
  requireUdise?: boolean;
};

/**
 * School & UDISE code picker backed by backend search and Bihar School registry.
 * Supports searching by School Code (e.g. 10280105528) or School Name.
 */
export function SchoolTypeahead({ id, value, onChange, placeholder, requireUdise }: Props) {
  const [query, setQuery] = useState(value?.name ?? "");
  const [results, setResults] = useState<SchoolSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const debounced = useDebouncedValue(query, 250);

  useEffect(() => {
    if (value && query !== value.name && query !== value.udise_code) {
      // do not clear immediately if query is being matched
    }
  }, [query, value]);

  const term = debounced.trim();
  const eligible = term.length >= 1 && !value;

  useEffect(() => {
    if (!eligible) return;
    let cancelled = false;

    // 1. Instant local match from Bihar registry
    const localMatches = findBiharSchool(term);

    // 2. Fetch from backend API
    apiFetch(`/schools/search?q=${encodeURIComponent(term)}`)
      .then((r) => (r.ok ? (r.json() as Promise<SchoolSearchResult[]>) : []))
      .then((backendMatches) => {
        if (cancelled) return;
        // Merge without duplicates (by udise_code or id)
        const map = new Map<string, SchoolSearchResult>();
        for (const s of localMatches) {
          map.set(s.udise_code ?? s.id, s);
        }
        for (const s of backendMatches) {
          map.set(s.udise_code ?? s.id, s);
        }
        setResults(Array.from(map.values()));
      })
      .catch(() => {
        if (!cancelled) setResults(localMatches);
      });

    return () => {
      cancelled = true;
    };
  }, [eligible, term]);

  function select(school: SchoolSearchResult) {
    onChange(school);
    setQuery(school.name);
    setOpen(false);
  }

  function clearSelection() {
    onChange(null);
    setQuery("");
    setOpen(true);
  }

  // If a school is already selected, show a verified card
  if (value) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 shadow-sm transition-all">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-xs">
              <SchoolIcon className="size-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <strong className="text-sm font-bold text-slate-900">{value.name}</strong>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                  <CheckCircle2 className="size-3" /> Verified Bihar School
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                {value.udise_code && (
                  <span className="font-mono font-semibold text-blue-800">
                    School Code (UDISE): <strong>{value.udise_code}</strong>
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <MapPin className="size-3 text-slate-400" />
                  {value.district_name}
                  {value.block_name ? ` · ${value.block_name}` : ""}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={clearSelection}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-emerald-100 hover:text-slate-800 transition-colors"
          >
            <X className="size-3.5" /> Change
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        id={id}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder={
          placeholder ??
          (requireUdise
            ? "Enter School Code (e.g. 10280105528) or School Name"
            : "Search by School Code or School Name")
        }
        className="h-11 pl-9 pr-4 text-sm bg-slate-50/70 border-slate-200 focus:bg-white"
        autoComplete="off"
      />

      {open && eligible && results.length > 0 && (
        <div className="absolute top-full z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
          {results.map((school) => (
            <button
              key={school.id || school.udise_code}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select(school)}
              className="flex w-full flex-col items-start gap-1 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-slate-100/80"
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-900">{school.name}</span>
                {school.udise_code && (
                  <span className="rounded bg-blue-50 px-2 py-0.5 font-mono text-xs font-bold text-blue-700">
                    Code: {school.udise_code}
                  </span>
                )}
              </div>
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <MapPin className="size-3" />
                {school.district_name}
                {school.block_name ? ` · ${school.block_name}` : ""}
              </span>
            </button>
          ))}
        </div>
      )}

      {open && eligible && results.length === 0 && (
        <div className="absolute top-full z-30 mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600 shadow-lg">
          <p>No school found with code or name &quot;{query}&quot;.</p>
          {/^\d{7,11}$/.test(query.trim()) && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                select({
                  id: `custom-${query.trim()}`,
                  name: `Govt. School (Code: ${query.trim()})`,
                  district_name: "Bihar",
                  block_name: null,
                  udise_code: query.trim(),
                });
              }}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
            >
              + Use School Code {query.trim()}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
