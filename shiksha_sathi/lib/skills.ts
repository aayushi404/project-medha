/**
 * Skills Hub catalogue -- frontend-only, mirrors `lib/coding.ts` (itself
 * modeled on `lib/tools.ts` / `lib/simulations.ts`). A second, independent
 * "mentored courses" section: business & creative add-on skills rather than
 * programming. Same shape, same conventions, deliberately not shared code
 * with lib/coding.ts -- consistent with how tools/simulations/coding already
 * coexist as separate catalogs in this codebase.
 */
import { Megaphone, type LucideIcon, PenTool, Rocket } from "lucide-react";

export type SkillLevel = "beginner" | "intermediate" | "advanced";
export type SkillAccent = "terracotta" | "gold" | "earth";

export const SKILL_LEVEL_LABEL: Record<SkillLevel, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

/** Fully-literal Tailwind classes per accent -- never template a class name
 *  from this key (e.g. `bg-${accent}/10`), or the JIT scanner won't see it. */
export const SKILL_ACCENT_STYLES: Record<
  SkillAccent,
  { icon: string; chip: string; bar: string; ring: string; gradient: string }
> = {
  terracotta: {
    icon: "bg-terracotta/10 text-terracotta",
    chip: "bg-terracotta/10 text-terracotta",
    bar: "bg-terracotta",
    ring: "ring-terracotta/15",
    gradient: "from-terracotta/10 via-transparent to-transparent",
  },
  gold: {
    icon: "bg-gold/15 text-earth",
    chip: "bg-gold/15 text-earth",
    bar: "bg-gold",
    ring: "ring-gold/20",
    gradient: "from-gold/15 via-transparent to-transparent",
  },
  earth: {
    icon: "bg-earth/10 text-earth",
    chip: "bg-earth/10 text-earth",
    bar: "bg-earth",
    ring: "ring-earth/15",
    gradient: "from-earth/10 via-transparent to-transparent",
  },
};

export type SkillModule = {
  title: string;
  summary: string;
  minutes: number;
  /** 2-3 concrete things the student can do after this module. */
  outcomes: string[];
};

export type SkillCourse = {
  slug: string;
  title: string;
  tagline: string;
  blurb: string;
  level: SkillLevel;
  icon: LucideIcon;
  accent: SkillAccent;
  /** Promo poster, shown as the course card's banner and on its detail page. */
  poster: string;
  modules: SkillModule[];
};

export type SkillTutor = {
  slug: string;
  name: string;
  role: string;
  courseSlug: string;
  bio: string;
  specialties: string[];
  /** Cropped headshot from the course poster. */
  photo: string;
  credential: string;
  accent: SkillAccent;
};

