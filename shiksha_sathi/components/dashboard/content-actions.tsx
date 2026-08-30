"use client";

import {
  Check,
  Copy,
  HelpCircle,
  Network,
  Presentation,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SpeakButton } from "@/components/chat/speak-button";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";

type GenKind = "quiz" | "activity";

function Pill({
  onClick,
  icon: Icon,
  children,
  muted,
}: {
  onClick: () => void;
  icon: LucideIcon;
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs transition-colors hover:bg-muted hover:text-foreground",
        muted ? "text-muted-foreground/70" : "text-muted-foreground",
      )}
    >
      <Icon className="size-3.5" />
      {children}
    </button>
  );
}

/**
 * The row of actions under a block of AI-generated content: read aloud, copy,
 * and "turn this into ..." generators. Mind map / PPT are stubbed until the
 * backend can produce them.
 */
export function ContentActions({
  speechId,
  speechText,
  copyText,
  onQuiz,
  onActivity,
  hide = [],
  className,
}: {
  speechId: string;
  speechText: string;
  copyText?: string;
  onQuiz?: () => void;
  onActivity?: () => void;
  hide?: GenKind[];
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function doCopy() {
    if (!copyText) return;
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  const comingSoon = () => toast(copy.comingSoonMindmapPpt);

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <SpeakButton id={speechId} text={speechText} />

      {copyText ? (
        <button
          type="button"
          onClick={doCopy}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? copy.copied : copy.copyText}
        </button>
      ) : null}

      {onQuiz && !hide.includes("quiz") ? (
        <Pill onClick={onQuiz} icon={HelpCircle}>
          {copy.makeQuiz}
        </Pill>
      ) : null}
      {onActivity && !hide.includes("activity") ? (
        <Pill onClick={onActivity} icon={Users}>
          {copy.makeActivity}
        </Pill>
      ) : null}
      <Pill onClick={comingSoon} icon={Network} muted>
        {copy.makeMindmap}
      </Pill>
      <Pill onClick={comingSoon} icon={Presentation} muted>
        {copy.makePpt}
      </Pill>
    </div>
  );
}
