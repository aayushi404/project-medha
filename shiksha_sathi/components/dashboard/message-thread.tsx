"use client";

import { Check, Copy, HelpCircle, RefreshCw, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { ArtifactCard } from "@/components/dashboard/artifact-card";
import { AssistantBody, AssistantMark, UserBubble } from "@/components/chat/turn";
import type { ActivityContent, QuizContent } from "@/lib/api";
import { MARKDOWN_CLASS } from "@/lib/artifact";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";

export type UiMessage = {
  id: string;
  role: "teacher" | "assistant";
  content: string;
  streaming?: boolean;
  failed?: boolean;
  artifact?: { type: "quiz" | "activity"; content: QuizContent | ActivityContent };
};

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          window.setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard unavailable */
        }
      }}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {done ? <Check className="size-3" /> : <Copy className="size-3" />}
      {done ? copy.copied : copy.copyText}
    </button>
  );
}

function ActionButton({
  onClick,
  icon: Icon,
  children,
}: {
  onClick: () => void;
  icon: typeof HelpCircle;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <Icon className="size-3.5" />
      {children}
    </button>
  );
}

function AssistantTurn({
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
    <div className="group flex flex-col gap-2">
      <AssistantMark />
      <AssistantBody>
        {msg.content ? (
          <div className={MARKDOWN_CLASS}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
          </div>
        ) : null}
        {msg.streaming ? (
          <span className="ml-0.5 inline-block h-4 w-[3px] animate-pulse bg-foreground/50 align-middle" />
        ) : null}

        {msg.failed ? (
          <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{copy.streamError}</span>
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <RefreshCw className="size-3" />
              {copy.retry}
            </button>
          </div>
        ) : null}

        {msg.artifact ? (
          <div className="mt-3">
            <ArtifactCard type={msg.artifact.type} content={msg.artifact.content} />
          </div>
        ) : null}

        {showActions ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
            {msg.content ? <CopyButton text={msg.content} /> : null}
            {!msg.artifact ? (
              <>
                <ActionButton onClick={onQuiz} icon={HelpCircle}>
                  {copy.makeQuiz}
                </ActionButton>
                <ActionButton onClick={onActivity} icon={Users}>
                  {copy.makeActivity}
                </ActionButton>
              </>
            ) : null}
          </div>
        ) : null}
      </AssistantBody>
    </div>
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
      <div className={cn("mx-auto flex max-w-3xl flex-col gap-6 px-4 py-5")}>
        {messages.map((m) =>
          m.role === "teacher" ? (
            <UserBubble key={m.id}>{m.content}</UserBubble>
          ) : (
            <AssistantTurn
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
