"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardPenLine, Flag, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ActivityPicker } from "@/components/work-update/activity-picker";
import { ChapterCompletionToggle } from "@/components/work-update/chapter-completion-toggle";
import { ClassSubjectChapterPicker } from "@/components/work-update/class-subject-chapter-picker";
import { MySyllabusProgress } from "@/components/work-update/my-syllabus-progress";
import { TopicsAndNotes } from "@/components/work-update/topics-and-notes";
import { WorkUpdateHistory } from "@/components/work-update/work-update-history";
import {
  getChapters,
  getHomeworkToday,
  getMySections,
  getMySyllabusCoverage,
  getTopics,
  type Chapter,
  type SyllabusCoverageApi,
  type TeacherSection,
  type Topic,
  type WorkUpdateHomeworkRef,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/copy";
import { useLessonContext } from "@/lib/lesson-context";
import {
  type AiHelpfulnessRating,
  type QuickWorkActivity,
  useWorkUpdates,
} from "@/lib/work-update-store";

export function WorkUpdatePage() {
  const { teacher, accessToken } = useAuth();
  const { gradeId, subjectId, chapterId, options } = useLessonContext();
  const { addWorkUpdate, getUpdatesForTeacher } = useWorkUpdates();
  const { locale } = useLocale();
  const isHi = locale === "hi";

  const [tab, setTab] = useState<"log" | "history">("log");

  const [sections, setSections] = useState<TeacherSection[]>([]);
  const [sectionsLoading, setSectionsLoading] = useState(true);
  const [pickSection, setPickSection] = useState<string>("");
  const [pickSubject, setPickSubject] = useState<string>(subjectId ?? "");
  const [pickChapter, setPickChapter] = useState<string>(chapterId ?? "");
  const [chapterList, setChapterList] = useState<Chapter[]>(options.chapters);
  const [topicList, setTopicList] = useState<Topic[]>([]);
  const [pickedTopics, setPickedTopics] = useState<string[]>([]);
  const [otherTopics, setOtherTopics] = useState("");
  const [activityDetail, setActivityDetail] = useState("");
  const [todayHomework, setTodayHomework] = useState<WorkUpdateHomeworkRef[]>([]);

  const [selectedActivities, setSelectedActivities] = useState<QuickWorkActivity[]>([]);
  const [chapterCompleted, setChapterCompleted] = useState(false);
  const [aiRating, setAiRating] = useState<AiHelpfulnessRating>("very_helpful");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [myCoverage, setMyCoverage] = useState<SyllabusCoverageApi[] | null>(null);

  const selectedSection = useMemo(() => sections.find((s) => s.id === pickSection) ?? null, [sections, pickSection]);
  const pickGrade = selectedSection?.grade_id ?? "";
  const subjects = selectedSection?.subjects ?? [];
  const pickedChapterTitle = chapterList.find((c) => c.id === pickChapter)?.title ?? "";

  // Class sections (same source as Homework/Attendance), not a flat curriculum
  // list. Subject is resolved in the same pass once the list settles (prefer
  // the lesson-context subject if it's actually taught in that class) --
  // folded in here, rather than a separate reactive effect, since this is
  // the only place it needs to happen; onSectionChange handles the rest.
  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    getMySections(accessToken)
      .then((list) => {
        if (cancelled) return;
        setSections(list);
        let chosenId = pickSection && list.some((s) => s.id === pickSection) ? pickSection : "";
        if (!chosenId) {
          const matchGrade = gradeId ? list.find((s) => s.grade_id === gradeId) : undefined;
          chosenId = matchGrade?.id ?? list[0]?.id ?? "";
        }
        setPickSection(chosenId);
        const chosenSection = list.find((s) => s.id === chosenId);
        setPickSubject((cur) => {
          if (cur && chosenSection?.subjects.some((s) => s.id === cur)) return cur;
          if (subjectId && chosenSection?.subjects.some((s) => s.id === subjectId)) return subjectId;
          return chosenSection?.subjects[0]?.id ?? "";
        });
      })
      .catch(() => !cancelled && setSections([]))
      .finally(() => !cancelled && setSectionsLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally mount-only; onSectionChange/onSubjectChange own later changes
  }, [accessToken]);

  function refreshMyCoverage() {
    if (!accessToken) return;
    getMySyllabusCoverage(accessToken)
      .then(setMyCoverage)
      .catch(() => setMyCoverage((cur) => cur ?? []));
  }
  useEffect(refreshMyCoverage, [accessToken]);

  useEffect(() => {
    if (!pickGrade || !pickSubject) return;
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
  }, [pickGrade, pickSubject]);

  // Sub-topics are offered once the teacher says the chapter was taught
  // today, or is marking it complete outright.
  const taughtChapter = selectedActivities.includes("taught_chapter");
  const showTopics = Boolean(pickChapter) && (taughtChapter || chapterCompleted);
  useEffect(() => {
    if (!pickChapter || !showTopics) return;
    let cancelled = false;
    getTopics(pickChapter)
      .then((t) => !cancelled && setTopicList(t))
      .catch(() => !cancelled && setTopicList([]));
    return () => {
      cancelled = true;
    };
  }, [pickChapter, showTopics]);

  // Homework the teacher already set today for this class/subject is ticked
  // automatically and can't be unticked.
  useEffect(() => {
    if (!accessToken || !pickGrade || !pickSubject) return;
    let cancelled = false;
    getHomeworkToday(accessToken, pickGrade, pickSubject)
      .then((h) => {
        if (cancelled) return;
        setTodayHomework(h);
        if (h.length > 0) setSelectedActivities((prev) => (prev.includes("homework_given") ? prev : [...prev, "homework_given"]));
      })
      .catch(() => !cancelled && setTodayHomework([]));
    return () => {
      cancelled = true;
    };
  }, [accessToken, pickGrade, pickSubject]);

  function resetClassFields() {
    setPickChapter("");
    setChapterList([]);
    setTopicList([]);
    setPickedTopics([]);
    setTodayHomework([]);
    setChapterCompleted(false);
    setSelectedActivities((prev) => prev.filter((a) => a !== "homework_given"));
  }
  function onSectionChange(id: string) {
    setPickSection(id);
    const sec = sections.find((s) => s.id === id);
    setPickSubject(sec?.subjects[0]?.id ?? "");
    resetClassFields();
  }
  function onSubjectChange(id: string) {
    setPickSubject(id);
    resetClassFields();
  }
  function onChapterChange(id: string) {
    setPickChapter(id);
    setTopicList([]);
    setPickedTopics([]);
    setChapterCompleted(false);
  }
  function toggleActivity(id: QuickWorkActivity) {
    setSelectedActivities((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]));
  }
  function toggleTopic(title: string) {
    setPickedTopics((prev) => (prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]));
  }

  function validate(): string | null {
    if (!pickSection || !pickGrade || !pickSubject || !pickChapter)
      return isHi ? "कक्षा, विषय और अध्याय चुनें।" : "Please choose class, subject and chapter.";
    if (selectedActivities.length === 0)
      return isHi ? "कम से कम 1 गतिविधि चुनें।" : "Please select at least 1 activity done today.";
    if (showTopics && pickedTopics.length === 0 && !otherTopics.trim())
      return isHi ? "बताएँ कि अध्याय का कौन-सा भाग पढ़ाया।" : "Pick the sub-topics you taught, or write them under Other.";
    if (selectedActivities.includes("hands_on_activity") && !activityDetail.trim())
      return isHi ? "बताएँ कि कौन-सी कक्षा गतिविधि कराई।" : "Tell us which class activity you did.";
    if (!note.trim()) return isHi ? "प्रधानाचार्य के लिए छोटी टिप्पणी ज़रूरी है।" : "A short note for the Principal is required.";
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
        topics: showTopics ? pickedTopics : [],
        other_topics: showTopics ? otherTopics.trim() || null : null,
        activity_detail: selectedActivities.includes("hands_on_activity") ? activityDetail.trim() : null,
        ai_usefulness: aiRating,
        note: note.trim(),
        chapter_completed: chapterCompleted,
      });
      toast.success(
        chapterCompleted
          ? isHi
            ? "शानदार! अध्याय पूर्ण के रूप में दर्ज हुआ और प्रधानाचार्य को भेजा गया! ✨"
            : "Chapter marked complete and sent to Principal! ✨"
          : isHi
            ? "दैनिक कार्य रिपोर्ट प्रधानाचार्य को भेज दी गई! ✨"
            : "Work update recorded & sent to Principal! ✨",
      );
      setSelectedActivities([]);
      setChapterCompleted(false);
      setPickedTopics([]);
      setOtherTopics("");
      setActivityDetail("");
      setNote("");
      setTodayHomework([]);
      refreshMyCoverage();
      setTab("history");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : isHi ? "अपडेट करने में समस्या आई।" : "Failed to record work update.");
    } finally {
      setSubmitting(false);
    }
  }

  const mine = getUpdatesForTeacher(teacher?.id);

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-terracotta/10 text-terracotta">
            <ClipboardPenLine className="size-5" />
          </span>
          <div>
            <h1 className="text-[15px] font-semibold leading-none">
              {isHi ? "दैनिक कार्य अपडेट (Daily Work Update)" : "Daily Work Update"}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {isHi
                ? "आज आपने कक्षा में क्या कराया? सूची से चुनें और सबमिट करें।"
                : "Pick from the lists, tick what you did and submit."}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
          <MySyllabusProgress isHi={isHi} coverage={myCoverage} />

          <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted/60 p-1 text-sm font-medium">
            {(["log", "history"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={`rounded-lg py-2 transition-colors ${
                  tab === k ? "bg-card text-foreground shadow-xs" : "text-muted-foreground"
                }`}
              >
                {k === "log" ? (isHi ? "नया अपडेट" : "Log Work") : `${isHi ? "मेरे अपडेट" : "History"} (${mine.length})`}
              </button>
            ))}
          </div>

          {tab === "history" ? (
            <WorkUpdateHistory items={mine} isHi={isHi} />
          ) : sectionsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : sections.length === 0 ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-terracotta/30 bg-terracotta/10 p-3 text-xs text-foreground">
              <Flag className="mt-0.5 size-4 shrink-0 text-terracotta" />
              <p>
                {isHi
                  ? 'आपको अभी कोई कक्षा/विषय नहीं सौंपा गया है। अपने प्रधानाचार्य से "कक्षाएँ" में आपको विषय शिक्षक के रूप में जोड़ने के लिए कहें।'
                  : 'You don\'t have a class or subject assigned yet. Ask your Principal to add you as the subject teacher under "Classes".'}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <ClassSubjectChapterPicker
                isHi={isHi}
                loading={false}
                sections={sections}
                subjects={subjects}
                chapterList={chapterList}
                pickSection={pickSection}
                pickSubject={pickSubject}
                pickChapter={pickChapter}
                onSectionChange={onSectionChange}
                onSubjectChange={onSubjectChange}
                onChapterChange={onChapterChange}
              />

              {pickChapter && (
                <ChapterCompletionToggle
                  isHi={isHi}
                  chapterTitle={pickedChapterTitle}
                  checked={chapterCompleted}
                  onChange={setChapterCompleted}
                />
              )}

              <ActivityPicker
                isHi={isHi}
                selected={selectedActivities}
                onToggle={toggleActivity}
                todayHomework={todayHomework}
                activityDetail={activityDetail}
                onActivityDetailChange={setActivityDetail}
              />

              <TopicsAndNotes
                isHi={isHi}
                showTopics={showTopics}
                chapterPicked={Boolean(pickChapter)}
                topics={topicList}
                pickedTopics={pickedTopics}
                onToggleTopic={toggleTopic}
                otherTopics={otherTopics}
                onOtherTopicsChange={setOtherTopics}
                aiRating={aiRating}
                onAiRatingChange={setAiRating}
                note={note}
                onNoteChange={setNote}
              />

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  type="submit"
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
          )}
        </div>
      </div>
    </main>
  );
}
