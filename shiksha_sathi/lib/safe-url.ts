/**
 * Only plain web links may become clickable. A `javascript:` or `data:` URL in
 * an <a href> runs script in this origin when clicked -- and a teacher-supplied
 * link is shown to every student. Returns the normalized URL, or null.
 */
export function safeHttpUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}
