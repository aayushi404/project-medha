import type { ActivityContent, DeckContent, QuizContent } from "@/lib/api";

/** Tailwind child-selector classes for rendering markdown without the
 *  typography plugin. Shared by the chat thread and the module detail view. */
export const MARKDOWN_CLASS =
  "text-sm leading-relaxed [&_p]:my-1.5 [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 " +
  "[&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_h1]:mt-2 [&_h1]:text-[15px] " +
  "[&_h1]:font-semibold [&_h2]:mt-2 [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:mt-1.5 " +
  "[&_h3]:font-medium [&_strong]:font-semibold [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 " +
  "[&_code]:text-xs [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 " +
  "[&_blockquote]:text-muted-foreground";

const FENCE = /^```(?:json)?\s*|\s*```$/gi;

/** Tolerant JSON extraction from streamed model output: strip ``` fences, take
 *  the first '{' .. last '}', parse. Returns null on any failure. */
export function extractJson<T = Record<string, unknown>>(raw: string): T | null {
  const s = raw.trim().replace(FENCE, "");
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a === -1 || b <= a) return null;
  try {
    const parsed = JSON.parse(s.slice(a, b + 1)) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as T) : null;
  } catch {
    return null;
  }
}

export function ackLine(
  type: "quiz" | "activity" | "ppt",
  content: QuizContent | ActivityContent | DeckContent | null,
): string {
  if (!content) {
    if (type === "quiz") return "Couldn't build the quiz.";
    if (type === "ppt") return "Couldn't build the slides.";
    return "Couldn't build the activity.";
  }
  if (type === "quiz") {
    const n = (content as QuizContent).questions?.length ?? 0;
    return `Quiz ready — ${n} question${n === 1 ? "" : "s"}.`;
  }
  if (type === "ppt") {
    const n = (content as DeckContent).slides?.length ?? 0;
    return `Slides ready — ${n} slide${n === 1 ? "" : "s"}.`;
  }
  const title = (content as ActivityContent).title?.trim();
  return `Class activity ready${title ? `: ${title}` : ""}.`;
}
