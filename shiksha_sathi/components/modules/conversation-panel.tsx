"use client";

import { ChevronDown, Loader2, MessagesSquare } from "lucide-react";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { AssistantBody, AssistantMark, UserBubble } from "@/components/chat/turn";
import { getSession, type ChatMessage } from "@/lib/api";
import { MARKDOWN_CLASS } from "@/lib/artifact";
import { useAuth } from "@/lib/auth-context";
import { useCopy } from "@/lib/copy";
import { cn } from "@/lib/utils";

export function ConversationPanel({ sessionId }: { sessionId: string }) {
  const copy = useCopy();
  const { accessToken } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open || messages || failed) return;
    let cancelled = false;
    getSession(accessToken, sessionId)
      .then((s) => !cancelled && setMessages(s.messages))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [open, messages, failed, accessToken, sessionId]);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left transition-colors hover:bg-muted"
      >
        <MessagesSquare className="size-4 shrink-0 text-muted-foreground" />
        <span className="flex-1">
          <span className="block text-[13px] font-medium">{copy.conversationTitle}</span>
          <span className="block text-[11px] text-muted-foreground">{copy.conversationSub}</span>
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div className="border-t border-border px-3.5 py-4">
          {!messages && !failed ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : failed ? (
            <p className="py-2 text-xs text-muted-foreground">{copy.conversationFailed}</p>
          ) : messages && messages.length === 0 ? (
            <p className="py-2 text-xs text-muted-foreground">{copy.conversationEmpty}</p>
          ) : (
            <div className="flex flex-col gap-5">
              {messages!.map((m) =>
                m.role === "teacher" ? (
                  <UserBubble key={m.id}>{m.content}</UserBubble>
                ) : (
                  <div key={m.id} className="flex flex-col gap-2">
                    <AssistantMark />
                    <AssistantBody>
                      <div className={MARKDOWN_CLASS}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                      </div>
                    </AssistantBody>
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
