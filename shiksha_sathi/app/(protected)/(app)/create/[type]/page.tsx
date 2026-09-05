"use client";

import { ChevronLeft, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { redirect, useParams, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { ContextBar } from "@/components/app/context-bar";
import { ParamPanel, type ParamValue } from "@/components/generation/param-panel";
import { useTypeMeta } from "@/components/generation/type-meta";
import { useAuth } from "@/lib/auth-context";
import { useCopy } from "@/lib/copy";
import {
  DEFAULT_PARAMS,
  TYPE_SLUG,
  isGenerationType,
  type GenerationType,
} from "@/lib/generation-types";
import { useLessonContext } from "@/lib/lesson-context";
import { useProfile } from "@/lib/profile-context";
import { streamGeneration } from "@/lib/sse";

function TypeIcon({ type }: { type: GenerationType }) {
  const { Icon } = useTypeMeta(type);
  return <Icon className="size-4" />;
}

function CreateForm({ type }: { type: GenerationType }) {
  const copy = useCopy();
  const { label } = useTypeMeta(type);
  const router = useRouter();
  const { accessToken } = useAuth();
  const { profile } = useProfile();
  const { gradeId, subjectId, chapterId, topicId } = useLessonContext();

  const [params, setParams] = useState<ParamValue>({ ...DEFAULT_PARAMS[type] });
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState("");
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  function patch(p: ParamValue) {
    setParams((prev) => ({ ...prev, ...p }));
  }

  async function onGenerate() {
    if (!gradeId || !subjectId) {
      toast.error(copy.generation.create.scopeRequired);
      return;
    }
    setBusy(true);
    setPreview("");
    setProgressLabel(type === "presentation" ? copy.generation.create.buildingSlides : null);

    const ac = new AbortController();
    abortRef.current = ac;

    await streamGeneration(
      `/generate/${type}`,
      {
        scope: { grade_id: gradeId, subject_id: subjectId, chapter_id: chapterId, topic_id: topicId },
        params,
        language: profile?.preferred_language,
      },
      accessToken,
      {
        onToken: (t) => setPreview((prev) => prev + t),
        onProgress: () => setProgressLabel(copy.generation.create.buildingSlides),
        onDone: (payload) => {
          if (payload.cached) toast.success(copy.generation.create.reusedEarlier);
          if (payload.generation_id) {
            router.replace(`/${TYPE_SLUG[type]}/edit?id=${payload.generation_id}&from=create`);
          }
          else setBusy(false);
        },
        onError: (msg) => {
          toast.error(msg || copy.generation.create.failed);
          setBusy(false);
          setProgressLabel(null);
        },
      },
      ac.signal,
    );
  }

  function onCancel() {
    abortRef.current?.abort();
    setBusy(false);
    setProgressLabel(null);
  }

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
        <Link href="/dashboard" className="rounded-lg p-1 hover:bg-muted" aria-label={copy.back}>
          <ChevronLeft className="size-4" />
        </Link>
        <span className="flex size-7 items-center justify-center rounded-md bg-accent text-terracotta">
          <TypeIcon type={type} />
        </span>
        <h1 className="text-[15px] font-medium">{label}</h1>
      </div>

      <ContextBar />

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-5">
          <ParamPanel type={type} params={params} onPatch={patch} disabled={busy} />

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void onGenerate()}
              disabled={busy || !gradeId || !subjectId}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-40"
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {busy ? copy.generation.create.generating : copy.generation.create.generateBtn}
            </button>
            {busy ? (
              <button
                type="button"
                onClick={onCancel}
                className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
              >
                {copy.generation.create.cancel}
              </button>
            ) : null}
          </div>

          {busy ? (
            <div className="rounded-2xl border border-border bg-card p-4 text-sm">
              {progressLabel ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  {progressLabel}
                </div>
              ) : preview ? (
                <p className="max-h-64 overflow-y-auto whitespace-pre-wrap text-muted-foreground">
                  {preview}
                  <span className="ml-0.5 inline-block h-4 w-[3px] animate-pulse bg-foreground/50 align-middle" />
                </p>
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  {copy.generation.create.generating}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}

export default function CreateTypePage() {
  const copy = useCopy();
  const { type } = useParams<{ type: string }>();

  // Lesson plan has a dedicated 2-step wizard at /lesson-plan.
  if (type === "lesson_plan") redirect("/lesson-plan");

  if (!isGenerationType(type)) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
        <p>{copy.moduleNotFound}</p>
        <Link href="/dashboard" className="text-primary underline">
          {copy.nav.home}
        </Link>
      </main>
    );
  }

  return <CreateForm type={type} />;
}
