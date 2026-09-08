"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { ArtifactCard } from "@/components/dashboard/artifact-card";
import {
  modulePptUrl,
  type ActivityContent,
  type DeckContent,
  type ModuleArtifact,
  type QuizContent,
} from "@/lib/api";
import { MARKDOWN_CLASS } from "@/lib/artifact";
import { cn } from "@/lib/utils";

/** Read-only render of one saved artifact. Reuses the dashboard's polished
 *  quiz / activity / slides cards; an explanation is plain, borderless prose
 *  (no card chrome -- it reads like a chat reply, not a document).
 *
 *  `moduleId` is needed to build the .pptx download URL for a `ppt` artifact. */
export function ArtifactView({
  artifact,
  moduleId,
}: {
  artifact: ModuleArtifact;
  moduleId?: string;
}) {
  const content = artifact.content_json;
  if (!content) return null;

  if (artifact.artifact_type === "explanation") {
    return (
      <div className={cn(MARKDOWN_CLASS, "text-base")}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content.text ?? ""}</ReactMarkdown>
      </div>
    );
  }

  if (artifact.artifact_type === "quiz") {
    return <ArtifactCard type="quiz" content={content as QuizContent} />;
  }

  if (artifact.artifact_type === "ppt") {
    return (
      <ArtifactCard
        type="ppt"
        content={content as DeckContent}
        downloadUrl={moduleId ? modulePptUrl(moduleId, artifact.id) : undefined}
        filename={(content as DeckContent).title}
      />
    );
  }

  return <ArtifactCard type="activity" content={content as ActivityContent} />;
}
