"use client";

import { Search } from "lucide-react";
import type { ReactNode } from "react";

import { useCopy } from "@/lib/copy";
import { cn } from "@/lib/utils";

type FilterChipsProps = {
  grades: string[];
  active: string | null;
  onSelect: (grade: string | null) => void;
  query: string;
  onQuery: (q: string) => void;
};

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
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

export function FilterChips({ grades, active, onSelect, query, onQuery }: FilterChipsProps) {
  const copy = useCopy();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Chip active={active === null} onClick={() => onSelect(null)}>
        {copy.filterAll}
      </Chip>
      {grades.map((g) => (
        <Chip key={g} active={active === g} onClick={() => onSelect(g)}>
          {g}
        </Chip>
      ))}
      <div className="relative ml-auto">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={copy.searchPlaceholder}
          className="h-8 w-44 rounded-lg border border-border bg-background pr-2 pl-8 text-xs outline-none focus-visible:border-ring"
        />
      </div>
    </div>
  );
}
