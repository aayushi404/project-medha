/** Learn English — curated lessons, vocabulary, and daily words for students. */

export type EnglishLesson = {
  id: string;
  title: string;
  subtitle: string;
  emoji: string;
  topics: string[];
  starterPrompt: string;
};

export type VocabWord = {
  word: string;
  meaning: string;
  hindi: string;
  example: string;
  phonetic: string;
};

export type DailyWord = {
  word: string;
  meaning: string;
  hindi: string;
  example: string;
  tip: string;
};

export const ENGLISH_LESSONS: EnglishLesson[] = [
  {
    id: "greetings",
    title: "Greetings & Introductions",
    subtitle: "Say hello, introduce yourself, ask how someone is",
    emoji: "👋",
    topics: ["Hello / Hi", "My name is…", "How are you?", "Nice to meet you"],
    starterPrompt: "Teach me how to greet someone and introduce myself in English.",
  },
  {
    id: "school",
    title: "At School",
    subtitle: "Classroom words, asking the teacher, talking to friends",
    emoji: "🏫",
    topics: ["Teacher, please…", "I don't understand", "Can you repeat?", "Homework"],
    starterPrompt: "Teach me useful English phrases for school and the classroom.",
  },
  {
    id: "family",
    title: "Family & Home",
    subtitle: "Talk about your family, home, and daily routine",
    emoji: "🏠",
    topics: ["Mother, father, brother, sister", "I live in…", "Every day I…", "We eat together"],
    starterPrompt: "Help me learn English words and sentences to describe my family and home.",
  },
  {
    id: "market",
    title: "At the Market",
    subtitle: "Buy things, ask prices, count money",
    emoji: "🛒",
    topics: ["How much?", "I want…", "Too expensive", "Thank you"],
    starterPrompt: "Teach me English for shopping at the market — asking prices and buying things.",
  },
  {
    id: "tenses",
    title: "Simple Tenses",
    subtitle: "Present, past, and future — the building blocks",
    emoji: "⏰",
    topics: ["I eat / I ate / I will eat", "He goes / He went", "Questions with do/did"],
    starterPrompt: "Explain simple present, past, and future tense with easy examples.",
  },
  {
    id: "conversation",
    title: "Daily Conversation",
    subtitle: "Small talk, weather, hobbies, festivals",
    emoji: "💬",
    topics: ["What's your hobby?", "The weather is…", "Happy Diwali!", "See you tomorrow"],
    starterPrompt: "Let's practice a simple English conversation about hobbies and festivals.",
  },
];

export const VOCAB_SETS: { id: string; label: string; words: VocabWord[] }[] = [
  {
    id: "basics",
    label: "Everyday Words",
    words: [
      { word: "Book", meaning: "Something you read", hindi: "किताब", example: "I read my book.", phonetic: "book" },
      { word: "Water", meaning: "What we drink", hindi: "पानी", example: "Can I have some water?", phonetic: "WAW-ter" },
      { word: "Friend", meaning: "Someone you like", hindi: "दोस्त", example: "She is my best friend.", phonetic: "frend" },
      { word: "Happy", meaning: "Feeling good", hindi: "खुश", example: "I am happy today.", phonetic: "HAP-ee" },
      { word: "Learn", meaning: "To gain knowledge", hindi: "सीखना", example: "I want to learn English.", phonetic: "lurn" },
      { word: "Help", meaning: "To assist someone", hindi: "मदद", example: "Can you help me?", phonetic: "help" },
    ],
  },
  {
    id: "school",
    label: "School Words",
    words: [
      { word: "Teacher", meaning: "Person who teaches", hindi: "शिक्षक", example: "My teacher is kind.", phonetic: "TEE-cher" },
      { word: "Homework", meaning: "Work to do at home", hindi: "गृहकार्य", example: "I finished my homework.", phonetic: "HOME-wurk" },
      { word: "Exam", meaning: "A test", hindi: "परीक्षा", example: "The exam is next week.", phonetic: "ig-ZAM" },
      { word: "Answer", meaning: "A reply to a question", hindi: "उत्तर", example: "What is the answer?", phonetic: "AN-ser" },
      { word: "Question", meaning: "Something you ask", hindi: "प्रश्न", example: "I have a question.", phonetic: "KWES-chun" },
      { word: "Class", meaning: "A group of students", hindi: "कक्षा", example: "Our class starts at 9.", phonetic: "klas" },
    ],
  },
  {
    id: "verbs",
    label: "Common Verbs",
    words: [
      { word: "Go", meaning: "To move from one place", hindi: "जाना", example: "I go to school.", phonetic: "goh" },
      { word: "Eat", meaning: "To have food", hindi: "खाना", example: "We eat lunch at 1 pm.", phonetic: "eet" },
      { word: "Read", meaning: "To look at and understand words", hindi: "पढ़ना", example: "I read every day.", phonetic: "reed" },
      { word: "Write", meaning: "To make words on paper", hindi: "लिखना", example: "Please write your name.", phonetic: "ryt" },
      { word: "Speak", meaning: "To say words", hindi: "बोलना", example: "Speak slowly, please.", phonetic: "speek" },
      { word: "Listen", meaning: "To hear carefully", hindi: "सुनना", example: "Listen to the teacher.", phonetic: "LIS-un" },
    ],
  },
];

/** Deterministic "word of the day" from the calendar date. */
export function dailyWord(date = new Date()): DailyWord {
  const pool: DailyWord[] = [
    { word: "Curious", meaning: "Wanting to know or learn", hindi: "जिज्ञासु", example: "Be curious — ask questions!", tip: "Say: KYOOR-ee-us" },
    { word: "Practice", meaning: "Doing something again to improve", hindi: "अभ्यास", example: "Practice makes perfect.", tip: "Say: PRAK-tis" },
    { word: "Together", meaning: "With each other", hindi: "साथ में", example: "Let's study together.", tip: "Say: tuh-GETH-er" },
    { word: "Improve", meaning: "To get better", hindi: "सुधारना", example: "I improve every day.", tip: "Say: im-PROOV" },
    { word: "Confidence", meaning: "Believing in yourself", hindi: "आत्मविश्वास", example: "Speak with confidence.", tip: "Say: KON-fi-dens" },
    { word: "Patient", meaning: "Waiting calmly", hindi: "धैर्यवान", example: "Be patient while learning.", tip: "Say: PAY-shent" },
    { word: "Celebrate", meaning: "To enjoy a special day", hindi: "जश्न मनाना", example: "We celebrate Holi.", tip: "Say: SEL-uh-brayt" },
  ];
  const day = Math.floor(date.getTime() / 86_400_000);
  return pool[day % pool.length]!;
}

export const SPEAKING_PROMPTS = [
  "Hello, my name is ___. Nice to meet you.",
  "I am a student at ___ school.",
  "My favourite subject is ___.",
  "Every morning I wake up at ___ o'clock.",
  "I want to learn English because ___.",
  "Can you please help me with this?",
  "Thank you very much for your help.",
];
