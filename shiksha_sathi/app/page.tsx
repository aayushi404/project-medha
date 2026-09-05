"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronRight,
  GraduationCap,
  Landmark,
  LayoutDashboard,
  Menu,
  MessageCircle,
  School,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  ClipboardCheck,
  CalendarDays,
  FileText,
  BarChart3,
  FlaskConical,
  Clock,
} from "lucide-react";
import { useState } from "react";

const features = [
  {
    icon: GraduationCap,
    title: "For Students",
    text: "Learn from class-wise digital resources, quizzes and progress reports.",
    tone: "blue",
  },
  {
    icon: Users,
    title: "For Teachers",
    text: "Manage attendance, assessments, lesson plans and classroom activities.",
    tone: "green",
  },
  {
    icon: School,
    title: "For Schools",
    text: "Connect principals, teachers and students through one platform.",
    tone: "purple",
  },
  {
    icon: BookOpen,
    title: "e-Content",
    text: "Access books, PDFs, videos, notes and subject-wise learning resources.",
    tone: "orange",
  },
];

const teacherFeatures = [
  {
    id: "attendance",
    icon: ClipboardCheck,
    title: "Attendance",
    text: "Simple digital attendance and school records.",
  },
  {
    id: "questions",
    icon: Brain,
    title: "Question Bank",
    text: "Create Easy, Medium and Hard questions.",
  },
  {
    id: "quiz",
    icon: Sparkles,
    title: "Quiz & Test",
    text: "Generate engaging quizzes and assessments.",
  },
  {
    id: "lesson",
    icon: CalendarDays,
    title: "Lesson Planning",
    text: "Plan chapters, topics and daily teaching.",
  },
];

const studentFeatures = [
  {
    id: "progress",
    icon: BarChart3,
    title: "Progress",
    text: "Track learning progress and performance.",
  },
  {
    id: "resources",
    icon: BookOpen,
    title: "Learning Resources",
    text: "Class and subject-wise digital learning material.",
  },
  {
    id: "quizzes",
    icon: ClipboardCheck,
    title: "Quizzes",
    text: "Practice concepts through interactive assessments.",
  },
];

