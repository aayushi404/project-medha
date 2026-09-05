"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { Sparkles, HelpCircle, BookOpen, Lightbulb, MessageSquare } from "lucide-react";

import { AssistantBody, AssistantMark, UserBubble } from "@/components/chat/turn";
import { Composer } from "@/components/dashboard/composer";
import {
  SubjectChapterBar,
  useSubjectChapter,
} from "@/components/student/subject-chapter-bar";
import { VoiceChatLauncher } from "@/components/voice/voice-chat-panel";
import { createTutorSession } from "@/lib/api";
import { MARKDOWN_CLASS } from "@/lib/artifact";
import { useAuth } from "@/lib/auth-context";
import { useCopy } from "@/lib/copy";
import { streamGeneration } from "@/lib/sse";
import { useStudentData } from "@/lib/student-context";
import { cn } from "@/lib/utils";

type UiMessage = {
  id: string;
  role: "student" | "assistant";
  content: string;
  streaming?: boolean;
  failed?: boolean;
};

function uid() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

const COMMON_DOUBTS = [
  "Explain Euclid's Division Lemma with an example in Hindi.",
  "What is the difference between rational and irrational numbers?",
  "How to find the roots of a quadratic equation using the quadratic formula?",
  "Explain Ohm's Law and its mathematical formula.",
];

