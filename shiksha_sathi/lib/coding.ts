/**
 * Coding Hub catalogue -- frontend-only, same idea as `lib/tools.ts` and
 * `lib/simulations.ts`. No backend yet: courses are a static curriculum
 * (real syllabus, not placeholder text) and tutors are illustrative profiles.
 * The lesson player and live tutor chat are future work -- see the "Coming
 * soon" affordances in components/coding/.
 */
import { Code2, Sparkles, type LucideIcon } from "lucide-react";

export type CodingLevel = "beginner" | "intermediate" | "advanced";
export type CodingAccent = "violet" | "sage";

export const LEVEL_LABEL: Record<CodingLevel, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

/** Fully-literal Tailwind classes per accent -- never template a class name
 *  from this key (e.g. `bg-${accent}/10`), or the JIT scanner won't see it. */
export const ACCENT_STYLES: Record<
  CodingAccent,
  { icon: string; chip: string; bar: string; ring: string; gradient: string }
> = {
  violet: {
    icon: "bg-violet/10 text-violet",
    chip: "bg-violet/10 text-violet",
    bar: "bg-violet",
    ring: "ring-violet/15",
    gradient: "from-violet/10 via-transparent to-transparent",
  },
  sage: {
    icon: "bg-sage/10 text-sage",
    chip: "bg-sage/10 text-sage",
    bar: "bg-sage",
    ring: "ring-sage/15",
    gradient: "from-sage/10 via-transparent to-transparent",
  },
};

export type CodingModule = {
  title: string;
  summary: string;
  minutes: number;
  /** 2-3 concrete things the student can do after this module. */
  outcomes: string[];
};

export type CodingCourse = {
  slug: string;
  title: string;
  tagline: string;
  blurb: string;
  level: CodingLevel;
  icon: LucideIcon;
  accent: CodingAccent;
  modules: CodingModule[];
};

export type CodingTutor = {
  slug: string;
  name: string;
  role: string;
  courseSlug: string;
  bio: string;
  specialties: string[];
  icon: LucideIcon;
  accent: CodingAccent;
};

export const CODING_COURSES: CodingCourse[] = [
  {
    slug: "python",
    title: "Python for Beginners",
    tagline: "Write your first real programs",
    blurb:
      "Start from zero and build up to writing small, working programs -- variables, loops, functions, and a mini project to tie it together.",
    level: "beginner",
    icon: Code2,
    accent: "violet",
    modules: [
      {
        title: "Getting Started",
        summary: "Set up Python, run your first line of code, and see how a program actually executes.",
        minutes: 25,
        outcomes: ["Run Python code and read the output", "Explain what a program is, step by step"],
      },
      {
        title: "Variables & Data Types",
        summary: "Store numbers, text, and true/false values, and understand how Python treats each one.",
        minutes: 30,
        outcomes: ["Create and name variables", "Tell numbers, text, and booleans apart"],
      },
      {
        title: "Control Flow",
        summary: "Make decisions with if/else and repeat actions with for and while loops.",
        minutes: 35,
        outcomes: ["Write an if/else branch", "Loop over a range or a list"],
      },
      {
        title: "Functions",
        summary: "Package logic into reusable functions that take input and return output.",
        minutes: 30,
        outcomes: ["Define a function with parameters", "Return and reuse a function's result"],
      },
      {
        title: "Lists & Dictionaries",
        summary: "Organize and work with collections of data -- the two structures you'll use constantly.",
        minutes: 35,
        outcomes: ["Add, remove, and loop through list items", "Look up values in a dictionary"],
      },
      {
        title: "Mini Project: Quiz Game",
        summary: "Put everything together into a small, playable quiz game you build yourself.",
        minutes: 40,
        outcomes: ["Combine functions, loops, and data into one program", "Debug a program that isn't behaving"],
      },
    ],
  },
  {
    slug: "prompt-engineering",
    title: "Prompt Engineering Essentials",
    tagline: "Get better answers out of AI",
    blurb:
      "Learn how to write prompts that actually get you what you want from AI tools like Claude and ChatGPT -- for homework, projects, and code.",
    level: "beginner",
    icon: Sparkles,
    accent: "sage",
    modules: [
      {
        title: "What Is Prompt Engineering?",
        summary: "Understand how AI models read instructions, and why wording changes the answer.",
        minutes: 20,
        outcomes: ["Explain why two prompts can get very different answers", "Spot a vague prompt vs. a clear one"],
      },
      {
        title: "Anatomy of a Great Prompt",
        summary: "Learn the building blocks -- context, task, format, and tone -- and how to combine them.",
        minutes: 25,
        outcomes: ["Write a prompt with clear context and task", "Ask for a specific output format"],
      },
      {
        title: "Few-Shot & Examples",
        summary: "Guide the AI with a couple of examples to get more consistent, on-target answers.",
        minutes: 25,
        outcomes: ["Add an example to steer the AI's style", "Use examples to fix a wrong-shaped answer"],
      },
      {
        title: "Step-by-Step Thinking Prompts",
        summary: "Ask AI to reason through a problem instead of jumping straight to a guess.",
        minutes: 30,
        outcomes: ["Prompt for step-by-step reasoning", "Catch a shortcut answer and ask it to slow down"],
      },
      {
        title: "Prompting for Code & Creativity",
        summary: "Use prompts to get help with homework, writing, and your own code.",
        minutes: 30,
        outcomes: ["Ask for code with constraints (language, style)", "Prompt for a creative task with a clear brief"],
      },
      {
        title: "Fixing Prompts That Don't Work",
        summary: "Spot the most common mistakes and iterate a prompt until it gets you a good answer.",
        minutes: 25,
        outcomes: ["Diagnose why a prompt failed", "Rewrite a failing prompt into a working one"],
      },
    ],
  },
];

export const CODING_TUTORS: CodingTutor[] = [
  {
    slug: "python-tutor",
    name: "Arjun",
    role: "Python Tutor",
    courseSlug: "python",
    bio: "Breaks programming logic down into everyday examples, so code finally clicks -- patient with every \"wait, why did that happen?\" moment.",
    specialties: ["Python basics", "Debugging", "Mini projects"],
    icon: Code2,
    accent: "violet",
  },
  {
    slug: "prompt-tutor",
    name: "Meera",
    role: "Prompt Engineering Tutor",
    courseSlug: "prompt-engineering",
    bio: "Helps you talk to AI tools like a pro, one well-crafted prompt at a time -- great for homework help, projects, and just being curious.",
    specialties: ["Prompt writing", "AI tools", "Code & creative prompts"],
    icon: Sparkles,
    accent: "sage",
  },
];

export function getCodingCourse(slug: string): CodingCourse | undefined {
  return CODING_COURSES.find((c) => c.slug === slug);
}

export function getCodingTutor(slug: string): CodingTutor | undefined {
  return CODING_TUTORS.find((t) => t.slug === slug);
}

export function courseDurationMinutes(course: CodingCourse): number {
  return course.modules.reduce((sum, m) => sum + m.minutes, 0);
}

/** "1 hr 25 min" / "45 min" -- never "1 hr 0 min". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}
