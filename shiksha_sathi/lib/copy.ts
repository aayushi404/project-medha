/**
 * English UI strings for the teacher screens. Not a full i18n layer -- one
 * typed file, imported directly. The backend returns generated content (which
 * follows the teacher's language preference); chrome lives here.
 */
export const copy = {
  brand: "Medha",
  nav: { home: "Home", modules: "My Modules" },
  profileMenu: { edit: "Edit profile", logout: "Log out" },

  // dashboard
  greeting: (name: string) => (name ? `Hello, ${name}` : "Hello"),
  greetingSub: "What are you teaching today?",
  inputPlaceholder: "How do I teach photosynthesis so students stay engaged?",
  needContext: "Pick a class and subject first.",
  selectClass: "Class",
  selectSubject: "Subject",
  selectChapter: "Chapter",
  quickActions: {
    explanation: { label: "Teaching approach", sub: "2-3 strategies" },
    quiz: { label: "Quiz", sub: "Questions to ask" },
    activity: { label: "Class activity", sub: "Low-tech, hands-on" },
    ppt: { label: "PPT", sub: "Coming soon" },
    mindmap: { label: "Mindmap", sub: "Coming soon" },
  },
  explanationPrompt: "How do I teach this topic in an engaging way?",
  makeQuiz: "Make a quiz",
  makeActivity: "Make an activity",
  generating: "Generating…",
  streamError: "The response didn't finish. Please try again.",
  retry: "Retry",

  // my modules
  myModules: "My Modules",
  filterAll: "All",
  searchPlaceholder: "Search by name",
  emptyModules: "No modules yet. Ask about a topic on the dashboard.",
  moduleNotFound: "This module wasn't found.",
  back: "Back",
  answerLabel: "Answer",
  materialsNone: "Nothing needed",
  feedbackUp: "Helpful",
  feedbackDown: "Could be better",
  commentPlaceholder: "Anything to add? (optional)",
  send: "Send",
  save: "Save",
  cancel: "Cancel",
  deleteModule: "Delete module",
  deleteConfirmTitle: "Delete this module?",
  deleteConfirmBody: "All of its artifacts will be removed too. This can't be undone.",
  confirmDelete: "Delete",

  artifactLabel: {
    explanation: "Explanation",
    quiz: "Quiz",
    activity: "Activity",
  } as Record<string, string>,
} as const;
