"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useContextOptions } from "@/components/app/context-bar";
import { LiveQuiz } from "@/components/quiz-live/live-quiz";
import { ReviewStep } from "@/components/quiz-live/review-step";
import { SettingsStep } from "@/components/quiz-live/settings-step";
import { StepIndicator } from "@/components/quiz-live/step-indicator";
import { StudentsStep } from "@/components/quiz-live/students-step";
import { TopicsStep } from "@/components/quiz-live/topics-step";
import type { LiveStep, Participant, QuizQ, RosterState } from "@/components/quiz-live/types";
import { getGeneration, getStudentRoster, patchGeneration } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCurriculumT } from "@/lib/copy";
import { DEFAULT_PARAMS, type QuizContent, type QuizParams } from "@/lib/generation-types";
import { useLessonContext } from "@/lib/lesson-context";
import { useProfile } from "@/lib/profile-context";
import { streamGeneration } from "@/lib/sse";

const LEVEL_LABEL: Record<QuizParams["difficulty"], string> = {
  easy: "Easy",
  medium: "Standard",
  hard: "Hard",
  mixed: "Mixed",
};

/** Orchestrator for the 5-page Live Classroom Quiz flow. Owns every piece of
 *  state that needs to survive moving between steps (topics/settings live in
 *  the shared lesson context + local state; the roster fetch and the
 *  generated quiz do not exist anywhere else, so they live here) and renders
 *  whichever step is active. One route, one internal state machine -- see
 *  docs/mehda-v2-live-quiz.md and the approved plan for why. */
