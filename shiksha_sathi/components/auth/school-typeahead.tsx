"use client";

import { useEffect, useState } from "react";
import { MapPin, Search } from "lucide-react";

import { apiFetch, type SchoolSearchResult } from "@/lib/api";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { Input } from "@/components/ui/input";

type Props = {
  id?: string;
  value: SchoolSearchResult | null;
  onChange: (school: SchoolSearchResult | null) => void;
  placeholder?: string;
};

/**
 * School picker backed by `GET /schools/search`. Editing the text after a
 * selection clears it -- the id we'd submit must always match what's on screen.
 * A trimmed-down cousin of the onboarding wizard's step-profile search.
 */
export function SchoolTypeahead({ id, value, onChange, placeholder }: Props) {
  const [query, setQuery] = useState(value?.name ?? "");
  const [results, setResults] = useState<SchoolSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const debounced = useDebouncedValue(query, 300);

  useEffect(() => {
    if (value && query !== value.name) onChange(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reacts to `query` only
  }, [query]);

  const term = debounced.trim();
  const eligible = term.length >= 2 && !value;

  useEffect(() => {
    // stale `results` stay in state but are never rendered unless `eligible`
    if (!eligible) return;
    let cancelled = false;
    apiFetch(`/schools/search?q=${encodeURIComponent(term)}`)
      .then((r) => (r.ok ? (r.json() as Promise<SchoolSearchResult[]>) : []))
      .then((data) => {
        if (!cancelled) setResults(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [eligible, term]);

  function select(school: SchoolSearchResult) {
    onChange(school);
    setQuery(school.name);
    setOpen(false);
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
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder ?? "Search by school name"}
        className="h-11 pl-9 text-base"
        autoComplete="off"
      />

      {open && eligible && results.length > 0 && (
        <div className="absolute top-full z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-md">
          {results.map((school) => (
            <button
              key={school.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select(school)}
              className="flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left transition-colors hover:bg-accent"
            >
              <span className="text-sm font-medium">{school.name}</span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="size-3" />
                {school.district_name}
                {school.block_name ? ` · ${school.block_name}` : ""}
              </span>
            </button>
          ))}
        </div>
      )}
      {open && eligible && results.length === 0 && (
        <p className="absolute top-full z-20 mt-1 w-full rounded-lg border border-border bg-popover px-3 py-2.5 text-sm text-muted-foreground shadow-md">
          No schools found. Try a different spelling.
        </p>
      )}
    </div>
  );
}
