"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Loader2, Mic, MicOff, Volume2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

import { AssistantBody, AssistantMark, UserBubble } from "@/components/chat/turn";
import { VoiceWaveform } from "@/components/voice/voice-waveform";
import { MARKDOWN_CLASS } from "@/lib/artifact";
import { useCopy } from "@/lib/copy";
import { playSpeech, transcribeAudio } from "@/lib/speech-api";
import {
  VoiceRecorder,
  browserSttSupported,
  listenWithBrowser,
  micSupported,
} from "@/lib/speech-input";
import { streamGeneration } from "@/lib/sse";
import { cn } from "@/lib/utils";

type VoiceMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export type VoiceChatConfig = {
  accessToken: string | null;
  language?: string | null;
  ensureSession: () => Promise<string | null>;
  messagePath: (sessionId: string) => string;
  title?: string;
  subtitle?: string;
};

type VoiceChatPanelProps = VoiceChatConfig & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type VoiceState = "idle" | "listening" | "thinking" | "speaking";

function uid() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

export function VoiceChatPanel({
  open,
  onOpenChange,
  accessToken,
  language,
  ensureSession,
  messagePath,
  title,
  subtitle,
}: VoiceChatPanelProps) {
  const copy = useCopy();
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [state, setState] = useState<VoiceState>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [autoListen, setAutoListen] = useState(true);
  const recorderRef = useRef<VoiceRecorder | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, state]);

  useEffect(() => {
    if (!open) {
      recorderRef.current?.cancel();
      abortRef.current?.abort();
      setState("idle");
    }
  }, [open]);

  const transcribe = useCallback(
    async (blob?: Blob): Promise<string | null> => {
      if (blob) {
        try {
          const result = await transcribeAudio(blob, accessToken, language);
          return result.transcript;
        } catch {
          if (browserSttSupported()) {
            return listenWithBrowser(language ?? "hi-IN");
          }
          throw new Error(copy.voice.transcribeFailed);
        }
      }
      if (browserSttSupported()) {
        return listenWithBrowser(language ?? "hi-IN");
      }
      throw new Error(copy.voice.micUnavailable);
    },
    [accessToken, language, copy.voice],
  );

  const sendMessage = useCallback(
    async (content: string) => {
      let sid = sessionId;
      if (!sid) {
        sid = await ensureSession();
        if (!sid) return;
        setSessionId(sid);
      }

      setState("thinking");
      const asstId = uid();
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: "user", content },
        { id: asstId, role: "assistant", content: "" },
      ]);

      const ac = new AbortController();
      abortRef.current = ac;
      let acc = "";

      await streamGeneration(
        messagePath(sid),
        { content },
        accessToken,
        {
          onToken: (t) => {
            acc += t;
            setMessages((prev) =>
              prev.map((m) => (m.id === asstId ? { ...m, content: acc } : m)),
            );
          },
          onDone: async () => {
            const reply = acc.trim();
            if (!reply) {
              setState("idle");
              return;
            }
            setState("speaking");
            const ttsLang = language?.startsWith("en") ? "en-IN" : "hi-IN";
            await playSpeech(reply.slice(0, 800), accessToken, {
              language: ttsLang,
              onEnd: () => setState("idle"),
            });
          },
          onError: (msg) => {
            toast.error(msg);
            setMessages((prev) => prev.filter((m) => m.id !== asstId));
            setState("idle");
          },
        },
        ac.signal,
      );
    },
    [sessionId, ensureSession, messagePath, accessToken, language],
  );

  const beginListening = useCallback(async () => {
    if (!micSupported() && !browserSttSupported()) {
      toast.error(copy.voice.micUnavailable);
      return;
    }

    if (micSupported()) {
      try {
        const rec = new VoiceRecorder();
        recorderRef.current = rec;
        await rec.start();
        setState("listening");
      } catch {
        toast.error(copy.voice.micDenied);
      }
      return;
    }

    setState("listening");
    try {
      const text = await transcribe();
      if (text?.trim()) await sendMessage(text.trim());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.voice.recordFailed);
    } finally {
      setState("idle");
    }
  }, [copy.voice, sendMessage, transcribe]);

  const finishListening = useCallback(async () => {
    const rec = recorderRef.current;
    if (!rec) {
      setState("idle");
      return;
    }
    recorderRef.current = null;
    setState("thinking");
    try {
      const blob = await rec.stop();
      const text = await transcribe(blob);
      if (text?.trim()) await sendMessage(text.trim());
      else setState("idle");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.voice.recordFailed);
      setState("idle");
    }
  }, [copy.voice, sendMessage, transcribe]);

  const stopAll = () => {
    recorderRef.current?.cancel();
    recorderRef.current = null;
    abortRef.current?.abort();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setState("idle");
  };

  const handleMicPress = () => {
    if (state === "thinking" || state === "speaking") {
      stopAll();
      return;
    }
    if (state === "listening") {
      void finishListening();
      return;
    }
    if (state === "idle") {
      void beginListening();
    }
  };

  const stateLabel = {
    idle: copy.voice.tapToTalk,
    listening: copy.voice.listening,
    thinking: copy.voice.thinking,
    speaking: copy.voice.speaking,
  }[state];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup className="fixed inset-x-3 bottom-3 top-auto z-50 mx-auto flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:inset-x-auto sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <Dialog.Title className="text-sm font-medium">
                {title ?? copy.voice.title}
              </Dialog.Title>
              <Dialog.Description className="text-xs text-muted-foreground">
                {subtitle ?? copy.voice.subtitle}
              </Dialog.Description>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex size-8 items-center justify-center rounded-lg hover:bg-muted"
              aria-label={copy.cancel}
            >
              <X className="size-4" />
            </button>
          </div>

          <div ref={scrollRef} className="min-h-[200px] flex-1 overflow-y-auto px-4 py-4">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 py-8 text-center">
                <div className="flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-terracotta/20 to-gold/20">
                  <Volume2 className="size-8 text-terracotta" />
                </div>
                <p className="max-w-xs text-sm text-muted-foreground">{copy.voice.emptyHint}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {messages.map((m) =>
                  m.role === "user" ? (
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
                        ) : state === "thinking" ? (
                          <Loader2 className="size-4 animate-spin text-muted-foreground" />
                        ) : null}
                      </AssistantBody>
                    </div>
                  ),
                )}
              </div>
            )}
          </div>

          <div className="border-t border-border bg-muted/30 px-4 py-4">
            <label className="mb-3 flex cursor-pointer items-center justify-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={autoListen}
                onChange={(e) => setAutoListen(e.target.checked)}
                className="rounded border-border"
              />
              {copy.voice.autoListen}
            </label>

            <div className="flex flex-col items-center gap-2">
              <VoiceWaveform active={state === "listening" || state === "speaking"} bars={9} className="h-6" />
              <p className="text-xs font-medium text-muted-foreground">{stateLabel}</p>
              <button
                type="button"
                onClick={handleMicPress}
                className={cn(
                  "flex size-16 items-center justify-center rounded-full shadow-lg transition-all",
                  state === "listening"
                    ? "scale-110 bg-destructive text-destructive-foreground"
                    : state === "thinking"
                      ? "bg-muted text-muted-foreground"
                      : state === "speaking"
                        ? "bg-gold/80 text-ink"
                        : "bg-terracotta text-white hover:scale-105",
                )}
                aria-label={state === "idle" ? copy.voice.tapToTalk : copy.voice.stopRecording}
              >
                {state === "thinking" ? (
                  <Loader2 className="size-7 animate-spin" />
                ) : state === "listening" ? (
                  <MicOff className="size-7" />
                ) : (
                  <Mic className="size-7" />
                )}
              </button>
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Floating launcher button for voice conversation mode. */
export function VoiceChatLauncher({
  config,
  className,
}: {
  config: VoiceChatConfig;
  className?: string;
}) {
  const copy = useCopy();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-20 right-4 z-40 flex size-14 items-center justify-center rounded-full bg-terracotta text-white shadow-lg transition-transform hover:scale-105 md:bottom-6 md:right-6",
          className,
        )}
        aria-label={copy.voice.openChat}
      >
        <Mic className="size-6" />
      </button>
      <VoiceChatPanel {...config} open={open} onOpenChange={setOpen} />
    </>
  );
}
