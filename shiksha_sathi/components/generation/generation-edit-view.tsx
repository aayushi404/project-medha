"use client";

import { ChevronLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { GenerationToolbar } from "@/components/generation/generation-toolbar";
import { GenerationView } from "@/components/generation/generation-view";
import { getGeneration, type GenerationDetail } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCopy, useCurriculumT } from "@/lib/copy";
import { formatRelativeTime } from "@/lib/format";
import { TYPE_SLUG, type GenerationType } from "@/lib/generation-types";
import { streamGeneration } from "@/lib/sse";

type LoadState = { generation: GenerationDetail } | { missing: true } | null;

/** The saved-generation viewer body, shared by every /{type-slug}/edit route
 * (see app/(protected)/(app)/{lesson-plan,presentation,...}/edit/page.tsx).
 * `from` (history | dashboard | create | null) decides where the back arrow
 * and post-delete/regenerate redirects land, matching the SAVRA reference's
 * `?from=history` query param. */
export function GenerationEditView({
  type,
  id,
  from,
}: {
  type: GenerationType;
  id: string;
  from?: string | null;
}) {
  const copy = useCopy();
  const t = useCurriculumT();
  const router = useRouter();
  const { accessToken } = useAuth();

  const [state, setState] = useState<LoadState>(null);
  const [regenerating, setRegenerating] = useState(false);

  const backHref = from === "history" ? "/history" : "/dashboard";

  useEffect(() => {
    let cancelled = false;
    getGeneration(accessToken, id)
      .then((generation) => !cancelled && setState({ generation }))
      .catch(() => !cancelled && setState({ missing: true }));
    return () => {
      cancelled = true;
    };
  }, [accessToken, id]);

  if (state && "missing" in state) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
        <p>{copy.generation.viewer.notFound}</p>
        <Link href={backHref} className="text-primary underline">
          {copy.back}
        </Link>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </main>
    );
  }

  const g = state.generation;
  const sub = [t.grade(g.grade_label ?? ""), t.subject(g.subject_name ?? ""), t.chapter(g.chapter_title ?? "")]
    .filter(Boolean)
    .join(" · ");

  async function onRegenerate() {
    setRegenerating(true);
    await streamGeneration(
      `/generations/${id}/regenerate`,
      {},
      accessToken,
      {
        onToken: () => {},
        onProgress: () => {},
        onDone: (payload) => {
          setRegenerating(false);
          if (payload.generation_id) {
            const qs = from ? `?id=${payload.generation_id}&from=${from}` : `?id=${payload.generation_id}`;
            router.push(`/${TYPE_SLUG[type]}/edit${qs}`);
          }
        },
        onError: (msg) => {
          setRegenerating(false);
          toast.error(msg || copy.generation.create.failed);
        },
      },
    );
  }

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-start gap-3 border-b border-border px-5 py-4">
        <Link
          href={backHref}
          className="mt-0.5 rounded-lg p-1 hover:bg-muted"
          aria-label={copy.back}
        >
          <ChevronLeft className="size-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-[15px]">{g.title}</h1>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {sub ? `${sub} · ` : ""}
            {formatRelativeTime(g.updated_at)}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {g.status === "failed" ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {copy.generation.viewer.failedTitle}
              {g.error_message ? (
                <p className="mt-1 text-xs text-destructive/80">{g.error_message}</p>
              ) : null}
            </div>
          ) : g.status !== "completed" ? (
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {copy.generation.create.generating}
            </div>
          ) : (
            <GenerationView type={g.type} title={g.title} content={g.content_json} generationId={g.id} />
          )}

          <GenerationToolbar
            id={g.id}
            isFavorite={g.is_favorite}
            feedback={g.feedback}
            regenerating={regenerating}
            onRegenerate={() => void onRegenerate()}
            onDeleted={() => router.push(backHref)}
          />
        </div>
      </div>
    </main>
  );
}
