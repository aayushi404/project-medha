"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { AskMedhaBar } from "@/components/app/ask-medha-bar";
import { GenerationRow } from "@/components/generation/generation-row";
import { useTypeMeta } from "@/components/generation/type-meta";
import { Select, type SelectOption } from "@/components/ui/select";
import { listGenerations, type GenerationListItem } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCopy } from "@/lib/copy";
import { SUPPORTED_TYPES, type GenerationType } from "@/lib/generation-types";
import { cn } from "@/lib/utils";

const LIMIT = 30;

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
        "shrink-0 rounded-full border px-3.5 py-1.5 text-xs whitespace-nowrap transition-colors pointer-coarse:px-4 pointer-coarse:py-2",
        active
          ? "border-transparent bg-violet text-violet-foreground"
          : "border-border text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function TypeTabLabel({ type }: { type: GenerationType }) {
  const { label } = useTypeMeta(type);
  return <>{label}</>;
}

export default function HistoryPage() {
  const copy = useCopy();
  const { accessToken } = useAuth();

  const [type, setType] = useState<GenerationType | null>(null);
  const [sort, setSort] = useState<"date" | "title">("date");
  const key = `${type ?? "all"}|${sort}`;

  // Keyed-result pattern (matches components/dashboard/chapter-history.tsx):
  // the effect only ever setState from inside its async callback, never
  // synchronously in the effect body -- "reset to loading" is a derived read
  // (result.key !== key), not an imperative setState call.
  type ListState = { key: string; items: GenerationListItem[] } | { key: string; failed: true } | null;
  const [result, setResult] = useState<ListState>(null);
  const [more, setMore] = useState<{ key: string; items: GenerationListItem[] }>({
    key: "",
    items: [],
  });
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await listGenerations(accessToken, { type: type ?? undefined, sort, limit: LIMIT });
        if (!cancelled) setResult({ key, items: rows });
      } catch {
        if (!cancelled) setResult({ key, failed: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, key, type, sort]);

  const settled = result && result.key === key ? result : null;
  const firstPage = settled && !("failed" in settled) ? settled.items : [];
  const extraItems = more.key === key ? more.items : [];
  const items = settled && !("failed" in settled) ? [...firstPage, ...extraItems] : null;
  const failed = !!(settled && "failed" in settled);

  async function loadMore() {
    if (!items || items.length === 0 || sort === "title") return;
    setLoadingMore(true);
    try {
      const cursor = items[items.length - 1].created_at;
      const rows = await listGenerations(accessToken, {
        type: type ?? undefined,
        sort,
        limit: LIMIT,
        cursor,
      });
      setMore({ key, items: [...extraItems, ...rows] });
    } catch {
      /* the load-more button just stays put; the list already loaded is fine */
    } finally {
      setLoadingMore(false);
    }
  }

  const sortOptions: SelectOption[] = [
    { value: "date", label: copy.history.sortDate },
    { value: "title", label: copy.history.sortTitle },
  ];

  return (
    <main className="flex flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl">{copy.history.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{copy.history.subtitle}</p>
          </div>
          <AskMedhaBar className="w-full sm:w-72" />
        </div>

        <div className="mt-6 flex items-center gap-2 overflow-x-auto pb-1">
          <TabChip active={type === null} onClick={() => setType(null)}>
            {copy.history.all}
          </TabChip>
          {SUPPORTED_TYPES.map((t) => (
            <TabChip key={t} active={type === t} onClick={() => setType(t)}>
              <TypeTabLabel type={t} />
            </TabChip>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-end gap-2 text-xs text-muted-foreground">
          {copy.history.sortBy}
          <Select
            value={sort}
            options={sortOptions}
            onValueChange={(v) => setSort(v as "date" | "title")}
            ariaLabel={copy.history.sortBy}
          />
        </div>

        <div className="mt-3 flex flex-col gap-2 pb-8">
          {items === null ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : failed ? (
            <p className="rounded-2xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
              {copy.history.failed}
            </p>
          ) : items.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
              {copy.history.empty}
            </p>
          ) : (
            <>
              {items.map((item) => (
                <GenerationRow key={item.id} item={item} from="history" />
              ))}
              {sort === "date" && items.length >= LIMIT ? (
                <button
                  type="button"
                  onClick={() => void loadMore()}
                  disabled={loadingMore}
                  className="mt-2 self-center rounded-full border border-border px-4 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
                >
                  {loadingMore ? copy.history.loading : copy.history.loadMore}
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
