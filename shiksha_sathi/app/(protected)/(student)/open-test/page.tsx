"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  FileText,
  Clock,
  Award,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCcw,
  Sparkles,
  ChevronRight,
  HelpCircle,
  BarChart3,
  X,
  Flame,
} from "lucide-react";

type Question = {
  id: number;
  question: string;
  hindiQuestion: string;
  options: string[];
  correct: number;
  explanation: string;
};

type MockTest = {
  id: string;
  title: string;
  hindiTitle: string;
  subject: string;
  durationMinutes: number;
  totalMarks: number;
  questionsCount: number;
  status: "LIVE" | "UPCOMING" | "ENDED";
  participants: number;
  difficulty: "Easy" | "Medium" | "Hard";
  questions: Question[];
};

const OPEN_TESTS: MockTest[] = [
  {
    id: "test-math-01",
    title: "Bihar Board Matric Mathematics Open Test 2026",
    hindiTitle: "बिहार बोर्ड मैट्रिक गणित ओपन मॉक टेस्ट (वास्तविक संख्याएँ, बहुपद एवं त्रिकोणमिति)",
    subject: "Mathematics",
    durationMinutes: 20,
    totalMarks: 50,
    questionsCount: 5,
    status: "LIVE",
    participants: 4892,
    difficulty: "Medium",
    questions: [
      {
        id: 1,
        question: "What is the HCF of 96 and 404 by prime factorisation method?",
        hindiQuestion: "अभाज्य गुणनखंडन विधि द्वारा 96 और 404 का म०स० (HCF) क्या होगा?",
        options: ["2", "4", "6", "8"],
        correct: 1,
        explanation: "96 = 2⁵ × 3, 404 = 2² × 101. HCF = 2² = 4.",
      },
      {
        id: 2,
        question: "If α and β are the zeroes of the quadratic polynomial f(x) = x² - 5x + 6, then α + β is:",
        hindiQuestion: "यदि α और β द्विघात बहुपद f(x) = x² - 5x + 6 के शून्यक हैं, तो (α + β) का मान क्या होगा?",
        options: ["-5", "5", "6", "-6"],
        correct: 1,
        explanation: "For ax² + bx + c, sum of zeroes (α + β) = -b/a = -(-5)/1 = 5.",
      },
      {
        id: 3,
        question: "The value of (sin² 30° + cos² 30°) is equal to:",
        hindiQuestion: "(sin² 30° + cos² 30°) का मान किसके बराबर होता है?",
        options: ["0", "1/2", "1", "√3/2"],
        correct: 2,
        explanation: "By the fundamental trigonometric identity, sin²θ + cos²θ = 1 for any angle θ.",
      },
      {
        id: 4,
        question: "The discriminant of the quadratic equation 2x² - 4x + 3 = 0 is:",
        hindiQuestion: "द्विघात समीकरण 2x² - 4x + 3 = 0 का विविक्तकर (D) क्या होगा?",
        options: ["-8", "8", "4", "-4"],
        correct: 0,
        explanation: "D = b² - 4ac = (-4)² - 4(2)(3) = 16 - 24 = -8.",
      },
      {
        id: 5,
        question: "If a line divides two sides of a triangle in the same ratio, then the line is parallel to the third side. This theorem is known as:",
        hindiQuestion: "यदि कोई रेखा किसी त्रिभुज की दो भुजाओं को एक ही अनुपात में विभाजित करती है, तो वह तीसरी भुजा के समांतर होती है। यह प्रमेय क्या कहलाता है?",
        options: [
          "Pythagoras Theorem",
          "Converse of Thales Theorem (Converse of BPT)",
          "Midpoint Theorem",
          "Area Theorem",
        ],
        correct: 1,
        explanation: "This is the Converse of Basic Proportionality Theorem (थेल्स प्रमेय का विलोम).",
      },
    ],
  },
  {
    id: "test-science-01",
    title: "Bihar State Science Mega Open Test (Physics & Chem)",
    hindiTitle: "बिहार राज्य विज्ञान महा-परीक्षा (प्रकाश, विद्युत एवं अम्ल-क्षार)",
    subject: "Science",
    durationMinutes: 20,
    totalMarks: 50,
    questionsCount: 5,
    status: "LIVE",
    participants: 6120,
    difficulty: "Medium",
    questions: [
      {
        id: 1,
        question: "The SI unit of electric potential difference is:",
        hindiQuestion: "विद्युत विभवांतर का SI मात्रक क्या होता है?",
        options: ["Ampere (A)", "Volt (V)", "Ohm (Ω)", "Watt (W)"],
        correct: 1,
        explanation: "The SI unit of electric potential difference is Volt (V).",
      },
      {
        id: 2,
        question: "What is the chemical formula of Bleaching Powder?",
        hindiQuestion: "विरंजक चूर्ण (Bleaching Powder) का रासायनिक सूत्र क्या है?",
        options: ["CaOCl₂", "CaCO₃", "NaHCO₃", "CaSO₄·½H₂O"],
        correct: 0,
        explanation: "Bleaching powder is Calcium hypochlorite / oxychloride, CaOCl₂.",
      },
      {
        id: 3,
        question: "A convex lens has a focal length of 20 cm. Its power is:",
        hindiQuestion: "एक उत्तल लेंस की फोकस दूरी 20 cm है। इसकी क्षमता (Power) क्या होगी?",
        options: ["+2 D", "+5 D", "-5 D", "+0.2 D"],
        correct: 1,
        explanation: "P = 1/f(m) = 1/0.2 = +5 Dioptre.",
      },
      {
        id: 4,
        question: "Which of the following is a balanced decomposition reaction?",
        hindiQuestion: "निम्नलिखित में से कौन-सी संतुलित वियोजन अभिक्रिया है?",
        options: [
          "2H₂ + O₂ → 2H₂O",
          "CaCO₃ → CaO + CO₂",
          "Zn + H₂SO₄ → ZnSO₄ + H₂",
          "Na + Cl → NaCl",
        ],
        correct: 1,
        explanation: "CaCO₃ decomposing into CaO + CO₂ upon heating is a thermal decomposition reaction.",
      },
      {
        id: 5,
        question: "The pH value of pure distilled water at 25°C is:",
        hindiQuestion: "25°C पर शुद्ध आसुत जल का pH मान कितना होता है?",
        options: ["0", "7", "14", "1"],
        correct: 1,
        explanation: "Pure water is neutral with a pH of 7.",
      },
    ],
  },
  {
    id: "test-social-01",
    title: "Bihar Board Social Science State Ranker Test",
    hindiTitle: "सामाजिक विज्ञान राज्य-स्तरीय ओपन टेस्ट (चंपारण सत्याग्रह एवं भूगोल)",
    subject: "Social Science",
    durationMinutes: 30,
    totalMarks: 50,
    questionsCount: 5,
    status: "UPCOMING",
    participants: 2310,
    difficulty: "Easy",
    questions: [],
  },
];

