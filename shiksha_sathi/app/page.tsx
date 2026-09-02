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
    icon: ClipboardCheck,
    title: "Attendance",
    text: "Simple digital attendance and school records.",
  },
  {
    icon: Brain,
    title: "Question Bank",
    text: "Create Easy, Medium and Hard questions.",
  },
  {
    icon: Sparkles,
    title: "Quiz & Test",
    text: "Generate engaging quizzes and assessments.",
  },
  {
    icon: CalendarDays,
    title: "Lesson Planning",
    text: "Plan chapters, topics and daily teaching.",
  },
];

const studentFeatures = [
  {
    icon: BookOpen,
    title: "Learning Resources",
    text: "Class and subject-wise digital learning material.",
  },
  {
    icon: ClipboardCheck,
    title: "Quizzes",
    text: "Practice concepts through interactive assessments.",
  },
  {
    icon: BarChart3,
    title: "Progress",
    text: "Track learning progress and performance.",
  },
];

export default function HomePage() {
  const [mobileOpen, setMobileOpen] = useState(false);

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
              Empowering Bihar
              <br />
              Through <span>Digital Learning</span>
            </h1>

            <p className="hero-description">
              MEDHA brings teachers, students and schools together through
              a secure and inclusive digital learning platform aligned with
              the educational needs of Bihar.
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

          <div className="teacher-image-wrap">
            <img
              src="/landing/student-hands.jpg"
              alt="Teaching and learning"
            />

            <div className="teacher-floating-card">
              <ClipboardCheck size={18} />
              <div>
                <strong>Teacher Tools</strong>
                <span>Everything in one place</span>
              </div>
            </div>
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

            <div className="teacher-feature-list">

              {teacherFeatures.map((item) => {
                const Icon = item.icon;

                return (
                  <div className="teacher-feature" key={item.title}>
                    <div className="small-feature-icon">
                      <Icon size={17} />
                    </div>

                    <div>
                      <strong>{item.title}</strong>
                      <span>{item.text}</span>
                    </div>
                  </div>
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

            <div className="student-feature-list">

              {studentFeatures.map((item) => {
                const Icon = item.icon;

                return (
                  <div className="student-feature" key={item.title}>
                    <div className="small-feature-icon">
                      <Icon size={17} />
                    </div>

                    <div>
                      <strong>{item.title}</strong>
                      <span>{item.text}</span>
                    </div>
                  </div>
                );
              })}

            </div>

            <Link href="/register" className="outline-link">
              Start Learning
              <ArrowRight size={15} />
            </Link>

          </div>

          <div className="student-visual">

            <div className="student-dashboard">

              <div className="dashboard-top">
                <div>
                  <span>Student Dashboard</span>
                  <strong>My Learning</strong>
                </div>

                <GraduationCap size={21} />
              </div>

              <div className="progress-box">
                <div>
                  <span>Overall Progress</span>
                  <strong>78%</strong>
                </div>

                <div className="progress-bar">
                  <span />
                </div>
              </div>

              <div className="subject-grid">
                <div>
                  <BookOpen size={17} />
                  <span>Mathematics</span>
                  <strong>82%</strong>
                </div>

                <div>
                  <FlaskConical size={17} />
                  <span>Science</span>
                  <strong>74%</strong>
                </div>

                <div>
                  <FileText size={17} />
                  <span>English</span>
                  <strong>79%</strong>
                </div>

                <div>
                  <Brain size={17} />
                  <span>Practice</span>
                  <strong>86%</strong>
                </div>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* =====================================================
          DISTRICT → CLASSROOM
      ===================================================== */}
      <section className="ecosystem-section section-space">

        <div className="site-container">

          <div className="center-heading">
            <div className="section-kicker">CONNECTED ECOSYSTEM</div>

            <h2>
              From District
              <br />
              <span>to every classroom</span>
            </h2>

            <p>
              A connected structure that brings administration and
              learning closer together.
            </p>
          </div>

          <div className="ecosystem-flow">

            <div className="eco-card">
              <Landmark size={22} />
              <strong>District</strong>
              <span>Education oversight</span>
            </div>

            <div className="flow-line" />

            <div className="eco-card">
              <LayoutDashboard size={22} />
              <strong>Block</strong>
              <span>Local coordination</span>
            </div>

            <div className="flow-line" />

            <div className="eco-card">
              <School size={22} />
              <strong>School</strong>
              <span>School management</span>
            </div>

            <div className="flow-line" />

            <div className="eco-card">
              <Users size={22} />
              <strong>Teacher</strong>
              <span>Teaching tools</span>
            </div>

            <div className="flow-line" />

            <div className="eco-card">
              <GraduationCap size={22} />
              <strong>Student</strong>
              <span>Learning journey</span>
            </div>

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