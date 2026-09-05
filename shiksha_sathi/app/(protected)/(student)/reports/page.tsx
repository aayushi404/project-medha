"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  Award,
  Clock,
  Target,
  Flame,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Calendar,
  Sparkles,
} from "lucide-react";

import { useStudentData } from "@/lib/student-context";
import { useAuth } from "@/lib/auth-context";

type SubjectProgress = {
  name: string;
  hindiName: string;
  accuracy: number;
  testsTaken: number;
  studyHours: number;
  color: string;
  barColor: string;
};

const SUBJECT_PERFORMANCE: SubjectProgress[] = [
  {
    name: "Mathematics",
    hindiName: "गणित",
    accuracy: 88,
    testsTaken: 8,
    studyHours: 14.2,
    color: "text-amber-700 bg-amber-50 border-amber-200",
    barColor: "bg-amber-500",
  },
  {
    name: "Science",
    hindiName: "विज्ञान",
    accuracy: 82,
    testsTaken: 7,
    studyHours: 11.5,
    color: "text-blue-700 bg-blue-50 border-blue-200",
    barColor: "bg-blue-600",
  },
  {
    name: "Social Science",
    hindiName: "सामाजिक विज्ञान",
    accuracy: 78,
    testsTaken: 5,
    studyHours: 8.0,
    color: "text-rose-700 bg-rose-50 border-rose-200",
    barColor: "bg-rose-500",
  },
  {
    name: "Hindi (गोधूलि)",
    hindiName: "हिंदी",
    accuracy: 94,
    testsTaken: 4,
    studyHours: 6.2,
    color: "text-emerald-700 bg-emerald-50 border-emerald-200",
    barColor: "bg-emerald-600",
  },
  {
    name: "English (Panorama)",
    hindiName: "अंग्रेज़ी",
    accuracy: 85,
    testsTaken: 3,
    studyHours: 4.8,
    color: "text-sky-700 bg-sky-50 border-sky-200",
    barColor: "bg-sky-500",
  },
  {
    name: "Sanskrit (पीयूषम्)",
    hindiName: "संस्कृत",
    accuracy: 90,
    testsTaken: 3,
    studyHours: 5.0,
    color: "text-purple-700 bg-purple-50 border-purple-200",
    barColor: "bg-purple-600",
  },
];

const RECENT_TESTS = [
  {
    id: "1",
    title: "Bihar Board Matric Maths Open Test 2026",
    subject: "Mathematics",
    date: "Today, 04 Sep",
    score: "40/50",
    accuracy: "80%",
    status: "Excellent",
  },
  {
    id: "2",
    title: "Light: Reflection & Refraction Quiz",
    subject: "Science",
    date: "Yesterday",
    score: "9/10",
    accuracy: "90%",
    status: "Mastered",
  },
  {
    id: "3",
    title: "Polynomials Quick Practice Test",
    subject: "Mathematics",
    date: "02 Sep 2026",
    score: "8/10",
    accuracy: "80%",
    status: "Good",
  },
  {
    id: "4",
    title: "Nationalism in India Chapter Quiz",
    subject: "Social Science",
    date: "31 Aug 2026",
    score: "7/10",
    accuracy: "70%",
    status: "Needs Revision",
  },
];

const ACHIEVEMENTS = [
  {
    emoji: "🔥",
    title: "5-Day Streak",
    desc: "Studied consecutively for 5 days",
    unlocked: true,
  },
  {
    emoji: "📐",
    title: "Math Wizard",
    desc: "Scored >85% in 5 math quizzes",
    unlocked: true,
  },
  {
    emoji: "⚡",
    title: "Quick Learner",
    desc: "Solved 100+ practice questions",
    unlocked: true,
  },
  {
    emoji: "🏆",
    title: "Top 10 Ranker",
    desc: "Ranked in Top 10 of school mock tests",
    unlocked: true,
  },
];