export default function HomePage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeTeacherTab, setActiveTeacherTab] = useState("attendance");
  const [attendanceStatus, setAttendanceStatus] = useState("present");
  const [attendanceNote, setAttendanceNote] = useState("");
  const [selectedQuestionDiff, setSelectedQuestionDiff] = useState("all");
  const [quizAnswer, setQuizAnswer] = useState("b");
  const [activeLessonStep, setActiveLessonStep] = useState(1);

  // Student interactive states
  const [activeStudentTab, setActiveStudentTab] = useState("progress");
  const [selectedProgressSubject, setSelectedProgressSubject] = useState("math");
  const [studentResourceFilter, setStudentResourceFilter] = useState("all");
  const [studentPracticeAnswer, setStudentPracticeAnswer] = useState<string | null>("b");

  return (
    <main className="medha-page">

      {/* =====================================================
          GOVERNMENT TOP BAR
      ===================================================== */}
      <div className="gov-topbar">
        <div className="site-container gov-topbar-inner">
          <div>भारत सरकार&nbsp;&nbsp; | &nbsp;&nbsp;Government of India</div>

          <div className="gov-tools">
            <span>Skip to Main Content</span>
            <span>|</span>
            <span>Accessibility</span>
          </div>
        </div>
      </div>

      {/* =====================================================
          GOVERNMENT HEADER
      ===================================================== */}
      <header className="main-header">
        <div className="site-container header-inner">

          <div className="department-brand">
            <img
              src="/landing/india-emblem.jpg"
              alt="Government emblem"
              className="india-emblem"
            />

            <div className="department-divider" />

            <div className="department-copy">
              <strong>Department of Education</strong>
              <span>Government of Bihar</span>
              <small>शिक्षा विभाग, बिहार सरकार</small>
            </div>
          </div>

          <div className="bihar-wordmark">
            <strong>BIHAR</strong>
            <span />
            <small>GOVERNMENT OF BIHAR</small>
          </div>

          {/* ONLY ONE MEDHA LOGO ON THE WHOLE LANDING PAGE */}
          <div className="header-medha">
            <img
              src="/Logo.jpeg"
              alt="MEDHA"
            />
          </div>

        </div>
      </header>

      {/* =====================================================
          NAVIGATION
      ===================================================== */}
      <nav className="main-nav">
        <div className="site-container nav-inner">

          <div className="desktop-nav">
            <Link href="/">Home</Link>
            <a href="#about">About MEDHA</a>
            <a href="#resources">Resources</a>
            <a href="#teachers">For Teachers</a>
            <a href="#students">For Students</a>
            <a href="#content">e-Content</a>
            <a href="#support">Help Desk</a>
          </div>

          <div className="nav-actions">
            <button className="language-btn">
              <span>文</span> EN
              <ChevronRight size={13} />
            </button>

            <button className="search-btn" aria-label="Search">
              <Search size={17} />
            </button>

            <Link href="/login" className="login-btn">
              Login
            </Link>

            <Link href="/register" className="register-btn">
              Register
            </Link>

            <button
              className="mobile-menu-btn"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Menu"
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="mobile-menu">
            <a href="#about" onClick={() => setMobileOpen(false)}>About MEDHA</a>
            <a href="#resources" onClick={() => setMobileOpen(false)}>Resources</a>
            <a href="#teachers" onClick={() => setMobileOpen(false)}>For Teachers</a>
            <a href="#students" onClick={() => setMobileOpen(false)}>For Students</a>
            <a href="#content" onClick={() => setMobileOpen(false)}>e-Content</a>
            <a href="#support" onClick={() => setMobileOpen(false)}>Help Desk</a>
          </div>
        )}
      </nav>

      {/* =====================================================
          HERO
          MEDHA LOGO REMOVED FROM HERE
      ===================================================== */}
      <section className="hero-section">

        <div className="hero-heritage-photo" />

        <div className="hero-watermark">e-learning</div>

        <div className="hero-dots hero-dots-left" />
        <div className="hero-dots hero-dots-right" />

        <div className="site-container hero-container">

          <div className="hero-content">

            <div className="hero-kicker">
              <span />
              DIGITAL EDUCATION INITIATIVE OF BIHAR
            </div>

            {/* NO SECOND MEDHA LOGO HERE */}

            <h1>
              Reimagining the way
              <br />
              <span>Bihar learns.</span>
            </h1>

            <p className="hero-description">
              Medha is an AI companion that helps teachers teach better and students learn better — built on a land that has always believed in the power of knowledge.
            </p>

            <div className="hero-buttons">
              <Link href="/register" className="primary-btn">
                Get Started
                <ArrowRight size={17} />
              </Link>

              <a href="#about" className="secondary-btn">
                Explore MEDHA
                <ChevronRight size={16} />
              </a>
            </div>

            <div className="hero-trust">
              <span>
                <ShieldCheck size={16} />
                Secure Platform
              </span>

              <span>
                <GraduationCap size={16} />
                Classes 1–12
              </span>

              <span>
                <Users size={16} />
                Inclusive Learning
              </span>
            </div>

          </div>

          {/* OFFICIAL REPRESENTATIVE VISUAL */}
          <div className="hero-visual">

            <div className="hero-orb orb-one" />
            <div className="hero-orb orb-two" />

            <div className="hero-person">
              <img
                src="/landing/samrat-choudhary.jpg"
                alt="Official representative"
              />
            </div>

          </div>
        </div>
      </section>

      {/* =====================================================
          QUICK STATS
      ===================================================== */}
      <section className="stats-section">
        <div className="site-container stats-grid">

          <div className="stat-item">
            <div className="stat-icon">
              <GraduationCap size={19} />
            </div>
            <div>
              <strong>1–12</strong>
              <span>Classes</span>
            </div>
          </div>

          <div className="stat-item">
            <div className="stat-icon">
              <Landmark size={19} />
            </div>
            <div>
              <strong>38</strong>
              <span>Districts</span>
            </div>
          </div>

          <div className="stat-item">
            <div className="stat-icon">
              <LayoutDashboard size={19} />
            </div>
            <div>
              <strong>24×7</strong>
              <span>Digital Access</span>
            </div>
          </div>

          <div className="stat-item">
            <div className="stat-icon">
              <School size={19} />
            </div>
            <div>
              <strong>1</strong>
              <span>Connected Platform</span>
            </div>
          </div>

        </div>
      </section>

      {/* =====================================================
          ABOUT
      ===================================================== */}
      <section id="about" className="about-section section-space">

        <div className="site-container about-grid">

          <div className="about-image-wrap">
            <img
              src="/landing/classroom.jpg"
              alt="Classroom learning"
              className="about-image"
            />

            <div className="image-label">
              <div className="label-icon">
                <Users size={17} />
              </div>
              <div>
                <strong>Bihar's Education Ecosystem</strong>
                <span>Connected through MEDHA</span>
              </div>
            </div>
          </div>

          <div className="about-copy">

            <div className="section-kicker">ABOUT MEDHA</div>

            <h2>
              One Platform for
              <br />
              <span>Bihar's Education</span>
            </h2>

            <p>
              MEDHA is designed to bring schools, teachers and students
              together through one secure digital platform for learning,
              teaching and academic management.
            </p>

            <p>
              From digital learning resources to assessments, attendance,
              lesson planning and AI-powered assistance, MEDHA brings
              essential educational tools into one connected ecosystem.
            </p>

            <div className="about-points">

              <div>
                <CheckCircle2 size={17} />
                <span>Secure Digital Platform</span>
              </div>

              <div>
                <CheckCircle2 size={17} />
                <span>Teacher & Student Focused</span>
              </div>

              <div>
                <CheckCircle2 size={17} />
                <span>Designed for Bihar</span>
              </div>

              <div>
                <CheckCircle2 size={17} />
                <span>Inclusive Learning</span>
              </div>

            </div>

            <a href="#resources" className="text-link">
              Explore the platform
              <ArrowRight size={15} />
            </a>

          </div>

        </div>
      </section>

      {/* =====================================================
          BIHAR HERITAGE STRIP
      ===================================================== */}
      <section className="heritage-section">

        <div className="heritage-overlay" />

        <div className="site-container heritage-inner">

          <div>
            <div className="section-kicker light">ROOTED IN BIHAR</div>

            <h2>
              Learning with the
              <br />
              <span>Spirit of Bihar</span>
            </h2>

            <p>
              Technology that connects modern learning with Bihar's rich
              educational and cultural heritage.
            </p>
          </div>

          <div className="heritage-cards">

            <div className="heritage-card">
              <img src="/landing/nalanda.jpg" alt="Nalanda heritage" />
              <span>Nalanda</span>
            </div>

            <div className="heritage-card">
              <img src="/landing/buddha-detail.jpg" alt="Bihar heritage" />
              <span>Heritage</span>
            </div>

            <div className="heritage-card">
              <img src="/landing/classroom.jpg" alt="Learning in Bihar" />
              <span>Learning</span>
            </div>

          </div>

        </div>
      </section>

      {/* =====================================================
          EVERYTHING FOR TEACHING
      ===================================================== */}
      <section id="resources" className="resources-section section-space">

        <div className="site-container">

          <div className="center-heading">
            <div className="section-kicker">MEDHA FEATURES</div>

            <h2>
              Everything for
              <br />
              <span>Teaching & Learning</span>
            </h2>

            <p>
              A unified set of digital tools designed around the real needs
              of Bihar's education ecosystem.
            </p>
          </div>

          <div className="feature-grid">

            {features.map((feature) => {
              const Icon = feature.icon;

              return (
                <div
                  className={`feature-card ${feature.tone}`}
                  key={feature.title}
                >
                  <div className="feature-icon">
                    <Icon size={22} />
                  </div>

                  <div className="feature-card-content">
                    <h3>{feature.title}</h3>
                    <p>{feature.text}</p>
                  </div>

                  <ChevronRight size={19} className="feature-arrow" />
                </div>
              );
            })}

          </div>

        </div>
      </section>

      {/* =====================================================
          AI TEACHING ASSISTANT
      ===================================================== */}
      <section id="content" className="ai-section">

        <div className="site-container ai-grid">

          <div className="ai-copy">

            <div className="section-kicker">AI-POWERED SUPPORT</div>

            <h2>
              A Teaching Assistant
              <br />
              <span>when you need one.</span>
            </h2>

            <p>
              MEDHA's AI Teaching Assistant helps teachers and learners
              understand concepts, create activities and connect classroom
              topics with real-life examples.
            </p>

            <div className="ai-points">
              <span>
                <CheckCircle2 size={16} />
                Ask questions naturally
              </span>

              <span>
                <CheckCircle2 size={16} />
                Real-life explanations
              </span>

              <span>
                <CheckCircle2 size={16} />
                Teaching activity ideas
              </span>
            </div>

            <button className="ai-outline-btn">
              Explore AI Assistant
              <ArrowRight size={15} />
            </button>

          </div>

          <div className="ai-chat">

            <div className="chat-header">
              <div className="chat-avatar">
                <Sparkles size={17} />
              </div>

              <div>
                <strong>MEDHA Teaching Assistant</strong>
                <span>AI-powered learning support</span>
              </div>

              <span className="online-dot" />
            </div>

            <div className="chat-body">

              <div className="chat-message student-message">
                Why does rainfall occur?
              </div>

              <div className="chat-message ai-message">
                Rainfall occurs when water vapour in the atmosphere
                cools and condenses into water droplets.
                <br /><br />
                <strong>Real-life example:</strong> Think about water
                droplets forming on the outside of a cold glass.
              </div>

            </div>

            <div className="chat-input">
              <span>Ask MEDHA anything...</span>
              <button>
                <ArrowRight size={15} />
              </button>
            </div>

          </div>

        </div>
      </section>

      {/* =====================================================
          TEACHERS
      ===================================================== */}
      <section id="teachers" className="teacher-section section-space">

        <div className="site-container teacher-grid">

          {/* INTERACTIVE TEACHER MOCKUP PREVIEW */}
          <div className="teacher-mockup-container">
            {activeTeacherTab === "attendance" && (
              <div className="teacher-mockup-wrapper">
                <div className="mockup-header-row">
                  <div className="mockup-header-left">
                    <span className="mockup-chip">Current Class</span>
                    <div className="mockup-title-flex">
                      <div className="mockup-class-icon orange-icon">
                        <School size={20} />
                      </div>
                      <div>
                        <h4 className="mockup-class-title">Database Management Systems</h4>
                        <p className="mockup-class-subtitle">Prof. Neha Gupta</p>
                        <div className="mockup-meta-tags">
                          <span><Clock size={12} /> 11:30 AM - 12:30 PM</span>
                          <span><Landmark size={12} /> Room 301, Block A</span>
                          <span><FileText size={12} /> CS302</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status alert banner */}
                <div className="mockup-alert-banner">
                  <div className="alert-banner-left">
                    <div className="alert-info-icon">i</div>
                    <div>
                      <strong>Attendance marking is open for this class</strong>
                      <small>Mark your attendance before 11:45 AM</small>
                    </div>
                  </div>
                  <div className="alert-timer-box">
                    <span>Time Remaining</span>
                    <strong>15:24</strong>
                  </div>
                </div>

                {/* Status selector */}
                <div className="mockup-status-section">
                  <div className="status-section-header">
                    <h5>Select Your Status</h5>
                    <p>Please select your attendance status for this class</p>
                  </div>

                  <div className="status-cards-row">
                    {/* Present */}
                    <button
                      type="button"
                      onClick={() => setAttendanceStatus("present")}
                      className={`status-btn-card present-card ${attendanceStatus === "present" ? "selected" : ""}`}
                    >
                      <div className="status-radio-dot">
                        {attendanceStatus === "present" && <span />}
                      </div>
                      <div className="status-icon-circle green-circle">
                        <CheckCircle2 size={24} />
                      </div>
                      <strong>Present</strong>
                      <small>I am present in the class</small>
                    </button>

                    {/* Absent */}
                    <button
                      type="button"
                      onClick={() => setAttendanceStatus("absent")}
                      className={`status-btn-card absent-card ${attendanceStatus === "absent" ? "selected" : ""}`}
                    >
                      <div className="status-radio-dot">
                        {attendanceStatus === "absent" && <span />}
                      </div>
                      <div className="status-icon-circle red-circle">
                        <X size={24} />
                      </div>
                      <strong>Absent</strong>
                      <small>I am absent from the class</small>
                    </button>

                    {/* Late */}
                    <button
                      type="button"
                      onClick={() => setAttendanceStatus("late")}
                      className={`status-btn-card late-card ${attendanceStatus === "late" ? "selected" : ""}`}
                    >
                      <div className="status-radio-dot">
                        {attendanceStatus === "late" && <span />}
                      </div>
                      <div className="status-icon-circle orange-circle">
                        <Clock size={24} />
                      </div>
                      <strong>Late</strong>
                      <small>I am late to the class</small>
                    </button>
                  </div>
                </div>

                {/* Add Note */}
                <div className="mockup-note-section">
                  <label>Add Note (Optional)</label>
                  <input
                    type="text"
                    placeholder="Add a note if needed..."
                    value={attendanceNote}
                    onChange={(e) => setAttendanceNote(e.target.value.slice(0, 200))}
                  />
                  <span className="note-char-count">{attendanceNote.length}/200</span>
                </div>
              </div>
            )}

            {activeTeacherTab === "questions" && (
              <div className="teacher-mockup-wrapper">
                <div className="mockup-header-row">
                  <div className="mockup-header-left">
                    <span className="mockup-chip chip-purple">AI Question Bank Generator</span>
                    <div className="mockup-title-flex">
                      <div className="mockup-class-icon purple-icon">
                        <Brain size={20} />
                      </div>
                      <div>
                        <h4 className="mockup-class-title">Class 8 Science — Force & Pressure</h4>
                        <p className="mockup-class-subtitle">BSEB / NCERT Aligned • 24 Questions Generated</p>
                        <div className="mockup-meta-tags">
                          <span><BookOpen size={12} /> Chapter 11</span>
                          <span><Sparkles size={12} /> Auto-graded</span>
                          <span><FileText size={12} /> Bilingual (Hindi/Eng)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Filter Pills */}
                <div className="qb-filters-row">
                  <button
                    type="button"
                    onClick={() => setSelectedQuestionDiff("all")}
                    className={`qb-filter-pill ${selectedQuestionDiff === "all" ? "active" : ""}`}
                  >
                    All Questions (24)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedQuestionDiff("easy")}
                    className={`qb-filter-pill ${selectedQuestionDiff === "easy" ? "active" : ""}`}
                  >
                    Easy (8)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedQuestionDiff("medium")}
                    className={`qb-filter-pill ${selectedQuestionDiff === "medium" ? "active" : ""}`}
                  >
                    Medium (10)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedQuestionDiff("hard")}
                    className={`qb-filter-pill ${selectedQuestionDiff === "hard" ? "active" : ""}`}
                  >
                    Hard (6)
                  </button>
                </div>

                {/* Question List Cards */}
                <div className="qb-questions-list">
                  {(selectedQuestionDiff === "all" || selectedQuestionDiff === "easy") && (
                    <div className="qb-question-card">
                      <div className="qb-q-header">
                        <span className="badge-easy">Easy • MCQ • 1 Mark</span>
                        <span className="qb-action-add">+ Add to Test</span>
                      </div>
                      <p className="qb-q-text">1. What is the force acting per unit area called?</p>
                      <div className="qb-options-grid">
                        <span className="qb-opt">A. Gravity</span>
                        <span className="qb-opt qb-opt-correct">B. Pressure (Pa) ✓</span>
                        <span className="qb-opt">C. Friction</span>
                        <span className="qb-opt">D. Acceleration</span>
                      </div>
                    </div>
                  )}

                  {(selectedQuestionDiff === "all" || selectedQuestionDiff === "medium") && (
                    <div className="qb-question-card">
                      <div className="qb-q-header">
                        <span className="badge-medium">Medium • Conceptual • 2 Marks</span>
                        <span className="qb-action-add">+ Add to Test</span>
                      </div>
                      <p className="qb-q-text">2. Why do sharp knives cut vegetables much more easily than blunt knives?</p>
                      <p className="qb-answer-hint">
                        <strong>Model Answer:</strong> Smaller contact area increases pressure for the same applied force (Pressure = Force / Area).
                      </p>
                    </div>
                  )}

                  {(selectedQuestionDiff === "all" || selectedQuestionDiff === "hard") && (
                    <div className="qb-question-card">
                      <div className="qb-q-header">
                        <span className="badge-hard">Hard • Application • 3 Marks</span>
                        <span className="qb-action-add">+ Add to Test</span>
                      </div>
                      <p className="qb-q-text">3. Why do heavy transport trucks have 6 to 8 tyres instead of 4?</p>
                      <p className="qb-answer-hint">
                        <strong>Explanation:</strong> Larger surface area reduces the pressure exerted on the road, preventing tyre sinkage in soil.
                      </p>
                    </div>
                  )}
                </div>

                <div className="qb-footer-bar">
                  <span>24 Questions ready for printable worksheet or test</span>
                  <button type="button" className="qb-export-btn">
                    <FileText size={13} /> Export Worksheet (PDF)
                  </button>
                </div>
              </div>
            )}

            {activeTeacherTab === "quiz" && (
              <div className="teacher-mockup-wrapper">
                <div className="mockup-header-row">
                  <div className="mockup-header-left">
                    <span className="mockup-chip chip-cyan">Live Interactive Assessment</span>
                    <div className="mockup-title-flex">
                      <div className="mockup-class-icon cyan-icon">
                        <Sparkles size={20} />
                      </div>
                      <div>
                        <h4 className="mockup-class-title">Class 8 Science Diagnostic Quiz</h4>
                        <p className="mockup-class-subtitle">Chapter 2: Microorganisms • 38 Students Online</p>
                        <div className="mockup-meta-tags">
                          <span><Clock size={12} /> 15 Mins</span>
                          <span><BarChart3 size={12} /> 10 Questions</span>
                          <span><ShieldCheck size={12} /> Auto-scored</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="quiz-timer-pill">
                    <span>Time Left</span>
                    <strong>12:45</strong>
                  </div>
                </div>

                <div className="quiz-progress-wrap">
                  <div className="quiz-progress-text">
                    <span>Question 4 of 10</span>
                    <span>40% Completed</span>
                  </div>
                  <div className="quiz-progress-track">
                    <div className="quiz-progress-fill" style={{ width: "40%" }} />
                  </div>
                </div>

                <div className="quiz-question-box">
                  <h5>Q4. Which microorganism is responsible for converting milk into curd?</h5>

                  <div className="quiz-options-list">
                    {[
                      { id: "a", label: "A. Amoeba", correct: false },
                      { id: "b", label: "B. Lactobacillus bacteria", correct: true },
                      { id: "c", label: "C. Yeast", correct: false },
                      { id: "d", label: "D. Penicillium", correct: false },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setQuizAnswer(opt.id)}
                        className={`quiz-opt-btn ${quizAnswer === opt.id ? (opt.correct ? "selected-correct" : "selected-wrong") : ""}`}
                      >
                        <span className="opt-indicator">{opt.id.toUpperCase()}</span>
                        <span>{opt.label.slice(3)}</span>
                        {quizAnswer === opt.id && opt.correct && (
                          <span className="opt-check-badge">Correct ✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="quiz-stats-footer">
                  <div className="quiz-mini-stat">
                    <span>Class Avg</span>
                    <strong>84%</strong>
                  </div>
                  <div className="quiz-mini-stat">
                    <span>Submitted</span>
                    <strong>34/38</strong>
                  </div>
                  <div className="quiz-mini-stat">
                    <span>Top Score</span>
                    <strong>10/10</strong>
                  </div>
                  <button type="button" className="quiz-next-btn">
                    Next Question →
                  </button>
                </div>
              </div>
            )}

            {activeTeacherTab === "lesson" && (
              <div className="teacher-mockup-wrapper">
                <div className="mockup-header-row">
                  <div className="mockup-header-left">
                    <span className="mockup-chip chip-green">45-Minute Lesson Kit</span>
                    <div className="mockup-title-flex">
                      <div className="mockup-class-icon green-icon">
                        <CalendarDays size={20} />
                      </div>
                      <div>
                        <h4 className="mockup-class-title">Photosynthesis & Plant Nutrition</h4>
                        <p className="mockup-class-subtitle">Class 7 Science • BSEB Syllabus • Period 2</p>
                        <div className="mockup-meta-tags">
                          <span><Clock size={12} /> 45 Mins</span>
                          <span><Users size={12} /> 40+ Students</span>
                          <span><FlaskConical size={12} /> Zero-Cost Classroom Activity</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="lesson-timeline-list">
                  {[
                    {
                      step: 1,
                      time: "00:00 - 00:05",
                      title: "Engaging Hook & Village Story",
                      desc: "Story of a mango orchard in Bihar: 'How do leaves cook food without gas, stove or wood?'",
                      badge: "Storytelling",
                    },
                    {
                      step: 2,
                      time: "00:05 - 00:22",
                      title: "Core Concept & Blackboard Diagram",
                      desc: "Sunlight + Chlorophyll + CO2 + Water → Glucose + Oxygen formula simplified for Class 7.",
                      badge: "Blackboard",
                    },
                    {
                      step: 3,
                      time: "00:22 - 00:37",
                      title: "Low-Tech Group Roleplay Activity",
                      desc: "Roleplay: 4 student groups act as Sun, Root, Leaf, and Raindrop passing 'energy tokens'.",
                      badge: "Activity",
                    },
                    {
                      step: 4,
                      time: "00:37 - 00:45",
                      title: "Quick Exit Ticket & Homework",
                      desc: "Ask 3 check-for-understanding questions and assign sunset leaf observation.",
                      badge: "Assessment",
                    },
                  ].map((item) => (
                    <div
                      key={item.step}
                      onClick={() => setActiveLessonStep(item.step)}
                      className={`lesson-step-card ${activeLessonStep === item.step ? "active" : ""}`}
                    >
                      <div className="lesson-time-pill">{item.time}</div>
                      <div className="lesson-step-content">
                        <div className="lesson-step-header">
                          <strong>{item.title}</strong>
                          <span className="lesson-badge">{item.badge}</span>
                        </div>
                        <p>{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="lesson-footer-bar">
                  <span>Ready-to-teach kit generated in 3 seconds</span>
                  <button type="button" className="lesson-download-btn">
                    <FileText size={13} /> Download Lesson Plan (.PDF)
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="teacher-copy">

            <div className="section-kicker">FOR TEACHERS</div>

            <h2>
              Tools that make
              <br />
              <span>teaching simpler</span>
            </h2>

            <p>
              Spend less time managing routine academic tasks and more
              time focusing on teaching and students.
            </p>

            <div className="teacher-feature-vertical-list">

              {teacherFeatures.map((item) => {
                const Icon = item.icon;
                const isActive = activeTeacherTab === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTeacherTab(item.id)}
                    className={`teacher-tab-button ${isActive ? "active" : ""}`}
                  >
                    <div className={`tab-icon-box ${isActive ? "active-icon" : ""}`}>
                      <Icon size={18} />
                    </div>

                    <div className="tab-copy">
                      <strong>{item.title}</strong>
                      <span>{item.text}</span>
                    </div>
                  </button>
                );
              })}

            </div>

            <Link href="/login" className="outline-link">
              Teacher Login
              <ArrowRight size={15} />
            </Link>

          </div>

        </div>
      </section>

      {/* =====================================================
          STUDENTS
      ===================================================== */}
      <section id="students" className="student-section section-space">

        <div className="site-container student-grid">

          <div className="student-copy">

            <div className="section-kicker">FOR STUDENTS</div>

            <h2>
              Learn, practise,
              <br />
              <span>progress.</span>
            </h2>

            <p>
              Students can access structured learning material,
              practice through quizzes and understand their progress
              through simple reports.
            </p>

            <div className="student-feature-vertical-list">
              {studentFeatures.map((item) => {
                const Icon = item.icon;
                const isActive = activeStudentTab === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveStudentTab(item.id)}
                    className={`student-tab-button ${isActive ? "active" : ""}`}
                  >
                    <div className={`student-tab-icon-box ${isActive ? "active-icon" : ""}`}>
                      <Icon size={18} />
                    </div>

                    <div className="student-tab-copy">
                      <strong>{item.title}</strong>
                      <span>{item.text}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <Link href="/register" className="outline-link">
              Start Learning
              <ArrowRight size={15} />
            </Link>

          </div>

          <div className="student-visual">

            {/* VIEW 1: PROGRESS DASHBOARD */}
            {activeStudentTab === "progress" && (
              <div className="student-dashboard">
                <div className="dashboard-top">
                  <div>
                    <span className="student-dash-tag">Student Dashboard</span>
                    <strong>My Learning Performance</strong>
                  </div>
                  <div className="dash-avatar-badge">
                    <GraduationCap size={21} />
                  </div>
                </div>

                <div className="progress-box">
                  <div className="progress-label-row">
                    <span>Overall Syllabus Progress</span>
                    <strong>78%</strong>
                  </div>

                  <div className="progress-bar">
                    <span style={{ width: "78%" }} />
                  </div>
                  <div className="progress-stats-mini">
                    <small>18/22 Chapters Mastered</small>
                    <small>Class Rank: 4th in Class 8-B</small>
                  </div>
                </div>

                <div className="subject-grid">
                  <div
                    onClick={() => setSelectedProgressSubject("math")}
                    className={`subject-card-interactive ${selectedProgressSubject === "math" ? "active" : ""}`}
                  >
                    <BookOpen size={17} />
                    <span>Mathematics</span>
                    <strong>82%</strong>
                  </div>

                  <div
                    onClick={() => setSelectedProgressSubject("sci")}
                    className={`subject-card-interactive ${selectedProgressSubject === "sci" ? "active" : ""}`}
                  >
                    <FlaskConical size={17} />
                    <span>Science</span>
                    <strong>74%</strong>
                  </div>

                  <div
                    onClick={() => setSelectedProgressSubject("eng")}
                    className={`subject-card-interactive ${selectedProgressSubject === "eng" ? "active" : ""}`}
                  >
                    <FileText size={17} />
                    <span>English</span>
                    <strong>79%</strong>
                  </div>

                  <div
                    onClick={() => setSelectedProgressSubject("prac")}
                    className={`subject-card-interactive ${selectedProgressSubject === "prac" ? "active" : ""}`}
                  >
                    <Brain size={17} />
                    <span>Practice</span>
                    <strong>86%</strong>
                  </div>
                </div>

                {/* Subject Details Box */}
                <div className="student-subject-detail-box">
                  {selectedProgressSubject === "math" && (
                    <div className="subject-detail-content">
                      <div className="subject-detail-badge">Mathematics Performance</div>
                      <p><strong>Next Focus:</strong> Chapter 9 — Algebraic Expressions & Identities</p>
                      <small>Completed 8 out of 10 quizzes with 85%+ score</small>
                    </div>
                  )}
                  {selectedProgressSubject === "sci" && (
                    <div className="subject-detail-content">
                      <div className="subject-detail-badge">Science Performance</div>
                      <p><strong>Next Focus:</strong> Chapter 6 — Combustion and Flame</p>
                      <small>Completed 12 interactive exercises and lab assessments</small>
                    </div>
                  )}
                  {selectedProgressSubject === "eng" && (
                    <div className="subject-detail-content">
                      <div className="subject-detail-badge">English Performance</div>
                      <p><strong>Next Focus:</strong> Honeycomb — A Gift of Chappals</p>
                      <small>Vocabulary mastery: 140 new words learned this month</small>
                    </div>
                  )}
                  {selectedProgressSubject === "prac" && (
                    <div className="subject-detail-content">
                      <div className="subject-detail-badge">Daily Practice Streak</div>
                      <p><strong>Streak Status:</strong> 🔥 5-Day Continuous Practice</p>
                      <small>420 practice questions solved with 86% accuracy</small>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* VIEW 2: LEARNING RESOURCES (E-CONTENT) */}
            {activeStudentTab === "resources" && (
              <div className="student-dashboard">
                <div className="dashboard-top">
                  <div>
                    <span className="student-dash-tag">Digital Library</span>
                    <strong>BSEB & NCERT Textbooks</strong>
                  </div>
                  <div className="dash-avatar-badge">
                    <BookOpen size={21} />
                  </div>
                </div>

                {/* Subject filters */}
                <div className="qb-filters-row">
                  {[
                    { id: "all", label: "All Subjects" },
                    { id: "sci", label: "Science (विज्ञान)" },
                    { id: "math", label: "Math (गणित)" },
                    { id: "sst", label: "Social Science" },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setStudentResourceFilter(s.id)}
                      className={`qb-filter-pill ${studentResourceFilter === s.id ? "active" : ""}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                {/* Chapters List */}
                <div className="student-resources-list">
                  {(studentResourceFilter === "all" || studentResourceFilter === "sci") && (
                    <div className="student-resource-card">
                      <div className="resource-card-header">
                        <span className="resource-subject-badge">Class 8 Science</span>
                        <span className="resource-offline-pill">Offline Ready ✓</span>
                      </div>
                      <strong>अध्याय 4: धातु और अधातु (Metals & Non-metals)</strong>
                      <p>NCERT Bihar State Textbook with Hindi-Bihari audio notes.</p>
                      <div className="resource-card-actions">
                        <button type="button" className="res-btn-primary">
                          <FileText size={12} /> Read PDF Book
                        </button>
                        <button type="button" className="res-btn-secondary">
                          <Brain size={12} /> Concept Notes
                        </button>
                      </div>
                    </div>
                  )}

                  {(studentResourceFilter === "all" || studentResourceFilter === "math") && (
                    <div className="student-resource-card">
                      <div className="resource-card-header">
                        <span className="resource-subject-badge badge-orange">Class 8 Math</span>
                        <span className="resource-offline-pill">Offline Ready ✓</span>
                      </div>
                      <strong>अध्याय 2: एक चर वाले रैखिक समीकरण (Linear Equations)</strong>
                      <p>Step-by-step solved examples and daily practice worksheets.</p>
                      <div className="resource-card-actions">
                        <button type="button" className="res-btn-primary">
                          <FileText size={12} /> Read PDF Book
                        </button>
                        <button type="button" className="res-btn-secondary">
                          <Sparkles size={12} /> Solved Examples
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="student-resource-footer">
                  <small>✓ Free access for all Bihar Government school students</small>
                </div>
              </div>
            )}

            {/* VIEW 3: PRACTICE QUIZZES */}
            {activeStudentTab === "quizzes" && (
              <div className="student-dashboard">
                <div className="dashboard-top">
                  <div>
                    <span className="student-dash-tag">Daily Concept Quiz</span>
                    <strong>Class 8 Science Practice</strong>
                  </div>
                  <div className="streak-badge-pill">
                    <span>🔥 5 Day Streak</span>
                  </div>
                </div>

                <div className="student-quiz-card">
                  <div className="student-quiz-header">
                    <span className="quiz-q-num">Question 2 of 5</span>
                    <span className="quiz-score-badge">+10 Points</span>
                  </div>

                  <h5 className="student-quiz-title">
                    बिहार में वर्षा ऋतु (Monsoon) के दौरान उगाई जाने वाली खरीफ फसल (Kharif Crop) कौन सी है?
                  </h5>

                  <div className="student-quiz-options">
                    {[
                      { id: "a", label: "A. गेहूं (Wheat)", isCorrect: false },
                      { id: "b", label: "B. धान / चावल (Paddy / Rice)", isCorrect: true },
                      { id: "c", label: "C. चना (Gram)", isCorrect: false },
                      { id: "d", label: "D. सरसों (Mustard)", isCorrect: false },
                    ].map((opt) => {
                      const isSelected = studentPracticeAnswer === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setStudentPracticeAnswer(opt.id)}
                          className={`student-opt-button ${
                            isSelected
                              ? opt.isCorrect
                                ? "correct"
                                : "wrong"
                              : ""
                          }`}
                        >
                          <span className="opt-circle">{opt.id.toUpperCase()}</span>
                          <span>{opt.label}</span>
                          {isSelected && opt.isCorrect && (
                            <span className="correct-check">✓ सही उत्तर!</span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {studentPracticeAnswer === "b" && (
                    <div className="quiz-feedback-box">
                      <strong>शाबाश! (Excellent)</strong>
                      <p>धान (Paddy) को बहुत अधिक पानी की आवश्यकता होती है, इसलिए यह खरीफ मौसम (जून-सितंबर) में बोई जाती है।</p>
                    </div>
                  )}

                  {studentPracticeAnswer && studentPracticeAnswer !== "b" && (
                    <div className="quiz-feedback-box wrong-box">
                      <strong>पुनः प्रयास करें (Try Again)</strong>
                      <p>गेहूं, चना और सरसों रबी (Rabi) की फसलें हैं जो सर्दियों में उगाई जाती हैं।</p>
                    </div>
                  )}
                </div>

                <div className="student-quiz-footer">
                  <span>Score: <strong>1/1 Correct</strong></span>
                  <button
                    type="button"
                    onClick={() => setStudentPracticeAnswer(null)}
                    className="res-btn-primary"
                  >
                    Next Question →
                  </button>
                </div>
              </div>
            )}

          </div>

        </div>
      </section>

      {/* =====================================================
          CTA
      ===================================================== */}
      <section id="support" className="cta-section">

        <div className="site-container cta-inner">

          <div>
            <div className="section-kicker light">MEDHA SUPPORT</div>

            <h2>
              Ready to be part of
              <br />
              Bihar's digital education journey?
            </h2>

            <p>
              Join MEDHA and bring better digital learning tools
              closer to every classroom.
            </p>
          </div>

          <div className="cta-actions">
            <Link href="/register" className="cta-orange">
              Register Now
              <ArrowRight size={15} />
            </Link>

            <Link href="/login" className="cta-outline">
              Login to MEDHA
            </Link>
          </div>

        </div>
      </section>

      {/* =====================================================
          FOOTER
      ===================================================== */}
      <footer className="footer">

        <div className="site-container footer-grid">

          <div className="footer-about">

            {/* No large MEDHA logo repetition */}
            <div className="footer-mark">M</div>

            <p>
              A digital education platform connecting Bihar's schools,
              teachers and students.
            </p>

            <span>© 2026 MEDHA. All rights reserved.</span>

          </div>

          <div>
            <h4>Platform</h4>
            <a href="#about">About MEDHA</a>
            <a href="#resources">Resources</a>
            <a href="#content">e-Content</a>
          </div>

          <div>
            <h4>Learning</h4>
            <a href="#teachers">For Teachers</a>
            <a href="#students">For Students</a>
            <a href="#support">Help Desk</a>
          </div>

          <div>
            <h4>Experience</h4>
            <span>Secure digital platform</span>
            <span>Inclusive learning</span>
            <span>Designed for Bihar</span>
          </div>

        </div>

      </footer>

    </main>
  );
}
