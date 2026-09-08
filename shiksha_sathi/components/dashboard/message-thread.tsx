"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { AssistantBody, AssistantMark, UserBubble } from "@/components/chat/turn";
import { ArtifactCard } from "@/components/dashboard/artifact-card";
import { ContentActions } from "@/components/dashboard/content-actions";
import {
  modulePptUrl,
  type ActivityContent,
  type DeckContent,
  type QuizContent,
} from "@/lib/api";
import { MARKDOWN_CLASS } from "@/lib/artifact";
import { useCopy } from "@/lib/copy";
import { speakableContent, stripMarkdown } from "@/lib/speech";
import { cn } from "@/lib/utils";

export type UiMessage = {
  id: string;
  role: "teacher" | "assistant";
  content: string;
  streaming?: boolean;
  failed?: boolean;
  artifact?: {
    type: "quiz" | "activity" | "ppt";
    content: QuizContent | ActivityContent | DeckContent;
    moduleId?: string;
    artifactId?: string;
  };
};

function AssistantTurn({
  msg,
  onQuiz,
  onActivity,
  onPpt,
  onRetry,
}: {
  msg: UiMessage;
  onQuiz: () => void;
  onActivity: () => void;
  onPpt: () => void;
  onRetry: () => void;
}) {
  const copy = useCopy();
  const showActions = !msg.streaming && !msg.failed;
  const speechText = msg.artifact
    ? speakableContent(msg.artifact.type, msg.artifact.content)
    : stripMarkdown(msg.content);

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
            <ArtifactCard
              type={msg.artifact.type}
              content={msg.artifact.content}
              downloadUrl={
                msg.artifact.type === "ppt" &&
                msg.artifact.moduleId &&
                msg.artifact.artifactId
                  ? modulePptUrl(msg.artifact.moduleId, msg.artifact.artifactId)
                  : undefined
              }
              filename={
                msg.artifact.type === "ppt"
                  ? (msg.artifact.content as DeckContent).title
                  : undefined
              }
            />
          </div>
        ) : null}

        {showActions ? (
          <ContentActions
            // Always visible on touch (no hover); reveal on hover only for
            // mouse/trackpad devices, where the resting state stays uncluttered.
            className="mt-2 opacity-100 transition-opacity pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:group-focus-within:opacity-100"
            speechId={msg.id}
            speechText={speechText}
            copyText={msg.content || undefined}
            onQuiz={onQuiz}
            onActivity={onActivity}
            onPpt={onPpt}
            hide={msg.artifact ? [msg.artifact.type] : []}
          />
        ) : null}
      </AssistantBody>
    </div>
  );
}

type MessageThreadProps = {
  messages: UiMessage[];
  onQuiz: () => void;
  onActivity: () => void;
  onPpt: () => void;
  onRetry: () => void;
  header?: React.ReactNode;
};

export function MessageThread({
  messages,
  onQuiz,
  onActivity,
  onPpt,
  onRetry,
  header,
}: MessageThreadProps) {
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
        {header}
        {messages.map((m) =>
          m.role === "teacher" ? (
            <UserBubble key={m.id}>{m.content}</UserBubble>
          ) : (
            <AssistantTurn
              key={m.id}
              msg={m}
              onQuiz={onQuiz}
              onActivity={onActivity}
              onPpt={onPpt}
              onRetry={onRetry}
            />
          ),
        )}
      </div>
    </div>
  );
}
