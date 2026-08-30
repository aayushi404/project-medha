"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { ArtifactCard } from "@/components/dashboard/artifact-card";
import type { ActivityContent, ModuleArtifact, QuizContent } from "@/lib/api";
import { MARKDOWN_CLASS } from "@/lib/artifact";

/** Read-only render of one saved artifact. Reuses the dashboard's polished
 *  quiz/activity cards; the explanation is plain prose in a card (the module
 *  page already puts a labelled section heading above it). */
export function ArtifactView({ artifact }: { artifact: ModuleArtifact }) {
  const content = artifact.content_json;
  if (!content) return null;

  if (artifact.artifact_type === "explanation") {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className={MARKDOWN_CLASS}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content.text ?? ""}</ReactMarkdown>
        </div>
      </div>
    );
  }

  if (artifact.artifact_type === "quiz") {
    return <ArtifactCard type="quiz" content={content as QuizContent} />;
  }

  return <ArtifactCard type="activity" content={content as ActivityContent} />;
}