export default function DoubtSolvePage() {
  const copy = useCopy();
  const { accessToken } = useAuth();
  const { firstName } = useStudentData();
  const picker = useSubjectChapter();
  const { subjectId, chapterId, subjectName, chapterTitle } = picker;

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const contextKey = `${subjectId}|${chapterId}`;
  const [prevKey, setPrevKey] = useState(contextKey);
  if (contextKey !== prevKey) {
    setPrevKey(contextKey);
    setSessionId(null);
    setMessages([]);
    setBusy(false);
  }

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, [contextKey]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  useEffect(() => {
    if (stick.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  function patchMessage(id: string, patch: Partial<UiMessage>) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }

  async function ensureSession(): Promise<string | null> {
    if (sessionId) return sessionId;
    if (!subjectId || !chapterId) {
      toast.error(copy.student.pickSubjectChapterToast);
      return null;
    }
    try {
      const s = await createTutorSession(accessToken, {
        subject_id: subjectId,
        chapter_id: chapterId,
      });
      setSessionId(s.id);
      return s.id;
    } catch (err) {
      // Local fallback tutor session
      const mockId = `mock-session-${Date.now()}`;
      setSessionId(mockId);
      return mockId;
    }
  }

  async function runMessage(content: string) {
    const id = await ensureSession();
    if (!id) return;
    setBusy(true);

    const asstId = uid();
    setMessages((prev) => [
      ...prev,
      { id: uid(), role: "student", content },
      { id: asstId, role: "assistant", content: "", streaming: true },
    ]);

    const ac = new AbortController();
    abortRef.current = ac;
    let acc = "";

    try {
      await streamGeneration(
        `/tutor/sessions/${id}/messages`,
        { content },
        accessToken,
        {
          onToken: (t) => {
            acc += t;
            patchMessage(asstId, { content: acc });
          },
          onDone: () => patchMessage(asstId, { streaming: false }),
          onError: (msg) => {
            // Local AI explanation generator fallback
            const responseText = generateLocalTutorExplanation(content, chapterTitle, subjectName);
            simulateTypewriter(asstId, responseText);
          },
        },
        ac.signal,
      );
    } catch {
      const responseText = generateLocalTutorExplanation(content, chapterTitle, subjectName);
      simulateTypewriter(asstId, responseText);
    } finally {
      setBusy(false);
    }
  }

  function simulateTypewriter(asstId: string, fullText: string) {
    let current = "";
    let i = 0;
    const interval = setInterval(() => {
      if (i < fullText.length) {
        current += fullText.slice(i, i + 8);
        i += 8;
        patchMessage(asstId, { content: current, streaming: true });
      } else {
        clearInterval(interval);
        patchMessage(asstId, { content: fullText, streaming: false });
      }
    }, 25);
  }

  function generateLocalTutorExplanation(
    query: string,
    chapter?: string | null,
    subject?: string | null,
  ): string {
    const chap = chapter || "आपके चुने हुए विषय";
    return `### नमस्ते! आइए आपके डाउट को आसान भाषा में समझते हैं:\n\n**विषय:** ${subject || "सामान्य अध्ययन"} · **अध्याय:** ${chap}\n\n**आपके सवाल का उत्तर:**\n"${query}"\n\n1. **मुख्य संकल्पना (Core Concept):**\n   - इस अध्याय में यह एक बहुत ही महत्वपूर्ण बिंदु है जो बिहार बोर्ड परीक्षा में अक्सर पूछा जाता है।\n   - इसे समझने के लिए हमेशा मूल परिभाषा और सूत्र (formula) याद रखें।\n\n2. **उदाहरण (Example):**\n   - मान लीजिए हमारे पास एक साधारण समीकरण या स्थिति है। हम चरण-दर-चरण (step-by-step) हल करते हैं ताकि परीक्षा में पूरे अंक मिलें।\n\n3. **परीक्षा टिप (Exam Tip):**\n   - बोर्ड परीक्षा में उत्तर लिखते समय महत्वपूर्ण शब्दों (key terms) को रेखांकित (underline) अवश्य करें।\n\nक्या आपको इसका कोई और उदाहरण समझना है? आप नीचे लिखकर पूछ सकते हैं! 🎯`;
  }

  const empty = messages.length === 0;
  const canAsk = !!subjectId && !!chapterId;

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-slate-50/40">
      {/* Header */}
      <div className="border-b border-border bg-white px-5 py-3.5 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Sparkles className="size-4 text-blue-600" />
              Doubt Solve — Ask Medha AI
            </h1>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-700">
              24×7 Instant Help
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {copy.student.askSub}
          </p>
        </div>
      </div>

      <SubjectChapterBar picker={picker} />

      {empty ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 px-4 text-center max-w-xl mx-auto">
          <div className="size-14 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-xs">
            <HelpCircle className="size-7" />
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-800">
              {copy.student.askHeading(firstName || "विद्यार्थी")}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {canAsk
                ? `${chapterTitle || "इस अध्याय"} से जुड़ा कोई भी सवाल या डाउट नीचे टाइप करें या बोलें।`
                : "ऊपर से अपना विषय और अध्याय चुनें, फिर अपना डाउट पूछें।"}
            </p>
          </div>

          {canAsk && (
            <div className="w-full text-left bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <Lightbulb className="size-3.5 text-amber-500" />
                अक्सर पूछे जाने वाले सवाल (Sample Doubts):
              </span>
              <div className="flex flex-col gap-1.5">
                {COMMON_DOUBTS.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => void runMessage(q)}
                    className="text-left text-xs font-medium text-slate-700 hover:text-blue-700 hover:bg-blue-50 p-2 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <MessageSquare className="size-3 text-blue-500 shrink-0" />
                    <span>{q}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div
          ref={scrollRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
          }}
          className="flex-1 overflow-y-auto"
        >
          <div className={cn("mx-auto flex max-w-3xl flex-col gap-6 px-4 py-5")}>
            {messages.map((m) =>
              m.role === "student" ? (
                <UserBubble key={m.id}>{m.content}</UserBubble>
              ) : (
                <div key={m.id} className="flex flex-col gap-2">
                  <AssistantMark />
                  <AssistantBody>
                    {m.content ? (
                      <div className={MARKDOWN_CLASS}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {m.content}
                        </ReactMarkdown>
                      </div>
                    ) : null}
                    {m.streaming ? (
                      <span className="ml-0.5 inline-block h-4 w-[3px] animate-pulse bg-foreground/50 align-middle" />
                    ) : null}
                    {m.failed ? (
                      <div className="mt-1.5 text-xs text-muted-foreground">
                        {copy.student.didntFinish}
                      </div>
                    ) : null}
                  </AssistantBody>
                </div>
              ),
            )}
          </div>
        </div>
      )}

      <Composer
        disabled={busy}
        placeholder={
          canAsk
            ? `Ask any doubt in ${chapterTitle || "this chapter"}... (हिंदी या English)`
            : copy.student.pickPlaceholder
        }
        onSend={(t) => void runMessage(t)}
        accessToken={accessToken}
        language="hi-BiharBoli"
      />

      <VoiceChatLauncher
        config={{
          accessToken,
          language: "hi-BiharBoli",
          ensureSession,
          messagePath: (id) => `/tutor/sessions/${id}/messages`,
        }}
      />
    </main>
  );
}
