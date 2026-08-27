"use client";

import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { ArtifactCard } from "@/components/dashboard/artifact-card";
import type { ActivityContent, QuizContent } from "@/lib/api";
import { MARKDOWN_CLASS } from "@/lib/artifact";
import { copy } from "@/lib/copy";

export type UiMessage = {
  id: string;
  role: "teacher" | "assistant";
  content: string;
  streaming?: boolean;
  failed?: boolean;
  artifact?: { type: "quiz" | "activity"; content: QuizContent | ActivityContent };
};

function TeacherBubble({ text }: { text: string }) {
  return (
    <div className="ml-auto max-w-[80%] rounded-2xl bg-primary px-3.5 py-2 text-sm whitespace-pre-wrap text-primary-foreground">
      {text}
    </div>
  );
}

function AssistantBubble({
  msg,
  onQuiz,
  onActivity,
  onRetry,
}: {
  msg: UiMessage;
  onQuiz: () => void;
  onActivity: () => void;
  onRetry: () => void;
}) {
  const showActions = !msg.streaming && !msg.failed;
  return (
    <div className="mr-auto flex max-w-[85%] flex-col gap-2">
      <div className="rounded-2xl bg-card px-3.5 py-2.5 ring-1 ring-foreground/10">
        {msg.content ? (
          <div className={MARKDOWN_CLASS}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
          </div>
        ) : null}
        {msg.streaming ? (
          <span className="ml-0.5 inline-block h-3.5 w-[3px] animate-pulse bg-foreground/60 align-middle" />
        ) : null}
        {msg.failed ? (
          <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
            <span>⚠️ {copy.streamError}</span>
            <button type="button" onClick={onRetry} className="text-primary underline">
              {copy.retry}
            </button>
          </div>
        ) : null}
      </div>

      {msg.artifact ? <ArtifactCard type={msg.artifact.type} content={msg.artifact.content} /> : null}

      {showActions ? (
        <div className="flex gap-2">
          <QaButton onClick={onQuiz}>{copy.makeQuiz}</QaButton>
          <QaButton onClick={onActivity}>{copy.makeActivity}</QaButton>
        </div>
      ) : null}
    </div>
  );
}

function QaButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  );
}

type MessageThreadProps = {
  messages: UiMessage[];
  onQuiz: () => void;
  onActivity: () => void;
  onRetry: () => void;
};

export function MessageThread({ messages, onQuiz, onActivity, onRetry }: MessageThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  useEffect(() => {
    if (stick.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div
      ref={scrollRef}
      onScroll={(e) => {
        const el = e.currentTarget;
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
      }}
      className="flex-1 overflow-y-auto"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-4">
        {messages.map((m) =>
          m.role === "teacher" ? (
            <TeacherBubble key={m.id} text={m.content} />
          ) : (
            <AssistantBubble
              key={m.id}
              msg={m}
              onQuiz={onQuiz}
              onActivity={onActivity}
              onRetry={onRetry}
            />
          ),
        )}
      </div>
    </div>
  );
}
