"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";

import { ContextBar } from "@/components/app/context-bar";
import { ChapterHistory } from "@/components/dashboard/chapter-history";
import { Composer } from "@/components/dashboard/composer";
import { MessageThread, type UiMessage } from "@/components/dashboard/message-thread";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { createSession, type ActivityContent, type QuizContent } from "@/lib/api";
import { ackLine, extractJson } from "@/lib/artifact";
import { useAuth } from "@/lib/auth-context";
import { useCopy } from "@/lib/copy";
import { useLessonContext } from "@/lib/lesson-context";
import { useProfile } from "@/lib/profile-context";
import { streamGeneration } from "@/lib/sse";

function uid() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

export default function DashboardPage() {
  const copy = useCopy();
  const { accessToken } = useAuth();
  const { profile } = useProfile();
  const { gradeId, subjectId, chapterId, topicId } = useLessonContext();

  const firstName = profile?.full_name?.trim().split(/\s+/)[0] ?? "";

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [busy, setBusy] = useState(false);
  // bumped after any successful generation so ChapterHistory refetches
  const [historyKey, setHistoryKey] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const lastUserText = useRef<string>("");

  // Reset the conversation whenever the lesson context changes (new context =
  // new topic). Render-phase adjustment, guarded against a loop.
  const contextKey = `${gradeId}|${subjectId}|${chapterId}|${topicId}`;
  const [prevKey, setPrevKey] = useState(contextKey);
  if (contextKey !== prevKey) {
    setPrevKey(contextKey);
    setSessionId(null);
    setMessages([]);
    setBusy(false);
  }

  // Abort any in-flight stream when the context changes or on unmount.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, [contextKey]);

  async function ensureSession(): Promise<string | null> {
    if (sessionId) return sessionId;
    if (!gradeId || !subjectId) {
      toast.error(copy.needContext);
      return null;
    }
    try {
      const s = await createSession(accessToken, {
        grade_id: gradeId,
        subject_id: subjectId,
        chapter_id: chapterId,
        topic_id: topicId,
      });
      setSessionId(s.id);
      return s.id;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't start the session.");
      return null;
    }
  }

  function patchMessage(id: string, patch: Partial<UiMessage>) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }

  async function runMessage(content: string) {
    const id = await ensureSession();
    if (!id) return;
    lastUserText.current = content;
    setBusy(true);

    const asstId = uid();
    setMessages((prev) => [
      ...prev,
      { id: uid(), role: "teacher", content },
      { id: asstId, role: "assistant", content: "", streaming: true },
    ]);

    const ac = new AbortController();
    abortRef.current = ac;
    let acc = "";

    await streamGeneration(
      `/chat/sessions/${id}/messages`,
      { content },
      accessToken,
      {
        onToken: (t) => {
          acc += t;
          patchMessage(asstId, { content: acc });
        },
        onDone: () => {
          patchMessage(asstId, { streaming: false });
          setHistoryKey((k) => k + 1);
        },
        onError: (msg) => {
          if (acc) patchMessage(asstId, { streaming: false, failed: true });
          else setMessages((prev) => prev.filter((m) => m.id !== asstId));
          toast.error(msg);
        },
      },
      ac.signal,
    );
    setBusy(false);
  }

  async function runGenerate(type: "quiz" | "activity") {
    const id = await ensureSession();
    if (!id) return;
    setBusy(true);

    const asstId = uid();
    setMessages((prev) => [
      ...prev,
      { id: asstId, role: "assistant", content: copy.generating, streaming: true },
    ]);

    const ac = new AbortController();
    abortRef.current = ac;
    let acc = "";

    await streamGeneration(
      `/chat/sessions/${id}/generate`,
      { artifact_type: type },
      accessToken,
      {
        onToken: (t) => {
          acc += t;
        }, // raw JSON -- not shown; parsed on done
        onDone: () => {
          const parsed = extractJson<QuizContent | ActivityContent>(acc);
          patchMessage(asstId, {
            streaming: false,
            content: ackLine(type, parsed),
            failed: !parsed,
            artifact: parsed ? { type, content: parsed } : undefined,
          });
          if (parsed) setHistoryKey((k) => k + 1);
          else toast.error(copy.streamError);
        },
        onError: (msg) => {
          setMessages((prev) => prev.filter((m) => m.id !== asstId));
          toast.error(msg);
        },
      },
      ac.signal,
    );
    setBusy(false);
  }

  function retryLast() {
    setMessages((prev) => prev.filter((m) => !m.failed));
    if (lastUserText.current) void runMessage(lastUserText.current);
  }

  const empty = messages.length === 0;
  const hasChapter = Boolean(gradeId && subjectId && chapterId);

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <ContextBar />

      {empty ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="flex flex-1 flex-col items-center gap-6 overflow-y-auto px-4 py-10"
        >
          <div className="text-center">
            <div className="text-lg">{copy.greeting(firstName)}</div>
            <div className="mt-1 text-sm text-muted-foreground">{copy.greetingSub}</div>
          </div>
          <QuickActions
            disabled={busy}
            onExplain={() => void runMessage(copy.explanationPrompt)}
            onQuiz={() => void runGenerate("quiz")}
            onActivity={() => void runGenerate("activity")}
          />
          {hasChapter ? (
            <div className="w-full max-w-2xl">
              <ChapterHistory
                gradeId={gradeId!}
                subjectId={subjectId!}
                chapterId={chapterId!}
                refreshKey={historyKey}
                onQuiz={() => void runGenerate("quiz")}
                onActivity={() => void runGenerate("activity")}
                defaultOpen
              />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{copy.pickChapterForHistory}</p>
          )}
        </motion.div>
      ) : (
        <MessageThread
          messages={messages}
          onQuiz={() => void runGenerate("quiz")}
          onActivity={() => void runGenerate("activity")}
          onRetry={retryLast}
          header={
            hasChapter ? (
              <ChapterHistory
                gradeId={gradeId!}
                subjectId={subjectId!}
                chapterId={chapterId!}
                refreshKey={historyKey}
                onQuiz={() => void runGenerate("quiz")}
                onActivity={() => void runGenerate("activity")}
              />
            ) : null
          }
        />
      )}

      <Composer disabled={busy} onSend={(t) => void runMessage(t)} />
    </main>
  );
}