export function LiveQuizFlow() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const { profile } = useProfile();
  const { topicId } = useLessonContext();
  const t = useCurriculumT();
  const { gradeId, subjectId, chapterId, gradeOptions, subjectOptions, chapters } = useContextOptions();

  const [step, setStep] = useState<LiveStep>("topics");
  const [settings, setSettings] = useState<QuizParams>(DEFAULT_PARAMS.quiz);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [repeatStudents, setRepeatStudents] = useState(false);
  // Keyed by the grade it was fetched for, so a class switch shows "loading"
  // for free (the derived `roster` below) without ever resetting state
  // synchronously inside the fetch effect.
  const [rosterEntry, setRosterEntry] = useState<{ gradeId: string | null; state: RosterState }>({
    gradeId: null,
    state: { status: "loading" },
  });
  const [rosterRetryKey, setRosterRetryKey] = useState(0);
  const roster: RosterState = rosterEntry.gradeId === gradeId ? rosterEntry.state : { status: "loading" };
  const [generating, setGenerating] = useState(false);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQ[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const gradeLabel = gradeOptions.find((o) => o.value === gradeId)?.label ?? "";
  const subjectLabel = subjectOptions.find((o) => o.value === subjectId)?.label ?? "";
  const chapterLabel = chapters.find((c) => c.id === chapterId)?.title ? t.chapter(chapters.find((c) => c.id === chapterId)!.title) : "";

  // Fetch the class roster as soon as a class is picked, independent of which
  // step is showing, so it's usually already loaded by the time the teacher
  // reaches the Students step.
  useEffect(() => {
    if (!gradeId) return;
    let cancelled = false;
    getStudentRoster(accessToken)
      .then((all) => {
        if (cancelled) return;
        const inClass = all.filter((s) => s.grade_id === gradeId);
        setRosterEntry({
          gradeId,
          state: inClass.length === 0 ? { status: "empty" } : { status: "ready", students: inClass },
        });
      })
      .catch(() => {
        if (!cancelled) setRosterEntry({ gradeId, state: { status: "error" } });
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, gradeId, rosterRetryKey]);

  async function handleGenerate() {
    if (!gradeId || !subjectId || !chapterId) {
      toast.error("Select a class, subject, and chapter first.");
      return;
    }
    if (selectedIds.size === 0) {
      toast.error("Select at least one student.");
      return;
    }
    setGenerating(true);
    const ac = new AbortController();
    abortRef.current = ac;

    await streamGeneration(
      "/generate/quiz",
      {
        scope: { grade_id: gradeId, subject_id: subjectId, chapter_id: chapterId, topic_id: topicId },
        params: settings,
        language: profile?.preferred_language,
      },
      accessToken,
      {
        onToken: () => {},
        onDone: async (payload) => {
          if (!payload.generation_id) {
            setGenerating(false);
            toast.error("Something went wrong generating the quiz.");
            return;
          }
          try {
            const detail = await getGeneration(accessToken, payload.generation_id);
            const content = detail.content_json as QuizContent;
            setGenerationId(detail.id);
            setQuestions(content.questions ?? []);
            setStep("review");
          } catch {
            toast.error("The quiz was generated but couldn't be loaded. Please try again.");
          } finally {
            setGenerating(false);
          }
        },
        onError: (msg) => {
          toast.error(msg || "Couldn't generate the quiz.");
          setGenerating(false);
        },
      },
      ac.signal,
    );
  }

  function handleQuestionsChange(next: QuizQ[]) {
    setQuestions(next);
    if (!generationId) return;
    patchGeneration(accessToken, generationId, { content_json: { questions: next } }).catch(() => {
      toast.error("Couldn't save that edit. It will still be used for this session.");
    });
  }

  function exitLive() {
    router.push("/dashboard");
  }

  if (step === "live") {
    const students = roster.status === "ready" ? roster.students : [];
    const participants: Participant[] = students
      .filter((s) => selectedIds.has(s.id))
      .map((s) => ({ id: s.id, name: s.full_name, rollNumber: s.roll_number, gradeLabel: s.grade_label }));

    return (
      <LiveQuiz
        questions={questions}
        participants={participants}
        repeatStudents={repeatStudents}
        gradeLabel={gradeLabel}
        subjectLabel={subjectLabel}
        chapterLabel={chapterLabel}
        onExit={exitLive}
      />
    );
  }

  const activeIndex: 1 | 2 | 3 | 4 =
    step === "topics" ? 1 : step === "settings" ? 2 : step === "students" ? 3 : 4;

  const metaParts = [
    gradeLabel,
    subjectLabel,
    chapterLabel,
    questions.length ? `${questions.length} questions` : "",
    LEVEL_LABEL[settings.difficulty],
  ].filter(Boolean);

  return (
    <main className="flex flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/tools"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to Tools
          </Link>
          <div className="flex items-center gap-2">
            {gradeLabel ? (
              <span className="rounded-full border border-violet/25 bg-violet-muted/50 px-2.5 py-1 text-xs text-violet">
                {gradeLabel}
              </span>
            ) : null}
            {subjectLabel ? (
              <span className="rounded-full border border-violet/25 bg-violet-muted/50 px-2.5 py-1 text-xs text-violet">
                {subjectLabel}
              </span>
            ) : null}
          </div>
        </div>

        <h1 className="mt-3 font-serif text-2xl tracking-tight">Live Classroom Quiz</h1>
        <StepIndicator active={activeIndex} />

        {step === "topics" ? <TopicsStep onContinue={() => setStep("settings")} /> : null}

        {step === "settings" ? (
          <SettingsStep
            settings={settings}
            onChange={(next) => setSettings((s) => ({ ...s, ...next }))}
            onBack={() => setStep("topics")}
            onContinue={() => setStep("students")}
          />
        ) : null}

        {step === "students" ? (
          <StudentsStep
            gradeLabel={gradeLabel}
            roster={roster}
            onRetry={() => setRosterRetryKey((k) => k + 1)}
            selectedIds={selectedIds}
            onSelectedChange={setSelectedIds}
            repeatStudents={repeatStudents}
            onRepeatChange={setRepeatStudents}
            onBack={() => setStep("settings")}
            onGenerate={handleGenerate}
            generating={generating}
          />
        ) : null}

        {step === "review" ? (
          <ReviewStep
            questions={questions}
            onQuestionsChange={handleQuestionsChange}
            metaLine={metaParts.join(" · ")}
            onBack={() => setStep("students")}
            onStartQuiz={() => setStep("live")}
            startDisabledReason={questions.length === 0 ? "This quiz doesn't have any questions." : null}
          />
        ) : null}
      </div>
    </main>
  );
}
