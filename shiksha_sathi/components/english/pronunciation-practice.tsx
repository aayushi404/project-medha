"use client";

import { Loader2, Mic, MicOff } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { checkPronunciation, playSpeech, type PronunciationResult } from "@/lib/speech-api";
import { VoiceRecorder, micSupported } from "@/lib/speech-input";
import { cn } from "@/lib/utils";

type Props = {
  prompt: string;
  accessToken: string | null;
  labels: {
    listen: string;
    record: string;
    stop: string;
    checking: string;
    score: (n: number) => string;
    heard: string;
    tips: string;
  };
};

export function PronunciationPractice({ prompt, accessToken, labels }: Props) {
  const [recording, setRecording] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<PronunciationResult | null>(null);
  const recorderRef = useRef<VoiceRecorder | null>(null);

  async function toggleRecord() {
    if (checking) return;

    if (recording) {
      const rec = recorderRef.current;
      recorderRef.current = null;
      setRecording(false);
      if (!rec) return;

      setChecking(true);
      setResult(null);
      try {
        const blob = await rec.stop();
        const scored = await checkPronunciation(blob, prompt, accessToken);
        setResult(scored);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not check pronunciation.");
      } finally {
        setChecking(false);
      }
      return;
    }

    if (!micSupported()) {
      toast.error("Microphone not available on this device.");
      return;
    }

    try {
      const rec = new VoiceRecorder();
      recorderRef.current = rec;
      await rec.start();
      setRecording(true);
      setResult(null);
    } catch {
      toast.error("Microphone access denied.");
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void playSpeech(prompt, accessToken, { language: "en-IN" })}
          className="rounded-lg bg-accent px-2.5 py-1 text-xs hover:bg-accent/80"
        >
          🔊 {labels.listen}
        </button>
        <button
          type="button"
          disabled={checking}
          onClick={() => void toggleRecord()}
          className={cn(
            "flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs",
            recording
              ? "bg-destructive/15 text-destructive"
              : "bg-terracotta/15 text-terracotta hover:bg-terracotta/25",
          )}
        >
          {checking ? (
            <Loader2 className="size-3 animate-spin" />
          ) : recording ? (
            <MicOff className="size-3" />
          ) : (
            <Mic className="size-3" />
          )}
          {checking ? labels.checking : recording ? labels.stop : labels.record}
        </button>
      </div>

      {result ? (
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs">
          <p className="font-medium text-terracotta">{labels.score(result.score)}</p>
          <p className="mt-1 text-muted-foreground">
            {labels.heard}: &ldquo;{result.heard}&rdquo;
          </p>
          <p className="mt-2">{result.feedback}</p>
          {result.tips.length > 0 ? (
            <ul className="mt-2 list-inside list-disc text-muted-foreground">
              {result.tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
