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
import {
  browserSpeak,
  fetchVoiceTurns,
  playSpeech,
  resolveTtsParams,
  synthesizeSpeech,
  transcribeAudio,
} from "@/lib/speech-api";
import {
  ContinuousVoiceListener,
  VoiceRecorder,
  browserSttSupported,
  listenWithBrowser,
  micSupported,
} from "@/lib/speech-input";
import { streamGeneration } from "@/lib/sse";
import { cn } from "@/lib/utils";
import {
  SequentialAudioPlayer,
  objectUrlFromBase64,
} from "@/lib/voice-playback";

type VoiceMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export type VoiceChatConfig = {
  accessToken: string | null;
  language?: string | null;
  ensureSession: () => Promise<string | null>;
  /**
   * Teacher voice assistant: one SSE call to `/speech/converse` does context +
   * LLM + TTS and streams back `token` then `audio` frames. When false (the
   * student pages), the transcript is POSTed to `messagePath` as a plain chat
   * stream and speech is synthesised client-side.
   */
  converse?: boolean;
  messagePath?: (sessionId: string) => string;
  /** Read the caller's current session id without creating one (for history). */
  peekSession?: () => string | null;
  title?: string;
  subtitle?: string;
};

type VoiceChatPanelProps = VoiceChatConfig & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type VoiceState = "idle" | "listening" | "thinking" | "speaking";

/**
 * Spoken once each time the teacher opens the voice panel (converse mode only).
 * A fixed Bihar-government welcome, always in Hindi regardless of UI language.
 */
