"use client";

import { ChevronLeft, Download, KeyRound, Loader2, Pencil } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { GenerationToolbar } from "@/components/generation/generation-toolbar";
import { GenerationView } from "@/components/generation/generation-view";
import { Popover, PopoverItem } from "@/components/ui/popover";
import {
  generateAnswerKey,
  getGeneration,
  patchGeneration,
  type GenerationDetail,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCopy, useCurriculumT } from "@/lib/copy";
import { formatRelativeTime } from "@/lib/format";
import {
  TYPE_SLUG,
  type AnswerKey,
  type GenerationType,
  type LessonPlanContent,
  type QuestionPaperContent,
  type QuizContent,
} from "@/lib/generation-types";
import { exportLessonPlanDocx, exportLessonPlanPdf } from "@/lib/lesson-plan-export";
import {
  exportAnswerKeyDocx,
  exportAnswerKeyPdf,
  exportQuestionPaperDocx,
  exportQuestionPaperPdf,
} from "@/lib/question-paper-export";
import { exportQuizDocx, exportQuizPdf } from "@/lib/quiz-export";
import { useProfile } from "@/lib/profile-context";
import { streamGeneration } from "@/lib/sse";

type LoadState = { generation: GenerationDetail } | { missing: true } | null;

const EDITABLE: ReadonlySet<GenerationType> = new Set<GenerationType>([
  "lesson_plan",
  "quiz",
  "question_paper",
]);

