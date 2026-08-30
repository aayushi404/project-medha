/**
 * English UI strings for the teacher screens. Not a full i18n layer -- one
 * typed file, imported directly. The backend returns generated content (which
 * follows the teacher's language preference); chrome lives here.
 */
export const copy = {
  brand: "Medha",
  nav: {
    home: "Home",
    modules: "My Modules",
    tools: "Tools",
    attendance: "Attendance",
    students: "Students",
  },
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
  makeMindmap: "Mind map",
  makePpt: "PPT",
  comingSoonMindmapPpt: "Mind maps and slides are coming soon.",
  readAloud: "Read aloud",
  stopReading: "Stop",
  generating: "Generating…",
  streamError: "The response didn't finish. Please try again.",
  retry: "Retry",

  // chapter history (dashboard)
  chapterHistoryTitle: "Earlier in this chapter",
  chapterHistoryHint: "Anything you generate below is saved here.",
  chapterHistoryEmpty:
    "Nothing generated for this chapter yet. Ask a question or use a quick action below.",
  chapterHistoryFailed: "Couldn't load earlier content for this chapter.",
  pickChapterForHistory: "Pick a chapter to see what you've already made for it.",
  chapterHistoryCount: (n: number) => `${n} item${n === 1 ? "" : "s"}`,
  openFullModule: "Open full module",

  // my modules
  myModules: "My Modules",
  myModulesSub: "Everything you've made, arranged chapter by chapter.",
  filterAll: "All",
  searchPlaceholder: "Search by name",
  emptyModules: "No modules yet. Ask about a topic on the dashboard.",
  moduleNotFound: "This module wasn't found.",
  back: "Back",
  answerLabel: "Answer",
  materialsNone: "Nothing needed",

  // chapter browser
  pickClassSubject: "Pick a class you teach",
  noSubjects: "Add the classes you teach in your profile to see them here.",
  chaptersEmpty: "No chapters listed for this class yet.",
  chapterNothingYet: "Nothing here yet.",
  startLesson: "Start a lesson",
  expandAll: "Expand all",
  collapseAll: "Collapse all",
  otherModules: "Not linked to a chapter",
  moduleCount: (n: number) => `${n} module${n === 1 ? "" : "s"}`,
  noSearchHits: "No modules match that search.",

  // module detail
  allTypes: "All",
  sectionTitle: {
    explanation: "Explanation",
    quiz: "Quizzes",
    activity: "Activities",
  } as Record<string, string>,
  revealAnswers: "Reveal answers",
  hideAnswers: "Hide answers",
  showAnswer: "Show answer",
  hideAnswer: "Hide answer",
  practiceHint: "Tap an option to check yourself",
  conversationTitle: "Original conversation",
  conversationSub: "The chat this module came from",
  conversationEmpty: "No messages saved for this module.",
  conversationFailed: "Couldn't load the conversation.",
  copyText: "Copy",
  copied: "Copied",
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
