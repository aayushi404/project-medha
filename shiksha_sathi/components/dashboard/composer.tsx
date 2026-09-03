"use client";

import { Loader2, Mic, MicOff, SendHorizontal } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { VoiceWaveform } from "@/components/voice/voice-waveform";
import { useCopy } from "@/lib/copy";
import { transcribeAudio } from "@/lib/speech-api";
import {
  VoiceRecorder,
  browserSttSupported,
  listenWithBrowser,
  micSupported,
} from "@/lib/speech-input";

type ComposerProps = {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Show the microphone button for voice input. Default: true */
  enableVoice?: boolean;
  accessToken?: string | null;
  language?: string | null;
};

export function Composer({
  onSend,
  disabled,
  placeholder,
  enableVoice = true,
  accessToken,
  language,
}: ComposerProps) {
  const copy = useCopy();
  const [value, setValue] = useState("");
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const recorderRef = useRef<VoiceRecorder | null>(null);

  function resize() {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 128)}px`;
  }

  function submit() {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
    requestAnimationFrame(resize);
  }

  async function transcribeBlob(blob: Blob) {
    setTranscribing(true);
    try {
      const result = await transcribeAudio(blob, accessToken ?? null, language);
      setValue((prev) => (prev ? `${prev} ${result.transcript}` : result.transcript));
      requestAnimationFrame(resize);
      taRef.current?.focus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.voice.transcribeFailed);
    } finally {
      setTranscribing(false);
    }
  }

  async function toggleRecording() {
    if (disabled || transcribing) return;

    if (recording) {
      setRecording(false);
      const rec = recorderRef.current;
      if (!rec) return;
      try {
        const blob = await rec.stop();
        await transcribeBlob(blob);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : copy.voice.recordFailed);
      }
      recorderRef.current = null;
      return;
    }

    if (!micSupported()) {
      if (browserSttSupported()) {
        setTranscribing(true);
        try {
          const text = await listenWithBrowser(language ?? "hi-IN");
          setValue((prev) => (prev ? `${prev} ${text}` : text));
          requestAnimationFrame(resize);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : copy.voice.micUnavailable);
        } finally {
          setTranscribing(false);
        }
      } else {
        toast.error(copy.voice.micUnavailable);
      }
      return;
    }

    try {
      const rec = new VoiceRecorder();
      recorderRef.current = rec;
      await rec.start();
      setRecording(true);
    } catch {
      toast.error(copy.voice.micDenied);
    }
  }

  const showVoice = enableVoice && (micSupported() || browserSttSupported());
  const voiceBusy = recording || transcribing;

  return (
    <div className="border-t border-border p-3">
      {recording ? (
        <div className="mx-auto mb-2 flex max-w-3xl items-center justify-center gap-3 rounded-lg bg-accent/60 px-4 py-2">
          <VoiceWaveform active bars={7} />
          <span className="text-xs font-medium text-terracotta">{copy.voice.listening}</span>
          <VoiceWaveform active bars={7} />
        </div>
      ) : null}
      <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-xl border border-border bg-card px-3 py-2 focus-within:border-ring">
        {showVoice ? (
          <button
            type="button"
            onClick={() => void toggleRecording()}
            disabled={disabled || (transcribing && !recording)}
            aria-label={recording ? copy.voice.stopRecording : copy.voice.startRecording}
            className={cnMicButton(recording, voiceBusy)}
          >
            {transcribing && !recording ? (
              <Loader2 className="size-4 animate-spin" />
            ) : recording ? (
              <MicOff className="size-4" />
            ) : (
              <Mic className="size-4" />
            )}
          </button>
        ) : null}
        <textarea
          ref={taRef}
          rows={1}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            resize();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={placeholder ?? copy.inputPlaceholder}
          className="max-h-32 flex-1 resize-none bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground"
        />
        <button
          type="button"
          onClick={submit}
          disabled={disabled || value.trim().length === 0}
          aria-label={copy.send}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
        >
          {disabled ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <SendHorizontal className="size-4" />
          )}
        </button>
      </div>
    </div>
  );
}

function cnMicButton(recording: boolean, busy: boolean): string {
  const base =
    "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-40";
  if (recording) return `${base} bg-destructive/15 text-destructive`;
  if (busy) return `${base} text-muted-foreground`;
  return `${base} text-muted-foreground hover:bg-accent hover:text-foreground`;
}
