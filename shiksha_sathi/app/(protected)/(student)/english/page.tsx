"use client";

import { BookOpen, MessageCircle, Sparkles, Volume2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

import { AssistantBody, AssistantMark, UserBubble } from "@/components/chat/turn";
import { Composer } from "@/components/dashboard/composer";
import { PronunciationPractice } from "@/components/english/pronunciation-practice";
import { VoiceChatLauncher } from "@/components/voice/voice-chat-panel";
import { createEnglishSession } from "@/lib/api";
import { MARKDOWN_CLASS } from "@/lib/artifact";
import { useAuth } from "@/lib/auth-context";
import { useCopy } from "@/lib/copy";
import {
  dailyWord,
  ENGLISH_LESSONS,
  SPEAKING_PROMPTS,
  VOCAB_SETS,
  type EnglishLesson,
} from "@/lib/english-content";
import { playSpeech } from "@/lib/speech-api";
import { streamGeneration } from "@/lib/sse";
import { useStudentData } from "@/lib/student-context";
import { cn } from "@/lib/utils";

type Tab = "chat" | "lessons" | "vocab" | "speak" | "word";

type UiMessage = {
  id: string;
  role: "student" | "assistant";
  content: string;
  streaming?: boolean;
};

function uid() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

export default function EnglishPage() {
  const copy = useCopy();
  const { accessToken } = useAuth();
  const { firstName } = useStudentData();
  const word = dailyWord();

  const [tab, setTab] = useState<Tab>("chat");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [lessonTopic, setLessonTopic] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [vocabSet, setVocabSet] = useState(VOCAB_SETS[0]!.id);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const ensureSession = useCallback(
    async (topic?: string | null): Promise<string | null> => {
      if (sessionId && (!topic || topic === lessonTopic)) return sessionId;
      try {
        const s = await createEnglishSession(accessToken, {
          lesson_topic: topic ?? lessonTopic,
        });
        setSessionId(s.id);
        if (topic) setLessonTopic(topic);
        return s.id;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : copy.student.couldNotStart);
        return null;
      }
    },
    [sessionId, lessonTopic, accessToken, copy.student],
  );

  async function runMessage(content: string, topic?: string | null) {
    const id = await ensureSession(topic);
    if (!id) return;
    setBusy(true);
    setTab("chat");

    const asstId = uid();
    setMessages((prev) => [
      ...prev,
      { id: uid(), role: "student", content },
      { id: asstId, role: "assistant", content: "", streaming: true },
    ]);

    const ac = new AbortController();
    abortRef.current = ac;
    let acc = "";

    await streamGeneration(
      `/english/sessions/${id}/messages`,
      { content },
      accessToken,
      {
        onToken: (t) => {
          acc += t;
          setMessages((prev) =>
            prev.map((m) => (m.id === asstId ? { ...m, content: acc } : m)),
          );
        },
        onDone: () =>
          setMessages((prev) =>
            prev.map((m) => (m.id === asstId ? { ...m, streaming: false } : m)),
          ),
        onError: (msg) => {
          setMessages((prev) => prev.filter((m) => m.id !== asstId));
          toast.error(msg);
        },
      },
      ac.signal,
    );
    setBusy(false);
  }

  function startLesson(lesson: EnglishLesson) {
    setLessonTopic(lesson.title);
    setSessionId(null);
    setMessages([]);
    void runMessage(lesson.starterPrompt, lesson.title);
  }

  const tabs: { key: Tab; label: string; icon: typeof BookOpen }[] = [
    { key: "chat", label: copy.english.tabChat, icon: MessageCircle },
    { key: "lessons", label: copy.english.tabLessons, icon: BookOpen },
    { key: "vocab", label: copy.english.tabVocab, icon: Sparkles },
    { key: "speak", label: copy.english.tabSpeak, icon: Volume2 },
    { key: "word", label: copy.english.tabWord, icon: Sparkles },
  ];

  const activeVocab = VOCAB_SETS.find((v) => v.id === vocabSet) ?? VOCAB_SETS[0]!;

  return (
    <main className="relative flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-border bg-gradient-to-r from-terracotta/5 via-gold/5 to-sage/5 px-5 py-4">
        <h1 className="font-serif text-lg">{copy.english.title}</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">{copy.english.subtitle}</p>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs transition-colors",
              tab === key
                ? "bg-terracotta/15 font-medium text-terracotta"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === "chat" ? (
        <>
          {messages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
              <div className="text-4xl">🇬🇧</div>
              <div className="text-base">{copy.english.greeting(firstName)}</div>
              <p className="max-w-sm text-sm text-muted-foreground">{copy.english.greetingSub}</p>
            </div>
          ) : (
            <div ref={scrollRef} className="flex-1 overflow-y-auto">
              <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-5">
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
                      </AssistantBody>
                    </div>
                  ),
                )}
              </div>
            </div>
          )}
          <Composer
            disabled={busy}
            placeholder={copy.english.chatPlaceholder}
            onSend={(t) => void runMessage(t)}
            accessToken={accessToken}
            language="en"
          />
        </>
      ) : null}

      {tab === "lessons" ? (
        <div className="flex-1 overflow-y-auto p-4">
          <p className="mb-4 text-center text-sm text-muted-foreground">{copy.english.pickLesson}</p>
          <div className="mx-auto grid max-w-3xl gap-3 sm:grid-cols-2">
            {ENGLISH_LESSONS.map((lesson) => (
              <button
                key={lesson.id}
                type="button"
                onClick={() => startLesson(lesson)}
                className="group rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-terracotta/40 hover:shadow-md"
              >
                <div className="mb-2 text-2xl">{lesson.emoji}</div>
                <div className="text-sm font-medium">{lesson.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">{lesson.subtitle}</div>
                <ul className="mt-3 flex flex-wrap gap-1">
                  {lesson.topics.slice(0, 3).map((t) => (
                    <li
                      key={t}
                      className="rounded-full bg-accent px-2 py-0.5 text-[10px] text-muted-foreground"
                    >
                      {t}
                    </li>
                  ))}
                </ul>
                <span className="mt-3 inline-block text-xs font-medium text-terracotta opacity-0 transition-opacity group-hover:opacity-100">
                  {copy.english.startLesson} →
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {tab === "vocab" ? (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mx-auto flex max-w-3xl flex-wrap gap-2 pb-4">
            {VOCAB_SETS.map((set) => (
              <button
                key={set.id}
                type="button"
                onClick={() => setVocabSet(set.id)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs transition-colors",
                  vocabSet === set.id
                    ? "bg-terracotta text-white"
                    : "bg-muted text-muted-foreground hover:bg-accent",
                )}
              >
                {set.label}
              </button>
            ))}
          </div>
          <p className="mb-4 text-center text-xs text-muted-foreground">{copy.english.vocabPractice}</p>
          <div className="mx-auto grid max-w-3xl gap-3 sm:grid-cols-2">
            {activeVocab.words.map((w) => (
              <button
                key={w.word}
                type="button"
                onClick={() =>
                  void runMessage(
                    `Teach me the word "${w.word}" — meaning, pronunciation (${w.phonetic}), and an example sentence.`,
                  )
                }
                className="rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-gold/50 hover:shadow-sm"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-base font-medium">{w.word}</span>
                  <span className="text-[10px] text-muted-foreground">{w.phonetic}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{w.meaning}</p>
                <p className="mt-1 text-[11px] text-terracotta/80">{w.hindi}</p>
                <p className="mt-2 text-xs italic text-muted-foreground">&ldquo;{w.example}&rdquo;</p>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {tab === "speak" ? (
        <div className="flex-1 overflow-y-auto p-4">
          <p className="mb-6 text-center text-sm text-muted-foreground">{copy.english.speakPrompt}</p>
          <div className="mx-auto flex max-w-xl flex-col gap-3">
            {SPEAKING_PROMPTS.map((prompt, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-xl border border-border bg-card p-4"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-terracotta/15 text-xs font-medium text-terracotta">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{prompt}</p>
                  <PronunciationPractice
                    prompt={prompt}
                    accessToken={accessToken}
                    labels={{
                      listen: copy.english.listenBtn,
                      record: copy.english.recordBtn,
                      stop: copy.english.stopRecordBtn,
                      checking: copy.english.checkingPronunciation,
                      score: copy.english.scoreLabel,
                      heard: copy.english.heardLabel,
                      tips: copy.english.tipsLabel,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      void runMessage(
                        `I want to practice speaking. The sentence is: "${prompt}". Listen to my attempt and help me improve.`,
                      )
                    }
                    className="mt-2 rounded-lg bg-terracotta/15 px-2.5 py-1 text-xs text-terracotta hover:bg-terracotta/25"
                  >
                    {copy.english.speakWithMedha}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {tab === "word" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-10">
          <div className="w-full max-w-md rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/10 to-terracotta/10 p-8 text-center shadow-sm">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              {copy.english.dailyWordTitle}
            </p>
            <p className="mt-4 font-serif text-4xl font-medium text-terracotta">{word.word}</p>
            <p className="mt-2 text-sm">{word.meaning}</p>
            <p className="mt-1 text-sm text-muted-foreground">{word.hindi}</p>
            <p className="mt-4 rounded-lg bg-card/80 px-4 py-2 text-sm italic">
              &ldquo;{word.example}&rdquo;
            </p>
            <p className="mt-4 text-xs text-muted-foreground">
              <span className="font-medium">{copy.english.dailyWordTip}:</span> {word.tip}
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => void playSpeech(word.word, accessToken, { language: "en-IN" })}
                className="rounded-lg bg-accent px-4 py-2 text-xs"
              >
                🔊 Hear it
              </button>
              <button
                type="button"
                onClick={() =>
                  void runMessage(
                    `Teach me today's word "${word.word}" in detail with examples and a short quiz.`,
                  )
                }
                className="rounded-lg bg-terracotta px-4 py-2 text-xs text-white"
              >
                Learn more
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <VoiceChatLauncher
        className="bottom-24 md:bottom-6"
        config={{
          accessToken,
          language: "en",
          title: copy.english.title,
          subtitle: copy.voice.subtitle,
          ensureSession: () => ensureSession(lessonTopic),
          messagePath: (id) => `/english/sessions/${id}/messages`,
        }}
      />
    </main>
  );
}