export const SKILL_COURSES: SkillCourse[] = [
  {
    slug: "entrepreneurship",
    title: "Entrepreneurship",
    tagline: "Turn ideas into real opportunities",
    blurb:
      "Learn how entrepreneurs think -- spotting real problems, shaping an idea into a simple business model, and pitching it with confidence.",
    level: "beginner",
    icon: Rocket,
    accent: "gold",
    poster: "/poster-entrepreneurship.jpeg",
    modules: [
      {
        title: "Entrepreneurial Mindset",
        summary: "Learn how entrepreneurs spot problems and think in opportunities, not obstacles.",
        minutes: 20,
        outcomes: ["Describe what an entrepreneurial mindset looks like", "Reframe a complaint as a problem worth solving"],
      },
      {
        title: "Finding Real-World Problems",
        summary: "Practice spotting problems and opportunities in your own community.",
        minutes: 25,
        outcomes: ["List real problems worth solving nearby", "Turn an observation into a clear problem statement"],
      },
      {
        title: "Idea Generation & Business Models",
        summary: "Turn a problem into an idea, and sketch a simple business model around it.",
        minutes: 30,
        outcomes: ["Brainstorm multiple solutions to one problem", "Sketch a one-page business model"],
      },
      {
        title: "Finance & Resource Basics",
        summary: "Get comfortable with budgeting and managing resources at a beginner level.",
        minutes: 25,
        outcomes: ["Estimate a simple budget for an idea", "Explain the difference between cost and price"],
      },
      {
        title: "Branding & Customer Understanding",
        summary: "Learn how to think about customers, and what makes a brand memorable.",
        minutes: 25,
        outcomes: ["Describe your idea's target customer", "Name what makes a brand memorable"],
      },
      {
        title: "Pitch, Feedback & Iteration",
        summary: "Build and present a simple business idea, then improve it with feedback.",
        minutes: 30,
        outcomes: ["Present a business idea in under two minutes", "Use feedback to improve an idea"],
      },
    ],
  },
  {
    slug: "digital-marketing",
    title: "Digital Marketing",
    tagline: "Build, promote, and grow ideas online",
    blurb:
      "Practical digital skills for the online world -- social content, SEO basics, digital ads, and how to read simple performance data.",
    level: "beginner",
    icon: Megaphone,
    accent: "terracotta",
    poster: "/poster-digital-marketing.jpeg",
    modules: [
      {
        title: "Digital Marketing Fundamentals",
        summary: "Understand what digital marketing is and the main channels it works through.",
        minutes: 20,
        outcomes: ["Explain the main digital marketing channels", "Identify who a target audience is"],
      },
      {
        title: "Social Media Content",
        summary: "Create and manage content that fits how each social platform actually works.",
        minutes: 25,
        outcomes: ["Plan a simple content calendar", "Write a caption that fits a platform's tone"],
      },
      {
        title: "SEO & Online Visibility",
        summary: "Learn how people and search engines actually find content online.",
        minutes: 25,
        outcomes: ["Explain what a keyword is and why it matters", "Spot a few SEO basics on a webpage"],
      },
      {
        title: "Content Marketing & Branding",
        summary: "See how consistent content builds a brand people recognize.",
        minutes: 25,
        outcomes: ["Describe what makes a brand voice consistent", "Draft a short, brand-aligned post"],
      },
      {
        title: "Digital Advertising & Audience Targeting",
        summary: "Explore how ads reach the right people instead of everyone.",
        minutes: 25,
        outcomes: ["Explain audience targeting in simple terms", "Identify the target audience of a real ad"],
      },
      {
        title: "Marketing Data & Your Own Campaign",
        summary: "Read basic performance data, then plan a promotion for a real idea.",
        minutes: 30,
        outcomes: ["Read simple metrics like reach and clicks", "Put together a mini promotion plan for a project"],
      },
    ],
  },
  {
    slug: "graphic-design",
    title: "Graphic Design",
    tagline: "Communicate ideas through visuals",
    blurb:
      "Develop creative, practical design skills -- typography, colour, branding, and basic photo editing -- and build a first portfolio piece.",
    level: "beginner",
    icon: PenTool,
    accent: "earth",
    poster: "/poster-graphic-design.jpeg",
    modules: [
      {
        title: "Design Fundamentals",
        summary: "Understand the basics of visual communication and what makes a design work.",
        minutes: 20,
        outcomes: ["Explain what makes a design \"work\" visually", "Tell a clean layout apart from a cluttered one"],
      },
      {
        title: "Typography, Colour & Composition",
        summary: "Learn the building blocks that show up in every design.",
        minutes: 25,
        outcomes: ["Pair fonts that work well together", "Apply basic colour theory to a design"],
      },
      {
        title: "Poster & Social Media Design",
        summary: "Design real, shareable visuals with a clear focal point.",
        minutes: 30,
        outcomes: ["Lay out a poster with a clear focal point", "Resize one design for different social platforms"],
      },
      {
        title: "Branding, Logos & Visual Identity",
        summary: "See how a consistent visual identity is built from a few simple pieces.",
        minutes: 25,
        outcomes: ["Sketch a simple logo concept", "Describe the parts of a visual identity"],
      },
      {
        title: "Photo Editing & Creative Tools",
        summary: "Get hands-on with basic photo editing and creative tools.",
        minutes: 25,
        outcomes: ["Crop, adjust, and export an image", "Combine images and text in one design"],
      },
      {
        title: "Design Thinking & Your Portfolio",
        summary: "Work through a real design brief and build a first portfolio piece.",
        minutes: 30,
        outcomes: ["Work through a design brief for a real project or event", "Put together a first portfolio piece"],
      },
    ],
  },
];

