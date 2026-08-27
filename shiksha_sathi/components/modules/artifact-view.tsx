"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { ArtifactCard } from "@/components/dashboard/artifact-card";
import type { ActivityContent, ModuleArtifact, QuizContent } from "@/lib/api";
import { MARKDOWN_CLASS } from "@/lib/artifact";
import { cn } from "@/lib/utils";

/** Read-only render of one saved artifact. Reuses the dashboard's quiz/activity
 *  cards; adds the explanation (markdown) case. */
export function ArtifactView({ artifact }: { artifact: ModuleArtifact }) {
  const content = artifact.content_json;
  if (!content) return null;

  if (artifact.artifact_type === "explanation") {
    return (
      <div className={cn(MARKDOWN_CLASS, "rounded-2xl bg-card p-3.5 ring-1 ring-foreground/10")}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content.text ?? ""}</ReactMarkdown>
      </div>
    );
  }

  if (artifact.artifact_type === "quiz") {
    return <ArtifactCard type="quiz" content={content as QuizContent} />;
  }

  return <ArtifactCard type="activity" content={content as ActivityContent} />;
}
