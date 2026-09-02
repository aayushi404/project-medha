"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

import { AssistantBody, AssistantMark, UserBubble } from "@/components/chat/turn";
import { Composer } from "@/components/dashboard/composer";
import {
  SubjectChapterBar,
  useSubjectChapter,
} from "@/components/student/subject-chapter-bar";
import { VoiceChatLauncher } from "@/components/voice/voice-chat-panel";
import { createTutorSession } from "@/lib/api";
import { MARKDOWN_CLASS } from "@/lib/artifact";
import { useAuth } from "@/lib/auth-context";
import { useCopy } from "@/lib/copy";
import { streamGeneration } from "@/lib/sse";
import { useStudentData } from "@/lib/student-context";
import { cn } from "@/lib/utils";

type UiMessage = {
  id: string;
  role: "student" | "assistant";
  content: string;
  streaming?: boolean;
  failed?: boolean;
};

function uid() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

export default function LearnPage() {
  const copy = useCopy();
  const { accessToken } = useAuth();
  const { firstName } = useStudentData();
  const picker = useSubjectChapter();
  const { subjectId, chapterId } = picker;

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // a new subject/chapter is a new doubt -- reset the thread
  const contextKey = `${subjectId}|${chapterId}`;
  const [prevKey, setPrevKey] = useState(contextKey);
  if (contextKey !== prevKey) {
    setPrevKey(contextKey);
    setSessionId(null);
    setMessages([]);
    setBusy(false);
  }

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, [contextKey]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  useEffect(() => {
    if (stick.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  function patchMessage(id: string, patch: Partial<UiMessage>) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }

  async function ensureSession(): Promise<string | null> {
    if (sessionId) return sessionId;
    if (!subjectId || !chapterId) {
      toast.error(copy.student.pickSubjectChapterToast);
      return null;
    }
    try {
      const s = await createTutorSession(accessToken, {
        subject_id: subjectId,
        chapter_id: chapterId,
      });
      setSessionId(s.id);
      return s.id;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.student.couldNotStart);
      return null;
    }
  }

  async function runMessage(content: string) {
    const id = await ensureSession();
    if (!id) return;
    setBusy(true);

    const asstId = uid();
    setMessages((prev) => [
      ...prev,
      { id: uid(), role: "student", content },
      { id: asstId, role: "assistant", content: "", streaming: true },
    ]);

    const ac = new AbortController();
    abortRef.current = ac;
    let acc = "";

    await streamGeneration(
      `/tutor/sessions/${id}/messages`,
      { content },
      accessToken,
      {
        onToken: (t) => {
          acc += t;
          patchMessage(asstId, { content: acc });
        },
        onDone: () => patchMessage(asstId, { streaming: false }),
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

  const empty = messages.length === 0;
  const canAsk = !!subjectId && !!chapterId;

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <h1 className="text-[15px]">{copy.student.askTitle}</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">{copy.student.askSub}</p>
      </div>

      <SubjectChapterBar picker={picker} />

      {empty ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
          <div className="text-lg">{copy.student.askHeading(firstName)}</div>
          <div className="text-sm text-muted-foreground">
            {canAsk ? copy.student.askAnything : copy.student.pickToStart}
          </div>
        </div>
      ) : (
        <div
          ref={scrollRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
          }}
          className="flex-1 overflow-y-auto"
        >
          <div className={cn("mx-auto flex max-w-3xl flex-col gap-6 px-4 py-5")}>
            {messages.map((m) =>
              m.role === "student" ? (
                <UserBubble key={m.id}>{m.content}</UserBubble>
              ) : (
                <div key={m.id} className="flex flex-col gap-2">
                  <AssistantMark />
                  <AssistantBody>
                    {m.content ? (
                      <div className={MARKDOWN_CLASS}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {m.content}
                        </ReactMarkdown>
                      </div>
                    ) : null}
                    {m.streaming ? (
                      <span className="ml-0.5 inline-block h-4 w-[3px] animate-pulse bg-foreground/50 align-middle" />
                    ) : null}
                    {m.failed ? (
                      <div className="mt-1.5 text-xs text-muted-foreground">
                        {copy.student.didntFinish}
                      </div>
                    ) : null}
                  </AssistantBody>
                </div>
              ),
            )}
          </div>
        </div>
      )}

      <Composer
        disabled={busy}
        placeholder={canAsk ? copy.student.askPlaceholder : copy.student.pickPlaceholder}
        onSend={(t) => void runMessage(t)}
        accessToken={accessToken}
        language="hi-BiharBoli"
      />

      <VoiceChatLauncher
        config={{
          accessToken,
          language: "hi-BiharBoli",
          ensureSession,
          messagePath: (id) => `/tutor/sessions/${id}/messages`,
        }}
      />
    </main>
  );
}
