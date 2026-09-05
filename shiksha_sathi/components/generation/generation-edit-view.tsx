"use client";

import { ChevronLeft, Download, Loader2, Pencil } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { GenerationToolbar } from "@/components/generation/generation-toolbar";
import { GenerationView } from "@/components/generation/generation-view";
import { Popover, PopoverItem } from "@/components/ui/popover";
import { getGeneration, patchGeneration, type GenerationDetail } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCopy, useCurriculumT } from "@/lib/copy";
import { formatRelativeTime } from "@/lib/format";
import { TYPE_SLUG, type GenerationType, type LessonPlanContent } from "@/lib/generation-types";
import { exportLessonPlanDocx, exportLessonPlanPdf } from "@/lib/lesson-plan-export";
import { useProfile } from "@/lib/profile-context";
import { streamGeneration } from "@/lib/sse";

type LoadState = { generation: GenerationDetail } | { missing: true } | null;

/** The saved-generation viewer body, shared by every /{type-slug}/edit route
 * (see app/(protected)/(app)/{lesson-plan,presentation,...}/edit/page.tsx).
 * For lesson_plan it also supports inline table editing + PDF/Word download. */
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
  const lp = copy.generation.viewer.lessonPlan;
  const t = useCurriculumT();
  const router = useRouter();
  const { accessToken } = useAuth();
  const { profile } = useProfile();

  const [state, setState] = useState<LoadState>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<LessonPlanContent | null>(null);
  const [saving, setSaving] = useState(false);

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
  const isLessonPlan = g.type === "lesson_plan";
  const completed = g.status === "completed";
  const lpContent = isLessonPlan ? (g.content_json as LessonPlanContent) : null;
  const shown = editing && draft ? draft : lpContent;

  const sub = [t.grade(g.grade_label ?? ""), t.subject(g.subject_name ?? ""), t.chapter(g.chapter_title ?? "")]
    .filter(Boolean)
    .join(" · ");

  const meta = {
    teacher: profile?.full_name ?? undefined,
    topic: lpContent?.topic || undefined,
    periods: lpContent?.periods || undefined,
  };

  function startEdit() {
    if (!lpContent) return;
    setDraft(JSON.parse(JSON.stringify(lpContent)) as LessonPlanContent);
    setEditing(true);
  }

  function cancelEdit() {
    setDraft(null);
    setEditing(false);
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      const updated = await patchGeneration(accessToken, id, { content_json: draft });
      setState({ generation: updated });
      setEditing(false);
      setDraft(null);
      toast.success(lp.saved);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : lp.saveFailed);
    } finally {
      setSaving(false);
    }
  }

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

        {isLessonPlan && completed ? (
          <div className="flex shrink-0 items-center gap-2">
            {editing ? (
              <>
                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={saving}
                  className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted disabled:opacity-40"
                >
                  {lp.cancel}
                </button>
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
                  {saving ? lp.saving : lp.save}
                </button>
              </>
            ) : (
              <>
                <Popover
                  side="bottom"
                  align="end"
                  trigger={
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted">
                      <Download className="size-3.5" />
                      {lp.download}
                    </span>
                  }
                >
                  <PopoverItem
                    onClick={() =>
                      shown && void exportLessonPlanPdf(shown, g.title, meta)
                    }
                  >
                    {lp.downloadPdf}
                  </PopoverItem>
                  <PopoverItem
                    onClick={() =>
                      shown && void exportLessonPlanDocx(shown, g.title, meta)
                    }
                  >
                    {lp.downloadWord}
                  </PopoverItem>
                </Popover>
                <button
                  type="button"
                  onClick={startEdit}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
                >
                  <Pencil className="size-3.5" />
                  {lp.edit}
                </button>
              </>
            )}
          </div>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className={`mx-auto flex flex-col gap-4 ${isLessonPlan ? "max-w-5xl" : "max-w-2xl"}`}>
          {isLessonPlan && completed ? (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{lp.teacher}:</span>{" "}
              {profile?.full_name ?? "—"}
              {"   "}
              <span className="font-medium text-foreground">{lp.topic}:</span>{" "}
              {lpContent?.topic || g.title}
              {"   "}
              <span className="font-medium text-foreground">{lp.periods}:</span>{" "}
              {lpContent?.periods ?? lpContent?.periods_detail?.length ?? "—"}
            </p>
          ) : null}

          {g.status === "failed" ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {copy.generation.viewer.failedTitle}
              {g.error_message ? (
                <p className="mt-1 text-xs text-destructive/80">{g.error_message}</p>
              ) : null}
            </div>
          ) : !completed ? (
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {copy.generation.create.generating}
            </div>
          ) : (
            <GenerationView
              type={g.type}
              title={g.title}
              content={editing && draft ? draft : g.content_json}
              generationId={g.id}
              editing={editing}
              onLessonPlanChange={(next) => setDraft(next)}
            />
          )}

          {!editing ? (
            <GenerationToolbar
              id={g.id}
              isFavorite={g.is_favorite}
              feedback={g.feedback}
              regenerating={regenerating}
              onRegenerate={() => void onRegenerate()}
              onDeleted={() => router.push(backHref)}
            />
          ) : null}
        </div>
      </div>
    </main>
  );
}