export default function OpenTestPage() {
  const [activeTest, setActiveTest] = useState<MockTest | null>(null);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [testFinished, setTestFinished] = useState(false);

  // Timer effect
  useEffect(() => {
    if (!activeTest || testFinished) return;
    if (timeLeft <= 0) {
      if (activeTest.questions.length > 0 && timeLeft === 0 && Object.keys(selectedAnswers).length > 0) {
        setTestFinished(true);
      }
      return;
    }
    const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(timer);
  }, [activeTest, timeLeft, testFinished, selectedAnswers]);

  function startTest(test: MockTest) {
    if (test.questions.length === 0) return;
    setActiveTest(test);
    setCurrentQIndex(0);
    setSelectedAnswers({});
    setTimeLeft(test.durationMinutes * 60);
    setTestFinished(false);
  }

  function handleSelectOption(optIdx: number) {
    if (testFinished) return;
    setSelectedAnswers((prev) => ({
      ...prev,
      [currentQIndex]: optIdx,
    }));
  }

  function submitTest() {
    setTestFinished(true);
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  // Result calculation
  const totalQuestions = activeTest?.questions.length ?? 0;
  const answeredCount = Object.keys(selectedAnswers).length;
  let correctCount = 0;
  if (activeTest && testFinished) {
    activeTest.questions.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.correct) correctCount++;
    });
  }
  const scorePercent = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  return (
    <main className="flex flex-1 flex-col overflow-y-auto bg-slate-50/60 pb-16">
      {/* ─── Header ─── */}
      <div className="border-b border-slate-200 bg-white px-5 py-4">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileText className="size-5 text-red-600" />
                Open Test Series — Bihar State Board
              </h1>
              <span className="rounded-full bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 animate-pulse">
                LIVE NOW
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              State-wide competitive mock tests with instant answer key, live timer, and percentile rankings.
            </p>
          </div>

          <Link
            href="/reports"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
          >
            <BarChart3 className="size-3.5 text-blue-600" />
            View Test Reports
          </Link>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 pt-5 sm:px-8 space-y-6">
        {/* ─── Hero Open Test Callout ─── */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 p-6 text-white shadow-md sm:p-8">
          <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2 max-w-xl">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur-md">
                <Sparkles className="size-3.5 text-yellow-300" />
                <span>BSEB Official Pattern Exam Series</span>
              </div>
              <h2 className="text-2xl font-black sm:text-3xl">
                Weekly State Mock Examination 2026
              </h2>
              <p className="text-xs text-white/90 leading-relaxed">
                Compete with 50,000+ government school students across all 38 districts of Bihar. Free analysis report & solution videos.
              </p>
            </div>

            <button
              type="button"
              onClick={() => startTest(OPEN_TESTS[0])}
              className="rounded-2xl bg-white px-6 py-3.5 text-xs font-bold text-red-700 shadow-lg hover:bg-red-50 transition-all flex items-center justify-center gap-2 shrink-0"
            >
              <Play className="size-4 fill-red-700" />
              Start Live Mathematics Test
            </button>
          </div>
          <div className="pointer-events-none absolute -right-10 -bottom-10 size-48 rounded-full bg-white/10 blur-xl" />
        </div>

        {/* ─── Available Open Tests Grid ─── */}
        <div>
          <h3 className="text-base font-bold text-slate-800 mb-3">
            Available & Upcoming Tests
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {OPEN_TESTS.map((test) => (
              <div
                key={test.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:border-red-300 hover:shadow-md transition-all"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        test.status === "LIVE"
                          ? "bg-red-100 text-red-700 border border-red-200"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      ● {test.status}
                    </span>
                    <span className="text-xs font-medium text-slate-500">
                      👥 {test.participants.toLocaleString()} Students
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-slate-900 leading-snug">
                    {test.title}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    {test.hindiTitle}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-600 font-medium">
                    <div className="flex items-center gap-1">
                      <Clock className="size-3.5 text-slate-400" />
                      <span>{test.durationMinutes} Mins</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Award className="size-3.5 text-slate-400" />
                      <span>{test.totalMarks} Marks</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <FileText className="size-3.5 text-slate-400" />
                      <span>{test.questionsCount} Questions</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100">
                  {test.status === "LIVE" ? (
                    <button
                      type="button"
                      onClick={() => startTest(test)}
                      className="w-full rounded-xl bg-red-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <Play className="size-3.5 fill-white" />
                      Start Test Now
                    </button>
                  ) : (
                    <button
                      disabled
                      className="w-full rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-400 cursor-not-allowed text-center"
                    >
                      Scheduled for Tomorrow
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Interactive Test Runner Modal ─── */}
      <AnimatePresence>
        {activeTest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative flex h-full max-h-[95vh] w-full max-w-4xl flex-col rounded-3xl bg-white shadow-2xl overflow-hidden"
            >
              {/* Test Header */}
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-6 py-4 text-white">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                    {activeTest.subject} · Open Test
                  </span>
                  <h3 className="text-sm sm:text-base font-bold truncate max-w-md">
                    {activeTest.title}
                  </h3>
                </div>

                <div className="flex items-center gap-4">
                  {!testFinished && (
                    <div className="flex items-center gap-1.5 rounded-xl bg-red-500/20 border border-red-500/40 px-3 py-1.5 text-xs font-mono font-bold text-red-300">
                      <Clock className="size-4 text-red-400" />
                      <span>{formatTime(timeLeft)}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setActiveTest(null)}
                    className="rounded-full bg-white/10 p-1.5 text-white hover:bg-white/20 transition-colors"
                  >
                    <X className="size-5" />
                  </button>
                </div>
              </div>

              {/* Test Content or Result Screen */}
              {!testFinished ? (
                <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
                  {/* Question Area */}
                  <div className="flex flex-1 flex-col overflow-y-auto p-6">
                    <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-3">
                      <span>
                        Question {currentQIndex + 1} of {totalQuestions}
                      </span>
                      <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        +10 Marks
                      </span>
                    </div>

                    {/* Question text */}
                    <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200/80 mb-5 space-y-1">
                      <p className="text-sm sm:text-base font-bold text-slate-900">
                        {activeTest.questions[currentQIndex]?.question}
                      </p>
                      <p className="text-xs sm:text-sm font-medium text-slate-600">
                        {activeTest.questions[currentQIndex]?.hindiQuestion}
                      </p>
                    </div>

                    {/* Options */}
                    <div className="space-y-3">
                      {activeTest.questions[currentQIndex]?.options.map((opt, idx) => {
                        const isSelected = selectedAnswers[currentQIndex] === idx;
                        const optionLetter = String.fromCharCode(65 + idx);
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSelectOption(idx)}
                            className={`w-full text-left rounded-2xl p-4 transition-all flex items-center gap-3 border ${
                              isSelected
                                ? "border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20 shadow-xs"
                                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                            }`}
                          >
                            <span
                              className={`flex size-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold transition-colors ${
                                isSelected
                                  ? "bg-blue-600 text-white"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {optionLetter}
                            </span>
                            <span className="text-xs sm:text-sm font-semibold text-slate-800">
                              {opt}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Navigation Buttons */}
                    <div className="mt-auto flex items-center justify-between pt-6 border-t border-slate-100">
                      <button
                        type="button"
                        disabled={currentQIndex === 0}
                        onClick={() => setCurrentQIndex((i) => i - 1)}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 disabled:opacity-40"
                      >
                        ← Previous
                      </button>

                      {currentQIndex < totalQuestions - 1 ? (
                        <button
                          type="button"
                          onClick={() => setCurrentQIndex((i) => i + 1)}
                          className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-xs"
                        >
                          Next Question →
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={submitTest}
                          className="rounded-xl bg-red-600 px-6 py-2 text-xs font-bold text-white hover:bg-red-700 shadow-xs"
                        >
                          Submit Test 🎯
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Question Palette Sidebar */}
                  <div className="w-full md:w-64 border-t md:border-t-0 md:border-l border-slate-200 bg-slate-50 p-5 flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                        Question Palette
                      </h4>
                      <div className="grid grid-cols-5 gap-2">
                        {activeTest.questions.map((_, idx) => {
                          const isAnswered = selectedAnswers[idx] !== undefined;
                          const isCurrent = currentQIndex === idx;
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setCurrentQIndex(idx)}
                              className={`flex size-9 items-center justify-center rounded-xl text-xs font-bold transition-all ${
                                isCurrent
                                  ? "ring-2 ring-blue-600 bg-blue-600 text-white shadow-xs"
                                  : isAnswered
                                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                              }`}
                            >
                              {idx + 1}
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-5 space-y-2 text-[11px] text-slate-500 font-medium">
                        <div className="flex items-center gap-2">
                          <span className="size-3 rounded-md bg-emerald-100 border border-emerald-300" />
                          <span>Answered ({answeredCount})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="size-3 rounded-md bg-white border border-slate-300" />
                          <span>Not Answered ({totalQuestions - answeredCount})</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={submitTest}
                      className="mt-6 w-full rounded-xl bg-red-600 py-2.5 text-xs font-bold text-white hover:bg-red-700 transition-colors shadow-xs"
                    >
                      Submit Test ({answeredCount}/{totalQuestions})
                    </button>
                  </div>
                </div>
              ) : (
                /* Result Screen */
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* Score Card */}
                  <div className="rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-800 p-6 text-white text-center shadow-lg">
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-xs mb-2">
                      <Award className="size-4 text-amber-300" />
                      <span>Test Completed Successfully</span>
                    </div>

                    <h3 className="text-3xl sm:text-4xl font-black">
                      {correctCount * 10} / {totalQuestions * 10}
                    </h3>
                    <p className="text-xs text-white/90 mt-1">
                      Accuracy: {scorePercent}% · Correct: {correctCount} of {totalQuestions} Questions
                    </p>

                    <div className="mt-4 flex items-center justify-center gap-4 text-xs font-semibold">
                      <span className="bg-black/20 px-3 py-1 rounded-xl">
                        🏆 State Percentile: {Math.min(99, Math.max(65, scorePercent + 10))}%
                      </span>
                      <span className="bg-black/20 px-3 py-1 rounded-xl">
                        🎖️ Rank: #14 in District
                      </span>
                    </div>
                  </div>

                  {/* Detailed Solutions */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-slate-800">
                      Answer Key & Detailed Explanations
                    </h4>

                    {activeTest.questions.map((q, idx) => {
                      const userChoice = selectedAnswers[idx];
                      const isCorrect = userChoice === q.correct;
                      return (
                        <div
                          key={q.id}
                          className={`rounded-2xl border p-4 text-xs space-y-2 ${
                            isCorrect
                              ? "bg-emerald-50/40 border-emerald-200"
                              : "bg-red-50/30 border-red-200"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-bold text-slate-900">
                              Q{idx + 1}: {q.question}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 font-bold text-[10px] shrink-0 ${
                                isCorrect
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {isCorrect ? "Correct (+10)" : "Incorrect"}
                            </span>
                          </div>

                          <div className="text-slate-600 font-medium">
                            {q.hindiQuestion}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                            {q.options.map((opt, oIdx) => (
                              <div
                                key={oIdx}
                                className={`p-2 rounded-lg font-medium ${
                                  oIdx === q.correct
                                    ? "bg-emerald-600 text-white font-bold"
                                    : oIdx === userChoice
                                      ? "bg-red-200 text-red-900"
                                      : "bg-white border border-slate-200 text-slate-600"
                                }`}
                              >
                                {String.fromCharCode(65 + oIdx)}. {opt}
                              </div>
                            ))}
                          </div>

                          <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-slate-700 mt-2">
                            <strong className="text-blue-700">Explanation: </strong>
                            {q.explanation}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => startTest(activeTest)}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
                    >
                      <RotateCcw className="size-3.5" />
                      Re-attempt Test
                    </button>
                    <Link
                      href="/reports"
                      className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-xs"
                    >
                      View in Performance Report →
                    </Link>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
