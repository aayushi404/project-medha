"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  CheckCircle2,
  ClipboardPenLine,
  Flag,
  Loader2,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  getChapters,
  getHomeworkToday,
  getTopics,
  type Chapter,
  type Topic,
  type WorkUpdateHomeworkRef,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/copy";
import { useLessonContext } from "@/lib/lesson-context";
import {
  AI_USEFULNESS_OPTIONS,
  PRINCIPAL_BADGES,
  QUICK_ACTIVITIES,
  useWorkUpdates,
  type AiHelpfulnessRating,
  type QuickWorkActivity,
  type TeacherWorkUpdate,
} from "@/lib/work-update-store";

const selectCls =
  "w-full rounded-lg border border-border bg-background px-2.5 py-2 text-xs text-foreground focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta disabled:opacity-50";
const inputCls =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs placeholder:text-muted-foreground/60 focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta";

export function WorkUpdateModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { teacher, accessToken } = useAuth();
  const { gradeId, subjectId, chapterId, options } = useLessonContext();
  const { addWorkUpdate, getUpdatesForTeacher } = useWorkUpdates();
  const { locale } = useLocale();
  const isHi = locale === "hi";

  const [tab, setTab] = useState<"new" | "mine">("new");

  // Teacher picks class, subject and chapter from lists (defaults to the
  // current lesson context so the common case stays quick).
  const [pickGrade, setPickGrade] = useState<string>(gradeId ?? "");
  const [pickSubject, setPickSubject] = useState<string>(subjectId ?? "");
  const [pickChapter, setPickChapter] = useState<string>(chapterId ?? "");
  const [chapterList, setChapterList] = useState<Chapter[]>(options.chapters);
  const [topicList, setTopicList] = useState<Topic[]>([]);
  const [pickedTopics, setPickedTopics] = useState<string[]>([]);
  const [otherTopics, setOtherTopics] = useState("");
  const [activityDetail, setActivityDetail] = useState("");
  const [todayHomework, setTodayHomework] = useState<WorkUpdateHomeworkRef[]>([]);

  const [selectedActivities, setSelectedActivities] = useState<QuickWorkActivity[]>([]);
  const [aiRating, setAiRating] = useState<AiHelpfulnessRating>("very_helpful");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const grades = useMemo(() => {
    const seen = new Map<string, { id: string; label: string; level: number }>();
    for (const p of options.pairs) {
      if (!seen.has(p.grade_id))
        seen.set(p.grade_id, { id: p.grade_id, label: p.grade_label, level: p.numeric_level });
    }
    return [...seen.values()].sort((a, b) => a.level - b.level);
  }, [options.pairs]);
  const subjects = useMemo(
    () => options.pairs.filter((p) => p.grade_id === pickGrade),
    [options.pairs, pickGrade],
  );

  useEffect(() => {
    if (!open || !pickGrade || !pickSubject) return;
    let cancelled = false;
    getChapters(pickGrade, pickSubject)
      .then((c) => {
        if (cancelled) return;
        setChapterList(c);
        setPickChapter((cur) => (c.some((x) => x.id === cur) ? cur : ""));
      })
      .catch(() => !cancelled && setChapterList([]));
    return () => {
      cancelled = true;
    };
  }, [open, pickGrade, pickSubject]);

  // Sub-topics of the chosen chapter, offered once "Chapter Taught" is ticked.
  const taughtChapter = selectedActivities.includes("taught_chapter");
  useEffect(() => {
    if (!open || !pickChapter || !taughtChapter) return;
    let cancelled = false;
    getTopics(pickChapter)
      .then((t) => !cancelled && setTopicList(t))
      .catch(() => !cancelled && setTopicList([]));
    return () => {
      cancelled = true;
    };
  }, [open, pickChapter, taughtChapter]);

  // Homework the teacher already set today for this class and subject is
  // ticked automatically and can't be unticked.
  useEffect(() => {
    if (!open || !pickGrade || !pickSubject) return;
    let cancelled = false;
    getHomeworkToday(accessToken, pickGrade, pickSubject)
      .then((h) => {
        if (cancelled) return;
        setTodayHomework(h);
        if (h.length > 0)
          setSelectedActivities((prev) =>
            prev.includes("homework_given") ? prev : [...prev, "homework_given"],
          );
      })
      .catch(() => !cancelled && setTodayHomework([]));
    return () => {
      cancelled = true;
    };
  }, [open, accessToken, pickGrade, pickSubject]);

  if (!open) return null;

  const homeworkLocked = todayHomework.length > 0;
  const topicsShown = pickChapter && taughtChapter ? topicList : [];

  function onGradeChange(id: string) {
    setPickGrade(id);
    const first = options.pairs.find((p) => p.grade_id === id);
    onSubjectChange(first?.subject_id ?? "");
  }
  function onSubjectChange(id: string) {
    setPickSubject(id);
    setPickChapter("");
    setChapterList([]);
    setTopicList([]);
    setPickedTopics([]);
    setTodayHomework([]);
    setSelectedActivities((prev) => prev.filter((a) => a !== "homework_given"));
  }
  function onChapterChange(id: string) {
    setPickChapter(id);
    setTopicList([]);
    setPickedTopics([]);
  }

  function toggleActivity(id: QuickWorkActivity) {
    if (id === "homework_given" && homeworkLocked) return;
    setSelectedActivities((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id],
    );
  }
  function toggleTopic(title: string) {
    setPickedTopics((prev) =>
      prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title],
    );
  }

  function validate(): string | null {
    if (!pickGrade || !pickSubject || !pickChapter)
      return isHi ? "कक्षा, विषय और अध्याय चुनें।" : "Please choose class, subject and chapter.";
    if (selectedActivities.length === 0)
      return isHi ? "कम से कम 1 गतिविधि चुनें।" : "Please select at least 1 activity done today.";
    if (taughtChapter && pickedTopics.length === 0 && !otherTopics.trim())
      return isHi
        ? "बताएँ कि अध्याय का कौन-सा भाग पढ़ाया।"
        : "Pick the sub-topics you taught, or write them under Other.";
    if (selectedActivities.includes("hands_on_activity") && !activityDetail.trim())
      return isHi ? "बताएँ कि कौन-सी कक्षा गतिविधि कराई।" : "Tell us which class activity you did.";
    if (!note.trim())
      return isHi ? "प्रधानाचार्य के लिए छोटी टिप्पणी ज़रूरी है।" : "A short note for the Principal is required.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      toast.error(problem);
      return;
    }
    setSubmitting(true);
    try {
      await addWorkUpdate({
        grade_id: pickGrade,
        subject_id: pickSubject,
        chapter_id: pickChapter,
        activities: selectedActivities,
        topics: taughtChapter ? pickedTopics : [],
        other_topics: taughtChapter ? otherTopics.trim() || null : null,
        activity_detail: selectedActivities.includes("hands_on_activity")
          ? activityDetail.trim()
          : null,
        ai_usefulness: aiRating,
        note: note.trim(),
      });
      toast.success(
        isHi
          ? "दैनिक कार्य रिपोर्ट प्रधानाचार्य को भेज दी गई! ✨"
          : "Work update recorded & sent to Principal! ✨",
      );
      setSelectedActivities([]);
      setPickedTopics([]);
      setOtherTopics("");
      setActivityDetail("");
      setNote("");
      setTodayHomework([]);
      setTab("mine");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : isHi ? "अपडेट करने में समस्या आई।" : "Failed to record work update.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const mine = getUpdatesForTeacher(teacher?.id).slice(0, 20);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>

        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-terracotta/10 text-terracotta">
            <ClipboardPenLine className="size-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold leading-none">
              {isHi ? "दैनिक कार्य अपडेट (Daily Work Update)" : "Daily Work Update"}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {isHi
                ? "आज आपने कक्षा में क्या कराया? सूची से चुनें और सबमिट करें।"
                : "Pick from the lists, tick what you did and submit."}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-muted/60 p-1 text-xs font-medium">
          {(["new", "mine"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`rounded-lg py-1.5 transition-colors ${
                tab === k ? "bg-card text-foreground shadow-xs" : "text-muted-foreground"
              }`}
            >
              {k === "new"
                ? isHi ? "नया अपडेट" : "New update"
                : `${isHi ? "मेरे अपडेट" : "My updates"} (${mine.length})`}
            </button>
          ))}
        </div>

        {tab === "mine" ? (
          <MyUpdates items={mine} isHi={isHi} />
        ) : (
          <>
            {/* Class / Subject / Chapter pickers */}
            <div className="mt-3.5 grid grid-cols-2 gap-2 rounded-xl bg-muted/60 p-2.5 text-xs">
              <label className="space-y-1">
                <span className="text-muted-foreground">{isHi ? "कक्षा" : "Class"}</span>
                <select value={pickGrade} onChange={(e) => onGradeChange(e.target.value)} className={selectCls}>
                  <option value="">{isHi ? "चुनें" : "Select"}</option>
                  {grades.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-muted-foreground">{isHi ? "विषय" : "Subject"}</span>
                <select
                  value={pickSubject}
                  onChange={(e) => onSubjectChange(e.target.value)}
                  disabled={!pickGrade}
                  className={selectCls}
                >
                  <option value="">{isHi ? "चुनें" : "Select"}</option>
                  {subjects.map((p) => (
                    <option key={p.subject_id} value={p.subject_id}>
                      {p.subject_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="col-span-2 space-y-1">
                <span className="text-muted-foreground">{isHi ? "अध्याय" : "Chapter"}</span>
                <select
                  value={pickChapter}
                  onChange={(e) => onChapterChange(e.target.value)}
                  disabled={!pickSubject}
                  className={selectCls}
                >
                  <option value="">{isHi ? "अध्याय चुनें" : "Select chapter"}</option>
                  {chapterList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.chapter_number}. {c.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {/* 1. Activities */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {isHi ? "1. आज क्या कराया? (टिक करें)" : "1. What did you cover today? (Tick Mark)"}
                </label>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  {QUICK_ACTIVITIES.map((act) => {
                    const checked = selectedActivities.includes(act.id);
                    return (
                      <button
                        key={act.id}
                        type="button"
                        onClick={() => toggleActivity(act.id)}
                        className={`flex items-center gap-2 rounded-xl border p-2.5 text-left text-xs transition-all ${
                          checked
                            ? "border-terracotta bg-terracotta/10 font-medium text-terracotta shadow-xs"
                            : "border-border bg-background text-foreground/80 hover:bg-muted/70"
                        }`}
                      >
                        <div
                          className={`flex size-4 shrink-0 items-center justify-center rounded-md border text-[10px] ${
                            checked
                              ? "border-terracotta bg-terracotta text-white"
                              : "border-muted-foreground/40 bg-card"
                          }`}
                        >
                          {checked && <Check className="size-3 stroke-[3]" />}
                        </div>
                        <span className="text-sm">{act.icon}</span>
                        <span className="truncate">{isHi ? act.labelHi : act.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sub-topics once "Chapter Taught" is ticked */}
              {taughtChapter && (
                <div className="rounded-xl border border-border bg-background p-3">
                  <div className="text-xs font-semibold text-foreground">
                    {isHi ? "📖 अध्याय के कौन-से भाग पढ़ाए?" : "📖 Which sub-topics did you teach?"}
                  </div>
                  {!pickChapter ? (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {isHi ? "पहले अध्याय चुनें।" : "Choose a chapter above first."}
                    </p>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {topicsShown.map((t) => {
                        const on = pickedTopics.includes(t.title);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => toggleTopic(t.title)}
                            className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                              on
                                ? "border-terracotta bg-terracotta/10 font-medium text-terracotta"
                                : "border-border bg-card text-foreground/80 hover:bg-muted"
                            }`}
                          >
                            {on && <Check className="mr-1 inline size-3 stroke-[3]" />}
                            {t.title}
                          </button>
                        );
                      })}
                      {topicsShown.length === 0 && (
                        <span className="text-xs text-muted-foreground">
                          {isHi ? "इस अध्याय में उप-विषय सूची नहीं है — नीचे लिखें।" : "No sub-topics listed. Write them below."}
                        </span>
                      )}
                    </div>
                  )}
                  <input
                    type="text"
                    value={otherTopics}
                    onChange={(e) => setOtherTopics(e.target.value)}
                    placeholder={isHi ? "अन्य (अपना लिखें)…" : "Other (write your own)…"}
                    maxLength={300}
                    className={inputCls}
                  />
                </div>
              )}

              {/* Which class activity */}
              {selectedActivities.includes("hands_on_activity") && (
                <div className="rounded-xl border border-border bg-background p-3">
                  <label className="block text-xs font-semibold text-foreground">
                    {isHi ? "🧪 कौन-सी कक्षा गतिविधि कराई?" : "🧪 Which class activity did you do?"}
                  </label>
                  <input
                    type="text"
                    value={activityDetail}
                    onChange={(e) => setActivityDetail(e.target.value)}
                    placeholder={
                      isHi ? "उदा. वाष्पीकरण का प्रयोग, समूह चर्चा…" : "e.g. Evaporation experiment, group discussion…"
                    }
                    maxLength={300}
                    className={inputCls}
                  />
                </div>
              )}

              {/* Homework already assigned today */}
              {homeworkLocked && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs">
                  <div className="font-semibold text-emerald-700 dark:text-emerald-300">
                    {isHi ? "📝 आज दिया गया गृहकार्य (स्वतः जुड़ा)" : "📝 Homework you assigned today (added automatically)"}
                  </div>
                  <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-foreground/85">
                    {todayHomework.map((h) => (
                      <li key={h.id}>{h.title}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 2. AI helpfulness */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Sparkles className="size-3.5 text-amber-500" />
                  <span>
                    {isHi
                      ? "2. मेधा AI असिस्टेंट आज कितना मददगार रहा?"
                      : "2. How useful was Medha AI Assistant today?"}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  {AI_USEFULNESS_OPTIONS.map((opt) => {
                    const active = aiRating === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setAiRating(opt.id)}
                        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                          active
                            ? "border-primary bg-primary font-medium text-primary-foreground shadow-xs"
                            : "border-border bg-card text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        <span>{opt.emoji}</span>
                        <span className="truncate">{isHi ? opt.labelHi : opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Required note */}
              <div>
                <label className="block text-xs text-muted-foreground">
                  {isHi
                    ? "3. प्रधानाचार्य के लिए छोटी टिप्पणी (ज़रूरी)"
                    : "3. Short note for Principal (required)"}
                </label>
                <input
                  type="text"
                  required
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={
                    isHi
                      ? "उदा. बच्चों ने प्रयोग में बहुत रुचि दिखाई..."
                      : "e.g. Cleared all doubts on chemical equations..."
                  }
                  maxLength={300}
                  className={inputCls}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={onClose}>
                  {isHi ? "रद्द करें" : "Cancel"}
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={submitting}
                  className="bg-terracotta text-white hover:bg-terracotta/90"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                      {isHi ? "सहेजा जा रहा है…" : "Submitting…"}
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-1.5 size-3.5" />
                      {isHi ? "अपडेट सबमिट करें" : "Submit Work Update"}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function MyUpdates({ items, isHi }: { items: TeacherWorkUpdate[]; isHi: boolean }) {
  if (items.length === 0) {
    return (
      <p className="mt-6 rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
        {isHi ? "अभी कोई अपडेट नहीं।" : "No work updates yet."}
      </p>
    );
  }
  return (
    <div className="mt-4 space-y-3">
      {items.map((u) => {
        const approvals = u.reactions.filter((r) => r.value === "approve");
        const disapprovals = u.reactions.filter((r) => r.value === "disapprove");
        const fb = u.principal_feedback;
        const badge = fb?.badge ? PRINCIPAL_BADGES[fb.badge] : null;
        return (
          <div key={u.id} className="rounded-xl border border-border bg-background p-3 text-xs">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold text-foreground">
                  {u.grade_label} · {u.subject_name}
                </div>
                <div className="text-muted-foreground">{u.chapter_title}</div>
              </div>
              <span className="shrink-0 text-[11px] text-muted-foreground">{u.date}</span>
            </div>
            {(u.topics.length > 0 || u.other_topics) && (
              <div className="mt-1.5 text-foreground/80">
                {[...u.topics, ...(u.other_topics ? [u.other_topics] : [])].join(" · ")}
              </div>
            )}
            {fb && (
              <div
                className={`mt-2 rounded-lg border p-2 ${
                  fb.flagged
                    ? "border-rose-500/40 bg-rose-500/10"
                    : "border-border bg-muted/40"
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold">
                  {fb.flagged && <Flag className="size-3 text-rose-600" />}
                  <span>{isHi ? "प्रधानाचार्य" : "Principal"}</span>
                  {badge && (
                    <span className={`rounded-full border px-1.5 text-[10px] ${badge.color}`}>
                      {badge.emoji} {isHi ? badge.labelHi : badge.label.split(" (")[0]}
                    </span>
                  )}
                  {fb.flagged && (
                    <span className="text-[10px] font-bold text-rose-600">
                      {isHi ? "फ़्लैग किया गया" : "FLAGGED"}
                    </span>
                  )}
                </div>
                {fb.note && <p className="mt-1 text-foreground/85">{fb.note}</p>}
              </div>
            )}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <ReactionNames
                icon={<ThumbsUp className="size-3 text-emerald-600" />}
                label={isHi ? "सहमत" : "Approved"}
                names={approvals.map((r) => r.student_name)}
              />
              <ReactionNames
                icon={<ThumbsDown className="size-3 text-rose-600" />}
                label={isHi ? "असहमत" : "Disapproved"}
                names={disapprovals.map((r) => r.student_name)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ReactionNames({
  icon,
  label,
  names,
}: {
  icon: React.ReactNode;
  label: string;
  names: string[];
}) {
  return (
    <div className="rounded-lg bg-muted/40 p-2">
      <div className="flex items-center gap-1 font-semibold text-foreground">
        {icon}
        <span>
          {label} ({names.length})
        </span>
      </div>
      <div className="mt-1 text-[11px] leading-snug text-muted-foreground">
        {names.length ? names.join(", ") : "—"}
      </div>
    </div>
  );
}