const WELCOME_GREETING = "आपका स्वागत है नए शिक्षित एवं विकसित बिहार में।";

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
  converse = false,
  messagePath,
  peekSession,
  title,
  subtitle,
}: VoiceChatPanelProps) {
  const copy = useCopy();
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [state, setState] = useState<VoiceState>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [autoListen, setAutoListen] = useState(true);
  const [handsFreeActive, setHandsFreeActive] = useState(false);

  const recorderRef = useRef<VoiceRecorder | null>(null);
  const continuousRef = useRef<ContinuousVoiceListener | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const playerRef = useRef<SequentialAudioPlayer | null>(null);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // True from the moment we start handling an utterance until its reply has
  // finished playing. Gates the mic so a second turn can't start on top of one
  // already running (which is what makes two replies talk over each other).
  const turnInFlightRef = useRef(false);
  const hydratedRef = useRef<string | null>(null);
  // Set once we've played the welcome for the current open; cleared on close.
  const greetedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  const autoListenRef = useRef(autoListen);
  const handsFreeRef = useRef(handsFreeActive);

  openRef.current = open;
  autoListenRef.current = autoListen;
  handsFreeRef.current = handsFreeActive;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, state]);

  useEffect(() => {
    if (!open) {
      recorderRef.current?.cancel();
      continuousRef.current?.cancel();
      continuousRef.current = null;
      abortRef.current?.abort();
      playerRef.current?.stop();
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
      turnInFlightRef.current = false;
      greetedRef.current = false;
      setHandsFreeActive(false);
      setState("idle");
    }
  }, [open]);

  // Repopulate the transcript with this session's earlier spoken turns.
  useEffect(() => {
    if (!open || !converse) return;
    // `sendMessage` calls `ensureSession()` (which returns this same id) before
    // its first turn, so the panel doesn't need to hold the id itself here.
    const sid = peekSession?.() ?? sessionId;
    if (!sid || hydratedRef.current === sid) return;
    hydratedRef.current = sid;

    let cancelled = false;
    void (async () => {
      try {
        const turns = await fetchVoiceTurns(sid, accessToken);
        if (cancelled) return;
        setMessages((prev) => {
          if (prev.length > 0) return prev; // don't clobber a live conversation
          return turns.flatMap((t) => {
            const rows: VoiceMessage[] = [
              { id: uid(), role: "user", content: t.user_transcript },
            ];
            if (t.assistant_text) {
              rows.push({ id: uid(), role: "assistant", content: t.assistant_text });
            }
            return rows;
          });
        });
      } catch {
        // history hydration is best-effort
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, converse, peekSession, sessionId, accessToken]);

  useEffect(() => {
    if (!autoListen && handsFreeActive) {
      recorderRef.current?.cancel();
      continuousRef.current?.cancel();
      continuousRef.current = null;
      setHandsFreeActive(false);
      if (state === "listening") setState("idle");
    }
  }, [autoListen, handsFreeActive, state]);

  const transcribe = useCallback(
    async (blob?: Blob): Promise<string | null> => {
      if (blob) {
        const result = await transcribeAudio(blob, accessToken, language);
        return result.transcript;
      }
      if (browserSttSupported()) {
        return listenWithBrowser(language ?? "hi-IN");
      }
      throw new Error(copy.voice.micUnavailable);
    },
    [accessToken, language, copy.voice],
  );

  const beginContinuousListening = useCallback(async () => {
    if (!micSupported()) {
      toast.error(copy.voice.micUnavailable);
      return;
    }
    // Mutex: never run two listeners, and never listen while a reply is still
    // in flight. Assignments below are synchronous, so this is race-free.
    if (continuousRef.current || turnInFlightRef.current) return;

    const listener = new ContinuousVoiceListener();
    continuousRef.current = listener;

    try {
      await listener.start(async (blob) => {
        continuousRef.current = null;
        if (!openRef.current || !handsFreeRef.current) {
          setState("idle");
          return;
        }

        // Claim the turn now, before the (async) transcribe, so a stray
        // restart can't open a second listener while we're mid-utterance.
        turnInFlightRef.current = true;
        setState("thinking");
        try {
          const text = await transcribe(blob);
          if (text?.trim()) {
            await sendMessageRef.current(text.trim());
          } else {
            turnInFlightRef.current = false;
            maybeRestartListeningRef.current();
          }
        } catch (err) {
          toast.error(err instanceof Error ? err.message : copy.voice.recordFailed);
          turnInFlightRef.current = false;
          maybeRestartListeningRef.current();
        }
      });
      setState("listening");
    } catch {
      continuousRef.current = null;
      toast.error(copy.voice.micDenied);
      setHandsFreeActive(false);
      setState("idle");
    }
  }, [copy.voice, transcribe]);

  const beginContinuousListeningRef = useRef(beginContinuousListening);
  beginContinuousListeningRef.current = beginContinuousListening;

  // After Medha finishes speaking, wait out a short cooldown before reopening
  // the mic — otherwise the tail of her reply (speaker bleed, plus the AEC
  // reconverging on a fresh stream) gets captured and she talks to herself.
  const RESTART_COOLDOWN_MS = 650;

  const maybeRestartListening = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    if (!(handsFreeRef.current && autoListenRef.current && openRef.current)) {
      setState("idle");
      return;
    }
    setState("idle");
    restartTimerRef.current = setTimeout(() => {
      restartTimerRef.current = null;
      if (handsFreeRef.current && autoListenRef.current && openRef.current) {
        void beginContinuousListeningRef.current();
      }
    }, RESTART_COOLDOWN_MS);
  }, []);

  const maybeRestartListeningRef = useRef(maybeRestartListening);
  maybeRestartListeningRef.current = maybeRestartListening;

  const sendMessageRef = useRef<(content: string) => Promise<void>>(async () => {});

  const ensurePlayer = useCallback(() => {
    if (!playerRef.current) playerRef.current = new SequentialAudioPlayer();
    return playerRef.current;
  }, []);

  // Speak a fixed welcome once each time the teacher opens the panel. Audio
  // only (no transcript row) so it doesn't block history hydration.
  useEffect(() => {
    if (!open || !converse || greetedRef.current) return;
    greetedRef.current = true;

    let cancelled = false;
    const player = ensurePlayer();
    setState("speaking");

    void (async () => {
      try {
        // Greeting is always Hindi; only borrow the Bihari accent when set.
        const tts = resolveTtsParams(language);
        const url = await synthesizeSpeech(
          WELCOME_GREETING,
          accessToken,
          "hi-IN",
          tts.accent,
        );
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        player.onDrain = () => setState("idle");
        player.enqueue(url);
      } catch {
        if (!cancelled) setState("idle");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, converse, ensurePlayer, language, accessToken]);

  const sendMessage = useCallback(
    async (content: string) => {
      let sid = sessionId;
      if (!sid) {
        sid = await ensureSession();
        if (!sid) {
          turnInFlightRef.current = false;
          maybeRestartListening();
          return;
        }
        setSessionId(sid);
      }

      setState("thinking");
      const asstId = uid();
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: "user", content },
        { id: asstId, role: "assistant", content: "" },
      ]);

      // Abort any still-open stream from a previous turn before starting this
      // one, so two replies can't stream into the player at the same time.
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      let acc = "";
      const patchReply = () =>
        setMessages((prev) =>
          prev.map((m) => (m.id === asstId ? { ...m, content: acc } : m)),
        );
      const dropReplyIfEmpty = () => {
        if (!acc.trim()) {
          setMessages((prev) => prev.filter((m) => m.id !== asstId));
        }
      };

      if (converse) {
        turnInFlightRef.current = true;
        const player = ensurePlayer();
        player.stop();
        // kill any browser-TTS fallback still speaking from a previous turn
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
        }

        // Restart the mic exactly once, and only after BOTH the stream has
        // ended and every audio chunk has finished — otherwise the mid-stream
        // queue running dry, or an error mid-playback, reopens the mic while
        // Medha is still talking and she records herself.
        let streamEnded = false;
        let restarted = false;
        const endTurn = () => {
          if (restarted) return;
          restarted = true;
          turnInFlightRef.current = false;
          maybeRestartListening();
        };
        const finishTurn = () => {
          if (restarted || !streamEnded || player.active) return;
          endTurn();
        };
        const speakFallback = () => {
          setState("speaking");
          browserSpeak(acc.trim(), { language, onEnd: endTurn });
        };
        player.onDrain = finishTurn;

        await streamGeneration(
          "/speech/converse",
          { session_id: sid, transcript: content, language: language ?? undefined },
          accessToken,
          {
            onToken: (t) => {
              acc += t;
              patchReply();
            },
            onAudio: (a) => {
              setState("speaking");
              player.enqueue(objectUrlFromBase64(a.b64, a.mime));
            },
            onDone: (payload) => {
              streamEnded = true;
              if (!acc.trim()) {
                dropReplyIfEmpty();
                finishTurn();
                return;
              }
              if (payload.tts_failed || payload.fallback === "browser_tts") {
                speakFallback();
                return;
              }
              finishTurn();
            },
            onError: (msg, fallback) => {
              streamEnded = true;
              toast.error(msg);
              if (fallback === "browser_tts" && acc.trim()) {
                speakFallback();
                return;
              }
              dropReplyIfEmpty();
              finishTurn();
            },
          },
          ac.signal,
        );
        return;
      }

      // Legacy chat transport (student pages): plain stream + client-side TTS.
      await streamGeneration(
        messagePath!(sid),
        { content },
        accessToken,
        {
          onToken: (t) => {
            acc += t;
            patchReply();
          },
          onDone: async () => {
            const reply = acc.trim();
            if (!reply) {
              maybeRestartListening();
              return;
            }
            setState("speaking");
            const tts = resolveTtsParams(language);
            await playSpeech(reply.slice(0, 800), accessToken, {
              language: tts.language,
              accent: tts.accent,
              onEnd: maybeRestartListening,
            });
          },
          onError: (msg) => {
            toast.error(msg);
            dropReplyIfEmpty();
            maybeRestartListening();
          },
        },
        ac.signal,
      );
    },
    [
      sessionId,
      ensureSession,
      converse,
      ensurePlayer,
      messagePath,
      accessToken,
      language,
      maybeRestartListening,
    ],
  );

  sendMessageRef.current = sendMessage;

  const beginListening = useCallback(async () => {
    if (!micSupported() && !browserSttSupported()) {
      toast.error(copy.voice.micUnavailable);
      return;
    }

    if (autoListenRef.current && micSupported()) {
      setHandsFreeActive(true);
      await beginContinuousListening();
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
  }, [copy.voice, sendMessage, transcribe, beginContinuousListening]);

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
    continuousRef.current?.cancel();
    continuousRef.current = null;
    abortRef.current?.abort();
    playerRef.current?.stop();
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    turnInFlightRef.current = false;
    setHandsFreeActive(false);
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setState("idle");
  };

  const handleMicPress = () => {
    if (handsFreeActive || state === "thinking" || state === "speaking") {
      stopAll();
      return;
    }
    if (state === "listening") {
      if (handsFreeActive) {
        stopAll();
      } else {
        void finishListening();
      }
      return;
    }
    if (state === "idle") {
      void beginListening();
    }
  };

  const stateLabel = handsFreeActive
    ? {
        idle: copy.voice.handsFreeStart,
        listening: copy.voice.handsFreeListening,
        thinking: copy.voice.thinking,
        speaking: copy.voice.speaking,
      }[state]
    : {
        idle: autoListen ? copy.voice.handsFreeStart : copy.voice.tapToTalk,
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
                aria-label={
                  handsFreeActive || state !== "idle"
                    ? copy.voice.stopRecording
                    : copy.voice.tapToTalk
                }
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
