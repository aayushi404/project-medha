/**
 * The teacher toolbox. One flat registry of every tool we want to offer, tagged
 * with a category and a status. `ready` tools have a real (frontend-only) screen
 * today; `soon` tools render a shared placeholder until the backend lands.
 *
 * Adding a tool: append here, then -- if it's `ready` -- wire its slug into the
 * switch in app/(protected)/(app)/tools/[slug]/page.tsx.
 */
import {
  BookOpenCheck,
  CalendarRange,
  Dices,
  FileQuestion,
  Grid3x3,
  KeyRound,
  Languages,
  ListChecks,
  type LucideIcon,
  NotebookPen,
  Presentation,
  Shapes,
  Shuffle,
  Table,
  Target,
  Timer,
} from "lucide-react";

export type ToolStatus = "ready" | "soon";
export type ToolCategory = "plan" | "create" | "assess" | "classroom";

export type Tool = {
  slug: string;
  name: string;
  tagline: string;
  blurb: string;
  icon: LucideIcon;
  category: ToolCategory;
  status: ToolStatus;
};

export const TOOL_CATEGORIES: { key: ToolCategory; label: string; hint: string }[] = [
  { key: "plan", label: "Plan the lesson", hint: "Turn a topic into a teachable plan" },
  { key: "create", label: "Make material", hint: "Notes, worksheets, decks, examples" },
  { key: "assess", label: "Assess & grade", hint: "Tests, quizzes, rubrics, keys" },
  { key: "classroom", label: "In the classroom", hint: "Quick helpers for live teaching" },
];

export const TOOLS: Tool[] = [
  // -- plan --------------------------------------------------------------
  {
    slug: "lesson-plan",
    name: "Lesson Plan Builder",
    tagline: "A minute-by-minute plan for any topic",
    blurb:
      "Enter a topic, grade and period length and get a structured plan -- objectives, warm-up, teaching, practice, assessment and homework -- ready to tweak.",
    icon: NotebookPen,
    category: "plan",
    status: "ready",
  },
  {
    slug: "pacing-calendar",
    name: "Pacing Calendar",
    tagline: "Spread a chapter across the weeks you have",
    blurb:
      "Tell it the chapter and the number of periods; it lays the sub-topics out across a calendar so you always know if you're on track.",
    icon: CalendarRange,
    category: "plan",
    status: "soon",
  },
  {
    slug: "objectives",
    name: "Objectives Writer",
    tagline: "Clear, measurable learning objectives",
    blurb:
      "Give a topic and get 3-5 learning objectives written in student-facing language, aligned to the level you teach.",
    icon: Target,
    category: "plan",
    status: "soon",
  },

  // -- create ------------------------------------------------------------
  {
    slug: "pdf-qa",
    name: "Ask a PDF",
    tagline: "Upload a chapter and ask anything",
    blurb:
      "Drop in a textbook chapter, notes or a circular and ask questions in plain language -- summaries, definitions, 'explain this like I'm 10', question ideas.",
    icon: FileQuestion,
    category: "create",
    status: "ready",
  },
  {
    slug: "worksheet",
    name: "Worksheet Maker",
    tagline: "Printable practice in seconds",
    blurb:
      "Pick a topic and question mix; get a clean, printable worksheet with an answer key on a separate page.",
    icon: Table,
    category: "create",
    status: "soon",
  },
  {
    slug: "slides",
    name: "Slide Outline",
    tagline: "A deck skeleton you can present from",
    blurb:
      "Turn a topic into a slide-by-slide outline: titles, talking points and a board-work suggestion for each slide.",
    icon: Presentation,
    category: "create",
    status: "soon",
  },
  {
    slug: "analogy",
    name: "Analogy & Story Finder",
    tagline: "Everyday examples that make it click",
    blurb:
      "Get relatable analogies, short stories and real-life examples for a hard concept -- tuned to the world your students know.",
    icon: Shapes,
    category: "create",
    status: "soon",
  },
  {
    slug: "translate",
    name: "Translate & Simplify",
    tagline: "Any passage, in the language of your class",
    blurb:
      "Paste text and get a translation or a simpler rewrite at the reading level you choose, keeping the meaning intact.",
    icon: Languages,
    category: "create",
    status: "soon",
  },

  // -- assess ----------------------------------------------------------
  {
    slug: "quick-mock",
    name: "Quick Mock Test",
    tagline: "A full paper for any topic, right now",
    blurb:
      "Choose a topic, question count and difficulty; get a formatted mock paper with marks and an answer key, ready to print.",
    icon: ListChecks,
    category: "assess",
    status: "ready",
  },
  {
    slug: "quiz",
    name: "Quiz Maker",
    tagline: "Short quizzes for a quick check",
    blurb:
      "Generate a 5-10 question quiz for a topic -- MCQ, true/false or one-word -- with instant answer key.",
    icon: BookOpenCheck,
    category: "assess",
    status: "soon",
  },
  {
    slug: "rubric",
    name: "Rubric Builder",
    tagline: "Fair, consistent grading criteria",
    blurb:
      "Describe the assignment and get a rubric with levels and descriptors you can hand to students before they start.",
    icon: Grid3x3,
    category: "assess",
    status: "soon",
  },
  {
    slug: "answer-key",
    name: "Answer Key Helper",
    tagline: "Model answers with mark breakdowns",
    blurb:
      "Paste your questions and get model answers with a suggested mark-by-mark split so grading a stack of papers goes faster.",
    icon: KeyRound,
    category: "assess",
    status: "soon",
  },

  // -- classroom -------------------------------------------------------
  {
    slug: "group-maker",
    name: "Group Maker",
    tagline: "Fair, random groups in one tap",
    blurb:
      "Paste your class list, choose a group size or a number of groups, and shuffle. Works entirely on your device.",
    icon: Shuffle,
    category: "classroom",
    status: "ready",
  },
  {
    slug: "name-picker",
    name: "Random Picker",
    tagline: "Cold-call without picking favourites",
    blurb:
      "Pull a random student to answer. Turn on 'no repeats' to cycle through the whole class before anyone comes up twice.",
    icon: Dices,
    category: "classroom",
    status: "ready",
  },
  {
    slug: "timer",
    name: "Class Timer",
    tagline: "A big, calm countdown for activities",
    blurb:
      "Set a timer for group work, tests or transitions. Large display, one-tap presets, gentle finish.",
    icon: Timer,
    category: "classroom",
    status: "ready",
  },
  {
    slug: "seating",
    name: "Seating Chart",
    tagline: "Arrange the room, remember the plan",
    blurb:
      "Lay out desks, drop students in, and keep the chart for next time. Randomise when you want a fresh mix.",
    icon: Grid3x3,
    category: "classroom",
    status: "soon",
  },
];

export const toolBySlug = (slug: string): Tool | undefined =>
  TOOLS.find((t) => t.slug === slug);
