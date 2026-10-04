"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";

import { searchPrincipalStudents, type StudentRosterItem } from "@/lib/api";
import { StudentCard } from "@/components/students/student-card";

const MIN_CHARS = 2;
const DEBOUNCE_MS = 300;
/** Must match SEARCH_LIMIT in backend principal/service.py. */
const SERVER_LIMIT = 25;

/** Find any admitted student of this school by name, email or login phone.
 * Searches the server, so it works for a school of any size. */
export function StudentSearch({ token }: { token: string | null }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StudentRosterItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // only the newest request may write results, so a slow old reply can't overwrite a newer one
  const latest = useRef(0);

  const text = query.trim();
  const searching = text.length >= MIN_CHARS;

  useEffect(() => {
    const id = ++latest.current;
    if (!token || text.length < MIN_CHARS) {
      return;
    }
    const timer = setTimeout(() => {
      setLoading(true);
      searchPrincipalStudents(token, text)
        .then((rows) => {
          if (id !== latest.current) return;
          setResults(rows);
          setError(null);
        })
        .catch((err: unknown) => {
          if (id !== latest.current) return;
          setResults(null);
          setError(err instanceof Error && err.message ? err.message : "Search failed. Try again.");
        })
        .finally(() => {
          if (id === latest.current) setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [token, text]);

  function clear() {
    latest.current++;
    setQuery("");
    setResults(null);
    setError(null);
    setLoading(false);
  }

  return (
    <section aria-labelledby="student-search-title" className="flex flex-col gap-3">
      <div>
        <h2 id="student-search-title" className="text-sm font-semibold text-foreground">
          Find a student
        </h2>
        <p className="text-xs text-muted-foreground">
          Search by name, email or login phone. Type at least {MIN_CHARS} characters.
        </p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") clear();
          }}
          placeholder="Name, email or phone"
          aria-label="Search students"
          autoComplete="off"
          maxLength={80}
          className="h-10 w-full rounded-lg border border-input bg-background pr-10 pl-9 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        {query ? (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear search"
            className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
          </button>
        ) : null}
      </div>

      <div aria-live="polite" className="text-sm">
        {!searching && query.trim().length > 0 ? (
          <p className="text-xs text-muted-foreground">Keep typing: at least {MIN_CHARS} characters.</p>
        ) : null}
        {error ? <p className="text-destructive">{error}</p> : null}
        {searching && results && results.length === 0 && !loading && !error ? (
          <p className="text-muted-foreground">No student matches “{text}”.</p>
        ) : null}
        {searching && results && results.length > 0 ? (
          <>
            <p className="mb-2 text-xs text-muted-foreground">
              {results.length >= SERVER_LIMIT
                ? `Showing the first ${SERVER_LIMIT} matches. Add more letters to narrow it down.`
                : `${results.length} ${results.length === 1 ? "match" : "matches"}`}
            </p>
            <ul className="flex flex-col gap-2">
              {results.map((s) => (
                <li key={s.id}>
                  <StudentCard student={s} href={`/principal/students/${s.id}`} />
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </section>
  );
}
