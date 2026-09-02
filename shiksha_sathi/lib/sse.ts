import { API_BASE_URL, extractErrorMessage } from "@/lib/api";

export type StreamDone = {
  // set by the teacher chat (a Module is derived per session); the student
  // tutor chat has no modules and only sends `message_id`
  module_id?: string;
  artifact_id?: string;
  artifact_type?: "quiz" | "activity" | "ppt";
  message_id?: string;
};

type StreamHandlers = {
  onToken: (text: string) => void;
  onDone: (payload: StreamDone) => void;
  onError: (message: string) => void;
};

/**
 * POSTs to an SSE endpoint (`/chat/sessions/{id}/messages` or `.../generate`)
 * and dispatches `token` / `done` / `error` events. Built on fetch + a
 * ReadableStream reader rather than EventSource so the Authorization bearer
 * header can be sent (same reason lib/api.ts's apiFetch exists).
 */
export async function streamGeneration(
  path: string,
  body: unknown,
  token: string | null,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") return;
    handlers.onError("Network error. Check your connection.");
    return;
  }

  if (!res.ok || !res.body) {
    handlers.onError(await extractErrorMessage(res));
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      // Normalise CRLF (sse-starlette uses \r\n) so frame splitting on \n\n works.
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

      // SSE frames are separated by a blank line
      let sep: number;
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        dispatchFrame(frame, handlers);
      }
    }
  } catch (err) {
    if ((err as Error).name !== "AbortError") {
      handlers.onError("Connection interrupted.");
    }
  }
}

function dispatchFrame(frame: string, handlers: StreamHandlers): void {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return;

  let data: unknown;
  try {
    data = JSON.parse(dataLines.join("\n"));
  } catch {
    return;
  }

  if (event === "token") handlers.onToken((data as { text: string }).text);
  else if (event === "done") handlers.onDone(data as StreamDone);
  else if (event === "error") handlers.onError((data as { message: string }).message);
}