export default function StudentReportsPage() {
  const { teacher } = useAuth();
  const { firstName, gradeLabel } = useStudentData();
  const studentName = firstName || teacher?.full_name || "Student";

  return (
    <main className="flex flex-1 flex-col overflow-y-auto bg-slate-50/60 pb-16">
      {/* ─── Header ─── */}
      <div className="border-b border-slate-200 bg-white px-5 py-4">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="size-5 text-blue-600" />
                Performance & Study Report
              </h1>
              <span className="rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5">
                Class 10 Matric
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Detailed tracking of your test scores, subject accuracy, time spent, and state rank.
            </p>
          </div>

          <Link
            href="/open-test"
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition-colors"
          >
            Take New Test →
          </Link>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-8 space-y-6">
        {/* ─── Scorecard KPIs ─── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Tests Attempted
              </span>
              <div className="flex size-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Target className="size-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-black text-slate-900">28</span>
              <span className="text-xs text-emerald-600 font-semibold ml-2">↑ +4 this week</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Quizzes & Open Tests</p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Overall Accuracy
              </span>
              <div className="flex size-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="size-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-black text-slate-900">84.2%</span>
              <span className="text-xs text-emerald-600 font-semibold ml-2">↑ High Mastery</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">280 of 332 questions correct</p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Study Time
              </span>
              <div className="flex size-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <Clock className="size-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-black text-slate-900">49.7 hrs</span>
              <span className="text-xs text-amber-600 font-semibold ml-2">Avg 1.6 hr/day</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Active reading & practice</p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                School Rank
              </span>
              <div className="flex size-8 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                <Award className="size-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-black text-slate-900">#4</span>
              <span className="text-xs text-purple-600 font-semibold ml-2">Top 5% in District</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Govt. Girls High School Patna</p>
          </div>
        </div>

        {/* ─── Subject-Wise Mastery ─── */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Subject-Wise Accuracy & Mastery
              </h3>
              <p className="text-xs text-slate-500">
                Based on continuous practice quizzes and mock evaluations
              </p>
            </div>
            <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-xl">
              All 6 Board Subjects
            </span>
          </div>

          <div className="space-y-4">
            {SUBJECT_PERFORMANCE.map((sub) => (
              <div key={sub.name} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-800">
                    {sub.name} ({sub.hindiName})
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400 font-normal">
                      {sub.testsTaken} tests · {sub.studyHours} hrs
                    </span>
                    <span className="text-slate-900 font-mono font-bold">
                      {sub.accuracy}%
                    </span>
                  </div>
                </div>

                <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${sub.barColor} transition-all duration-500`}
                    style={{ width: `${sub.accuracy}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── AI Insights: Strong & Weak Areas ─── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50/40 p-5 shadow-xs">
            <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5 mb-3">
              <CheckCircle2 className="size-4 text-emerald-600" />
              Your Strongest Topics (मजबूत पकड़)
            </h4>
            <ul className="space-y-2 text-xs text-slate-700">
              <li className="flex items-center justify-between rounded-xl bg-white p-2.5 border border-emerald-100 shadow-2xs">
                <span className="font-semibold">Real Numbers & Polynomials (Math)</span>
                <span className="font-bold text-emerald-700">95% Accuracy</span>
              </li>
              <li className="flex items-center justify-between rounded-xl bg-white p-2.5 border border-emerald-100 shadow-2xs">
                <span className="font-semibold">Chemical Reactions & Acids/Bases (Chem)</span>
                <span className="font-bold text-emerald-700">92% Accuracy</span>
              </li>
              <li className="flex items-center justify-between rounded-xl bg-white p-2.5 border border-emerald-100 shadow-2xs">
                <span className="font-semibold">Nationalism in India (History)</span>
                <span className="font-bold text-emerald-700">88% Accuracy</span>
              </li>
            </ul>
          </div>

          <div className="rounded-3xl border border-amber-200 bg-amber-50/40 p-5 shadow-xs">
            <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5 mb-3">
              <AlertTriangle className="size-4 text-amber-600" />
              Recommended for Revision (पुनरीक्षण की आवश्यकता)
            </h4>
            <ul className="space-y-2 text-xs text-slate-700">
              <li className="flex items-center justify-between rounded-xl bg-white p-2.5 border border-amber-100 shadow-2xs">
                <span className="font-semibold">Arithmetic Progressions (Math Ch 5)</span>
                <Link
                  href="/learn"
                  className="font-bold text-amber-700 hover:underline"
                >
                  Revise Notes →
                </Link>
              </li>
              <li className="flex items-center justify-between rounded-xl bg-white p-2.5 border border-amber-100 shadow-2xs">
                <span className="font-semibold">Ray Optics & Lens Formula (Physics)</span>
                <Link
                  href="/doubts"
                  className="font-bold text-amber-700 hover:underline"
                >
                  Ask Doubt →
                </Link>
              </li>
              <li className="flex items-center justify-between rounded-xl bg-white p-2.5 border border-amber-100 shadow-2xs">
                <span className="font-semibold">Trigonometric Identities (Math Ch 8)</span>
                <Link
                  href="/practice"
                  className="font-bold text-amber-700 hover:underline"
                >
                  Take Practice →
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* ─── Recent Test History Table ─── */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs">
          <h3 className="text-base font-bold text-slate-900 mb-4">
            Recent Test History
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="rounded-l-xl p-3">Test Title</th>
                  <th className="p-3">Subject</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Score</th>
                  <th className="p-3">Accuracy</th>
                  <th className="rounded-r-xl p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {RECENT_TESTS.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3 font-semibold text-slate-900">{t.title}</td>
                    <td className="p-3 text-slate-600">{t.subject}</td>
                    <td className="p-3 text-slate-400">{t.date}</td>
                    <td className="p-3 font-bold font-mono text-slate-800">{t.score}</td>
                    <td className="p-3 font-bold text-emerald-600">{t.accuracy}</td>
                    <td className="p-3">
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ─── Achievements / Badges ─── */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs">
          <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Sparkles className="size-4 text-amber-500" />
            Badges & Milestones
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {ACHIEVEMENTS.map((ach, idx) => (
              <div
                key={idx}
                className="flex flex-col items-center justify-center rounded-2xl bg-slate-50 border border-slate-200/80 p-4 text-center"
              >
                <span className="text-3xl mb-1.5">{ach.emoji}</span>
                <h5 className="text-xs font-bold text-slate-900">{ach.title}</h5>
                <p className="text-[10px] text-slate-500 mt-0.5">{ach.desc}</p>
                <span className="mt-2 text-[9px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  Unlocked ✓
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
