"use client";

import { useEffect, useState } from "react";
import {
  Phone,
  PhoneOff,
  PhoneCall,
  Mic,
  Volume2,
  Thermometer,
  CheckCircle2,
  Sparkles,
  Clock,
  User,
  X,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LiveCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentName: string;
  guardianPhone?: string | null;
  onCompleteCall?: (reasonText: string, transcriptText: string) => void;
}

const DEFAULT_PHONE = "+917050020815";
const FEVER_REASON = "Reason for absence: High Fever";

function getMockTranscript(studentName: string, phone: string) {
  return [
    { speaker: "Medha AI", text: `नमस्ते, क्या आप ${phone} से बोल रहे हैं? ${studentName} आज स्कूल नहीं आया।` },
    { speaker: "Guardian", text: `नमस्ते मैडम, ${studentName} को कल रात से तेज बुखार (High Fever) है, इसलिए आज स्कूल नहीं आ सकेगा।` },
    { speaker: "Medha AI", text: "जी धन्यवाद जानकारी के लिए। कृपया ध्यान रखें और जल्द ठीक होने की कामना करते हैं। नमस्ते।" },
  ];
}

export function LiveCallModal({
  isOpen,
  onClose,
  studentName,
  guardianPhone,
  onCompleteCall,
}: LiveCallModalProps) {
  const [seconds, setSeconds] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const phone = guardianPhone || DEFAULT_PHONE;
  const mockTranscript = getMockTranscript(studentName, phone);

  // Timer logic: count up to 20 seconds
  useEffect(() => {
    if (!isOpen) {
      setSeconds(0);
      setIsCompleted(false);
      setShowTranscript(false);
      return;
    }

    const interval = setInterval(() => {
      setSeconds((prev) => {
        if (prev >= 19) {
          clearInterval(interval);
          handleFinishCall();
          return 20;
        }
        return prev + 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen]);

  function handleFinishCall() {
    setIsCompleted(true);
    const transcriptStr = mockTranscript.map(
      (t) => `${t.speaker === "Medha AI" ? "assistant" : "user"}: ${t.text}`
    ).join("\n");
    if (onCompleteCall) {
      onCompleteCall(FEVER_REASON, transcriptStr);
    }
  }

  if (!isOpen) return null;

  // Determine sub-phase during call
  let callPhase = "Dialing...";
  let speakerText = `Initiating call to ${phone}...`;
  if (seconds >= 3 && seconds < 7) {
    callPhase = "Ringing...";
    speakerText = "Ringing guardian's phone...";
  } else if (seconds >= 7 && seconds < 13) {
    callPhase = "Connected • Medha AI Spoke";
    speakerText = `Medha: "नमस्ते, ${studentName} आज स्कूल क्यों नहीं आया?"`;
  } else if (seconds >= 13 && seconds < 18) {
    callPhase = "Connected • Guardian Replying";
    speakerText = `Guardian: "नमस्ते मैडम, उसको तेज बुखार (High Fever) है..."`;
  } else if (seconds >= 18 && seconds < 20) {
    callPhase = "Wrap-up";
    speakerText = `Medha: "ठीक है, ध्यान रखें। धन्यवाद।"`;
  }

  const formatTimer = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className={cn(
          "relative w-full max-w-md overflow-hidden rounded-3xl border border-border/80 bg-card p-6 shadow-2xl transition-all duration-300",
          !isCompleted && "cursor-pointer"
        )}
        onClick={() => {
          if (!isCompleted) handleFinishCall();
        }}
      >
        {/* Close button if completed */}
        {isCompleted && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="absolute right-4 top-4 z-10 flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}

        {!isCompleted ? (
          /* --- LIVE CALL IN PROGRESS VIEW --- */
          <div className="flex flex-col items-center text-center">
            {/* Top Bar Status */}
            <div className="flex w-full items-center justify-between border-b border-border/40 pb-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 font-medium text-emerald-500">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Automated Call
              </span>
              <span className="inline-flex items-center gap-1 font-mono text-foreground">
                <Clock className="size-3 text-muted-foreground" />
                {formatTimer(seconds)} / 00:20
              </span>
            </div>

            {/* Pulsing Avatar & Ripple Rings */}
            <div className="relative my-8 flex items-center justify-center">
              {/* Outer Pulsing Rings */}
              <div className="absolute size-36 rounded-full bg-primary/10 animate-ping duration-1000" />
              <div className="absolute size-28 rounded-full bg-primary/20 animate-pulse" />
              
              {/* Central Avatar */}
              <div className="relative flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-terracotta text-white shadow-xl shadow-amber-500/20">
                <User className="size-10" />
              </div>
            </div>

            {/* Student & Phone Details */}
            <h2 className="text-xl font-bold tracking-tight text-foreground">{studentName}</h2>
            <p className="mt-1 font-mono text-sm text-muted-foreground">{phone}</p>
            
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
              <Sparkles className="size-3.5 animate-spin" />
              {callPhase}
            </div>

            {/* Audio Wave Visualizer Animation */}
            <div className="my-6 flex items-center justify-center gap-1 h-8">
              {[40, 70, 30, 90, 60, 100, 50, 80, 45, 75].map((height, i) => (
                <span
                  key={i}
                  className="w-1 rounded-full bg-primary/70 animate-pulse"
                  style={{
                    height: `${height}%`,
                    animationDelay: `${(i % 5) * 150}ms`,
                    animationDuration: "800ms",
                  }}
                />
              ))}
            </div>

            {/* Live Subtitle Preview */}
            <div className="w-full rounded-2xl bg-muted/60 p-3.5 text-xs text-muted-foreground min-h-[54px] flex items-center justify-center">
              <p className="italic text-foreground/90">&ldquo;{speakerText}&rdquo;</p>
            </div>

            {/* Tap Hint / End Call Button */}
            <div className="mt-6 flex w-full flex-col gap-2">
              <p className="text-[11px] text-muted-foreground/80">
                Tap card anywhere or wait 20s to complete call
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleFinishCall();
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-destructive py-2.5 text-xs font-semibold text-destructive-foreground shadow-lg transition-transform active:scale-95"
              >
                <PhoneOff className="size-4" />
                End Call & View Outcome
              </button>
            </div>
          </div>
        ) : (
          /* --- CALL COMPLETED OUTCOME VIEW --- */
          <div className="flex flex-col text-left animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center gap-2 text-emerald-500">
              <CheckCircle2 className="size-5" />
              <span className="text-xs font-semibold uppercase tracking-wider">Call Completed</span>
            </div>
            <h2 className="mt-1 text-lg font-bold text-foreground">Absence Verification Complete</h2>
            <p className="text-xs text-muted-foreground">
              Automated call to guardian at <span className="font-mono">{phone}</span>
            </p>

            {/* Highlighted Reason Card */}
            <div className="mt-4 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
                  <Thermometer className="size-5" />
                </div>
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    Extracted Reason
                  </span>
                  <h3 className="text-base font-bold text-foreground">High Fever</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Guardian confirmed {studentName} has high fever and will rest today.
                  </p>
                </div>
              </div>
            </div>

            {/* Call Transcript Collapse */}
            <div className="mt-4">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTranscript(!showTranscript);
                }}
                className="flex w-full items-center justify-between rounded-xl bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <span>View Spoken Transcript</span>
                <ChevronDown className={cn("size-4 transition-transform", showTranscript && "rotate-180")} />
              </button>

              {showTranscript && (
                <div className="mt-2 flex flex-col gap-2 rounded-xl bg-muted/30 p-3 text-xs">
                  {mockTranscript.map((turn, idx) => (
                    <div key={idx} className="flex flex-col gap-0.5">
                      <span className="font-semibold text-foreground">{turn.speaker}:</span>
                      <span className="text-muted-foreground">{turn.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90 active:scale-95"
            >
              <CheckCircle2 className="size-4" />
              Save & Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