export const SKILL_TUTORS: SkillTutor[] = [
  {
    slug: "mannu-yadav-entrepreneurship",
    name: "Mannu Yadav",
    role: "Entrepreneurship Tutor",
    courseSlug: "entrepreneurship",
    bio: "Helps students turn a vague idea into a real, pitchable plan -- practical about problems, budgets, and what actually gets built.",
    specialties: ["Idea generation", "Business models", "Pitching"],
    photo: "/mentors/mannu-yadav.jpg",
    credential: "IIT Madras",
    accent: "gold",
  },
  {
    slug: "aditya-prabhakar",
    name: "Aditya Prabhakar",
    role: "Entrepreneurship Tutor",
    courseSlug: "entrepreneurship",
    bio: "Focuses on resourcefulness -- budgeting, customer understanding, and learning fast from feedback and failure.",
    specialties: ["Finance basics", "Customer understanding", "Iteration"],
    photo: "/mentors/aditya-prabhakar.jpg",
    credential: "IIT Madras",
    accent: "gold",
  },
  {
    slug: "amarjit-singh",
    name: "Amarjit Singh",
    role: "Digital Marketing Tutor",
    courseSlug: "digital-marketing",
    bio: "Breaks digital marketing into practical, hands-on skills -- from writing a good social post to reading what the numbers actually mean.",
    specialties: ["Social media", "SEO basics", "Content marketing"],
    photo: "/mentors/amarjit-singh.jpg",
    credential: "IIT Madras",
    accent: "terracotta",
  },
  {
    slug: "vidhan-chandra-marketing",
    name: "Vidhan Chandra",
    role: "Digital Marketing Tutor",
    courseSlug: "digital-marketing",
    bio: "Focuses on turning a real project or idea into a small promotion plan, from audience targeting to basic performance data.",
    specialties: ["Digital advertising", "Audience targeting", "Campaign planning"],
    photo: "/mentors/vidhan-chandra.jpg",
    credential: "IIT Madras",
    accent: "terracotta",
  },
  {
    slug: "nivash-kumar",
    name: "Nivash Kumar",
    role: "Graphic Design Tutor",
    courseSlug: "graphic-design",
    bio: "Teaches design as a practical, hands-on skill -- typography, colour, and branding -- so every student leaves with real portfolio work.",
    specialties: ["Typography & colour", "Branding", "Photo editing"],
    photo: "/mentors/nivash-kumar.jpg",
    credential: "IIT Madras",
    accent: "earth",
  },
];

/** All tutors teaching a given course, in listed order. */
export function tutorsForSkillCourse(courseSlug: string): SkillTutor[] {
  return SKILL_TUTORS.filter((t) => t.courseSlug === courseSlug);
}

export function getSkillCourse(slug: string): SkillCourse | undefined {
  return SKILL_COURSES.find((c) => c.slug === slug);
}

export function getSkillTutor(slug: string): SkillTutor | undefined {
  return SKILL_TUTORS.find((t) => t.slug === slug);
}

export function skillCourseDurationMinutes(course: SkillCourse): number {
  return course.modules.reduce((sum, m) => sum + m.minutes, 0);
}

/** "1 hr 25 min" / "45 min" -- never "1 hr 0 min". */
export function formatSkillDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}
