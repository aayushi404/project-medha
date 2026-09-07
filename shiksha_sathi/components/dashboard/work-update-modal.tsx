"use client";

import { useState } from "react";
import { Check, CheckCircle2, ClipboardPenLine, Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useCopy, useLocale } from "@/lib/copy";
import { useLessonContext } from "@/lib/lesson-context";
import { useProfile } from "@/lib/profile-context";
import {
  AI_USEFULNESS_OPTIONS,
  PRINCIPAL_BADGES,
  QUICK_ACTIVITIES,
  useWorkUpdates,
  type AiHelpfulnessRating,
  type QuickWorkActivity,
} from "@/lib/work-update-store";

export function WorkUpdateModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { teacher } = useAuth();
  const { profile } = useProfile();
  const { gradeId, subjectId, chapterId, options } = useLessonContext();
  const { addWorkUpdate, getTodayUpdateForTeacher } = useWorkUpdates();
  const { locale } = useLocale();
  const isHi = locale === "hi";

  const teacherId = teacher?.id || profile?.id || "teacher-current";
  const teacherName = teacher?.full_name || profile?.full_name || "Teacher";
  const schoolId = teacher?.school_id || profile?.school?.id || "sch-10280105528";
  const schoolName = teacher?.school_name || profile?.school?.name || "Govt. High School";

  // Match selected curriculum labels
  const pair = options.pairs.find((p) => p.grade_id === gradeId && p.subject_id === subjectId);
  const chapter = options.chapters.find((c) => c.id === chapterId);
  const gradeLabel = pair?.grade_label || "Class 9";
  const subjectName = pair?.subject_name || "Science";
  const chapterTitle = chapter?.title || "Current Chapter";

  const todayExisting = getTodayUpdateForTeacher(teacherId);

  // Selected tick marks (default first two checked for easy 1-click flow)
  const [selectedActivities, setSelectedActivities] = useState<QuickWorkActivity[]>([
    "taught_chapter",
    "conducted_quiz",
  ]);
  const [aiRating, setAiRating] = useState<AiHelpfulnessRating>("very_helpful");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  function toggleActivity(id: QuickWorkActivity) {
    setSelectedActivities((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id],
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedActivities.length === 0) {
      toast.error(isHi ? "कम से कम 1 गतिविधि चुनें।" : "Please select at least 1 activity done today.");
      return;
    }
    setSubmitting(true);
    try {
      addWorkUpdate({
        teacher_id: teacherId,
        teacher_name: teacherName,
        school_id: schoolId,
        school_name: schoolName,
        date: new Date().toISOString().slice(0, 10),
        grade_label: gradeLabel,
        subject_name: subjectName,
        chapter_title: chapterTitle,
        activities: selectedActivities,
        ai_usefulness: aiRating,
        note: note.trim() || undefined,
      });
      toast.success(
        isHi
          ? "दैनिक कार्य रिपोर्ट प्रधानाचार्य को भेज दी गई! ✨"
          : "Work update recorded & sent to Principal! ✨",
      );
      onClose();
    } catch {
      toast.error(isHi ? "अपडेट करने में समस्या आई।" : "Failed to record work update.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl text-card-foreground">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <X className="size-4" />
        </button>

        {/* Header */}
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
                ? "आज आपने कक्षा में क्या कराया? केवल टिक करें, कुछ लिखने की ज़रूरत नहीं।"
                : "Fast 1-click update for the Principal. Just tick and submit."}
            </p>
          </div>
        </div>

        {/* Current Class Pill */}
        <div className="mt-3.5 flex flex-wrap items-center gap-1.5 rounded-xl bg-muted/60 p-2.5 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{gradeLabel}</span>
          <span>·</span>
          <span className="font-medium text-foreground">{subjectName}</span>
          <span>·</span>
          <span className="truncate max-w-[240px] text-foreground/90">{chapterTitle}</span>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* 1. Quick Tick-mark Activities */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {isHi ? "1. आज क्या कराया? (टिक करें)" : "1. What did you cover today? (Tick Mark)"}
            </label>
            <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-2">
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

          {/* 2. AI Teaching Assistant Helpfulness Rating */}
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
                        ? "border-primary bg-primary text-primary-foreground font-medium shadow-xs"
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

          {/* 3. Optional 1-line note */}
          <div>
            <label className="block text-xs text-muted-foreground">
              {isHi
                ? "कोई विशेष टिप्पणी? (वैकल्पिक - 1 पंक्ति)"
                : "Short note for Principal (Optional, 1 line):"}
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                isHi
                  ? "उदा. बच्चों ने प्रयोग में बहुत रुचि दिखाई..."
                  : "e.g. Cleared all doubts on chemical equations..."
              }
              maxLength={140}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs placeholder:text-muted-foreground/60 focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
            />
          </div>

          {/* Submit */}
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
      </div>
    </div>
  );
}

export function WorkUpdateButton() {
  const [modalOpen, setModalOpen] = useState(false);
  const { teacher } = useAuth();
  const { getTodayUpdateForTeacher } = useWorkUpdates();
  const { locale } = useLocale();
  const isHi = locale === "hi";

  const todayUpdate = getTodayUpdateForTeacher(teacher?.id);
  const principalFeedback = todayUpdate?.principal_feedback;
  const badgeInfo = principalFeedback?.badge ? PRINCIPAL_BADGES[principalFeedback.badge] : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="group relative flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-all hover:border-terracotta hover:bg-terracotta/5 shadow-xs"
        title="Send Daily Work Update to Principal"
      >
        <span className="flex size-2 rounded-full bg-emerald-500 animate-pulse" />
        <ClipboardPenLine className="size-3.5 text-terracotta transition-transform group-hover:scale-110" />
        <span>{isHi ? "कार्य अपडेट" : "Work Update"}</span>

        {badgeInfo ? (
          <span className={`ml-1 inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.2 text-[10px] font-semibold ${badgeInfo.color}`}>
            <span>{badgeInfo.emoji}</span>
            <span>{isHi ? badgeInfo.labelHi.split(" (")[0] : badgeInfo.label.split(" (")[0]}</span>
          </span>
        ) : todayUpdate ? (
          <span className="ml-1 rounded-full bg-emerald-100 px-1.5 py-0.2 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            ✓ Done
          </span>
        ) : null}
      </button>

      <WorkUpdateModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