/** The saved-generation viewer body, shared by every /{type-slug}/edit route
 * (see app/(protected)/(app)/{lesson-plan,quiz,question-paper,...}/edit/page.tsx).
 * For lesson_plan / quiz / question_paper it also supports inline editing +
 * PDF/Word download. */
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
  const { profile } = useProfile();

  const [state, setState] = useState<LoadState>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const [keyBusy, setKeyBusy] = useState(false);
  // Cache the generated key by a hash of the paper it was built from, so
  // "Answer key → PDF" then "→ Word" doesn't hit the LLM twice.
  const keyCacheRef = useRef<{ hash: string; key: AnswerKey } | null>(null);

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
  const completed = g.status === "completed";
  const editable = EDITABLE.has(g.type) && completed;
  const wide = g.type === "lesson_plan" ? "max-w-5xl" : g.type === "question_paper" ? "max-w-4xl" : "max-w-2xl";

  const lp = copy.generation.viewer.lessonPlan;
  const qz = copy.generation.viewer.quiz;
  const qp = copy.generation.viewer.questionPaper;
  const editCopy =
    g.type === "quiz" ? qz : g.type === "question_paper" ? qp : lp;

  const sub = [t.grade(g.grade_label ?? ""), t.subject(g.subject_name ?? ""), t.chapter(g.chapter_title ?? "")]
    .filter(Boolean)
    .join(" · ");

  const shownContent = editing && draft != null ? draft : g.content_json;

  function metaLine(): string | null {
    const params = (g.input_params ?? {}) as Record<string, unknown>;
    if (g.type === "lesson_plan") {
      const c = g.content_json as LessonPlanContent | null;
      return [
        `${lp.teacher}: ${profile?.full_name ?? "—"}`,
        `${lp.topic}: ${c?.topic || g.title}`,
        `${lp.periods}: ${c?.periods ?? c?.periods_detail?.length ?? "—"}`,
      ].join("    ");
    }
    if (g.type === "quiz") {
      const c = g.content_json as QuizContent | null;
      const mins = Number(params.time_limit_min) || undefined;
      return [
        `${qz.teacher}: ${profile?.full_name ?? "—"}`,
        mins ? qz.minutesMeta(mins) : "",
        qz.questionsMeta(c?.questions?.length ?? 0),
      ]
        .filter(Boolean)
        .join("    ");
    }
    if (g.type === "question_paper") {
      const c = g.content_json as QuestionPaperContent | null;
      return [
        `${qp.teacher}: ${profile?.full_name ?? "—"}`,
        qp.totalMarks(c?.total_marks ?? 0),
        qp.duration(c?.duration_min ?? 0),
      ].join("    ");
    }
    return null;
  }

  function startEdit() {
    if (g.content_json == null) return;
    setDraft(JSON.parse(JSON.stringify(g.content_json)));
    setEditing(true);
  }

  function cancelEdit() {
    setDraft(null);
    setEditing(false);
  }

  async function save() {
    if (draft == null) return;
    setSaving(true);
    try {
      const updated = await patchGeneration(accessToken, id, { content_json: draft });
      setState({ generation: updated });
      setEditing(false);
      setDraft(null);
      toast.success(editCopy.saved);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : editCopy.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  function downloadPdf() {
    const c = shownContent;
    if (g.type === "lesson_plan") {
      void exportLessonPlanPdf(c as LessonPlanContent, g.title, {
        teacher: profile?.full_name ?? undefined,
        topic: (c as LessonPlanContent)?.topic || undefined,
        periods: (c as LessonPlanContent)?.periods || undefined,
      });
    } else if (g.type === "quiz") {
      const params = (g.input_params ?? {}) as Record<string, unknown>;
      void exportQuizPdf(c as QuizContent, g.title, {
        grade: t.grade(g.grade_label ?? "") || undefined,
        subject: t.subject(g.subject_name ?? "") || undefined,
        teacher: profile?.full_name ?? undefined,
        chapter: t.chapter(g.chapter_title ?? "") || undefined,
        timeLimit: Number(params.time_limit_min) || undefined,
        level: (params.difficulty as string) || undefined,
      });
    } else if (g.type === "question_paper") {
      void exportQuestionPaperPdf(c as QuestionPaperContent, g.title, {
        subject: t.subject(g.subject_name ?? "") || undefined,
        grade: t.grade(g.grade_label ?? "") || undefined,
        teacher: profile?.full_name ?? undefined,
        topic: t.chapter(g.chapter_title ?? "") || undefined,
      });
    }
  }

  function downloadDocx() {
    const c = shownContent;
    if (g.type === "lesson_plan") {
      void exportLessonPlanDocx(c as LessonPlanContent, g.title, {
        teacher: profile?.full_name ?? undefined,
        topic: (c as LessonPlanContent)?.topic || undefined,
        periods: (c as LessonPlanContent)?.periods || undefined,
      });
    } else if (g.type === "quiz") {
      const params = (g.input_params ?? {}) as Record<string, unknown>;
      void exportQuizDocx(c as QuizContent, g.title, {
        grade: t.grade(g.grade_label ?? "") || undefined,
        subject: t.subject(g.subject_name ?? "") || undefined,
        teacher: profile?.full_name ?? undefined,
        chapter: t.chapter(g.chapter_title ?? "") || undefined,
        timeLimit: Number(params.time_limit_min) || undefined,
        level: (params.difficulty as string) || undefined,
      });
    } else if (g.type === "question_paper") {
      void exportQuestionPaperDocx(c as QuestionPaperContent, g.title, {
        subject: t.subject(g.subject_name ?? "") || undefined,
        grade: t.grade(g.grade_label ?? "") || undefined,
        teacher: profile?.full_name ?? undefined,
        topic: t.chapter(g.chapter_title ?? "") || undefined,
      });
    }
  }

  function paperMeta() {
    return {
      subject: t.subject(g.subject_name ?? "") || undefined,
      grade: t.grade(g.grade_label ?? "") || undefined,
      teacher: profile?.full_name ?? undefined,
      topic: t.chapter(g.chapter_title ?? "") || undefined,
    };
  }

  async function downloadAnswerKey(fmt: "pdf" | "docx") {
    if (g.type !== "question_paper") return;
    const paper = shownContent as QuestionPaperContent;
    const hash = JSON.stringify(paper);
    setKeyBusy(true);
    try {
      let key = keyCacheRef.current?.hash === hash ? keyCacheRef.current.key : null;
      if (!key) {
        key = await generateAnswerKey(accessToken, id, paper);
        keyCacheRef.current = { hash, key };
      }
      if (fmt === "pdf") await exportAnswerKeyPdf(key, g.title, paperMeta());
      else await exportAnswerKeyDocx(key, g.title, paperMeta());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : qp.answerKeyFailed);
    } finally {
      setKeyBusy(false);
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

  const line = editable ? metaLine() : null;

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

        {editable ? (
          <div className="flex shrink-0 items-center gap-2">
            {editing ? (
              <>
                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={saving}
                  className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted disabled:opacity-40"
                >
                  {editCopy.cancel}
                </button>
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
                  {saving ? editCopy.saving : editCopy.save}
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
                      {editCopy.download}
                    </span>
                  }
                >
                  <PopoverItem onClick={downloadPdf}>{editCopy.downloadPdf}</PopoverItem>
                  <PopoverItem onClick={downloadDocx}>{editCopy.downloadWord}</PopoverItem>
                </Popover>
                {g.type === "question_paper" ? (
                  <Popover
                    side="bottom"
                    align="end"
                    trigger={
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted">
                        {keyBusy ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <KeyRound className="size-3.5" />
                        )}
                        {keyBusy ? qp.answerKeyBuilding : qp.answerKey}
                      </span>
                    }
                  >
                    <PopoverItem onClick={() => void downloadAnswerKey("pdf")}>
                      {qp.answerKeyPdf}
                    </PopoverItem>
                    <PopoverItem onClick={() => void downloadAnswerKey("docx")}>
                      {qp.answerKeyWord}
                    </PopoverItem>
                  </Popover>
                ) : null}
                <button
                  type="button"
                  onClick={startEdit}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
                >
                  <Pencil className="size-3.5" />
                  {editCopy.edit}
                </button>
              </>
            )}
          </div>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className={`print-region mx-auto flex flex-col gap-4 ${wide}`}>
          {/* Only shows when printing — the on-screen title lives in the header
              bar, which print CSS hides. */}
          <h2 className="hidden text-lg font-semibold print:block">{g.title}</h2>
          {line ? (
            <p className="text-xs whitespace-pre-wrap text-muted-foreground">{line}</p>
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
              content={shownContent}
              generationId={g.id}
              editing={editing}
              onContentChange={(next) => setDraft(next)}
            />
          )}

          {!editing ? (
            <div className="print:hidden">
              <GenerationToolbar
                id={g.id}
                isFavorite={g.is_favorite}
                feedback={g.feedback}
                regenerating={regenerating}
                onRegenerate={() => void onRegenerate()}
                onDeleted={() => router.push(backHref)}
              />
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
