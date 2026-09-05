"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  BookOpen,
  Download,
  Eye,
  Search,
  CheckCircle2,
  FileText,
  X,
  Sparkles,
  ChevronRight,
  Filter,
} from "lucide-react";

type Book = {
  id: string;
  title: string;
  hindiTitle: string;
  subject: string;
  classes: string[];
  board: string;
  chaptersCount: number;
  pagesCount: number;
  color: string;
  coverGradient: string;
  chapters: {
    number: number;
    title: string;
    hindiTitle: string;
    pages: string;
    contentPreview: string;
    keyQuestions: string[];
  }[];
};

const BIHAR_BOOKS: Book[] = [
  {
    id: "book-math-10",
    title: "Ganit (Mathematics)",
    hindiTitle: "गणित (कक्षा 10)",
    subject: "Mathematics",
    classes: ["Class 10"],
    board: "BSTBPC / BSEB Bihar State Board",
    chaptersCount: 15,
    pagesCount: 348,
    color: "amber",
    coverGradient: "from-amber-500 to-orange-600",
    chapters: [
      {
        number: 1,
        title: "Real Numbers",
        hindiTitle: "वास्तविक संख्याएं",
        pages: "1–22",
        contentPreview: "अंकगणित की आधारभूत प्रमेय (Fundamental Theorem of Arithmetic), यूक्लिड विभाजन प्रमेयिका, अपरिमेय संख्याओं का पुनर्भ्रमण, परिमेय संख्याओं और उनके दशमलव प्रसार।",
        keyQuestions: [
          "सिद्ध कीजिए कि √5 एक अपरिमेय संख्या है।",
          "अभाज्य गुणनखंडन विधि द्वारा 96 और 404 का HCF और LCM ज्ञात कीजिए।",
        ],
      },
      {
        number: 2,
        title: "Polynomials",
        hindiTitle: "बहुपद",
        pages: "23–40",
        contentPreview: "बहुपद के शून्यकों का ज्यामितीय अर्थ, किसी बहुपद के शून्यकों और गुणांकों में संबंध, बहुपदों के लिए विभाजन एल्गोरिद्म।",
        keyQuestions: [
          "द्विघात बहुपद x² + 7x + 10 के शून्यक ज्ञात कीजिए और शून्यकों तथा गुणांकों के बीच संबंध की सत्यता की जांच कीजिए।",
        ],
      },
      {
        number: 3,
        title: "Pair of Linear Equations in Two Variables",
        hindiTitle: "दो चरों वाले रैखिक समीकरण युग्म",
        pages: "41–74",
        contentPreview: "रैखिक समीकरण युग्म का ग्राफीय निरूपण, प्रतिस्थापन विधि, विलोपन विधि, वज्र-गुणन विधि।",
        keyQuestions: [
          "समीकरण युग्म 2x + 3y = 11 और 2x - 4y = -24 को हल कीजिए।",
        ],
      },
      {
        number: 4,
        title: "Quadratic Equations",
        hindiTitle: "द्विघात समीकरण",
        pages: "75–98",
        contentPreview: "द्विघात समीकरण का मानक रूप ax² + bx + c = 0, गुणनखंडन द्वारा हल, द्विघाती सूत्र (श्रीधराचार्य सूत्र), मूलों की प्रकृति।",
        keyQuestions: [
          "द्विघात समीकरण 2x² - 4x + 3 = 0 का विविक्तकर (D) ज्ञात कीजिए और मूलों की प्रकृति बताइए।",
        ],
      },
      {
        number: 5,
        title: "Arithmetic Progressions",
        hindiTitle: "समांतर श्रेढ़ी",
        pages: "99–124",
        contentPreview: "समांतर श्रेढ़ी का n-वां पद (aₙ = a + (n-1)d), प्रथम n पदों का योग (Sₙ = n/2 [2a + (n-1)d])।",
        keyQuestions: [
          "AP: 2, 7, 12, ... का 10वाँ पद ज्ञात कीजिए।",
          "प्रथम 1000 धन पूर्णांकों का योग ज्ञात कीजिए।",
        ],
      },
    ],
  },
  {
    id: "book-science-10",
    title: "Vigyan (Science)",
    hindiTitle: "विज्ञान (कक्षा 10)",
    subject: "Science",
    classes: ["Class 10"],
    board: "BSTBPC / BSEB Bihar State Board",
    chaptersCount: 16,
    pagesCount: 320,
    color: "blue",
    coverGradient: "from-blue-600 to-indigo-700",
    chapters: [
      {
        number: 1,
        title: "Chemical Reactions and Equations",
        hindiTitle: "रासायनिक अभिक्रियाएं एवं समीकरण",
        pages: "1–18",
        contentPreview: "रासायनिक समीकरण का संतुलन, संयोजन अभिक्रिया, वियोजन अभिक्रिया, विस्थापन अभिक्रिया, द्विविस्थापन अभिक्रिया, उपचयन एवं अपचयन, संक्षारण एवं विकृतगंधिता।",
        keyQuestions: [
          "संतुलित रासायनिक समीकरण क्या है? रासायनिक समीकरण को संतुलित करना क्यों आवश्यक है?",
          "तेल एवं वसायुक्त खाद्य पदार्थों को नाइट्रोजन से प्रभावित क्यों किया जाता है?",
        ],
      },
      {
        number: 2,
        title: "Acids, Bases and Salts",
        hindiTitle: "अम्ल, क्षारक एवं लवण",
        pages: "19–38",
        contentPreview: "अम्ल एवं क्षारक के रासायनिक गुणधर्म, सूचक, pH स्केल, दैनिक जीवन में pH का महत्व, विरंजक चूर्ण, बेकिंग सोडा, धोने का सोडा और प्लास्टर ऑफ पेरिस।",
        keyQuestions: [
          "प्लास्टर ऑफ पेरिस को आर्द्र-रोधी बर्तन में क्यों रखा जाना चाहिए?",
          "उदासीनीकरण अभिक्रिया क्या है? दो उदाहरण दीजिए।",
        ],
      },
      {
        number: 6,
        title: "Life Processes",
        hindiTitle: "जैव प्रक्रम",
        pages: "105–130",
        contentPreview: "पोषण (स्वपोषी एवं विषमपोषी पोषण), श्वसन (वायवीय एवं अवायवीय श्वसन), वहन (मानव में परिसंचरण एवं पौधों में परिवहन), उत्सर्जन (मानव उत्सर्जन तंत्र एवं वृक्काणु की रचना)।",
        keyQuestions: [
          "वायवीय तथा अवायवीय श्वसन में क्या अंतर है?",
          "नेफ्रॉन (वृक्काणु) की रचना तथा कार्यप्रणाली का सचित्र वर्णन कीजिए।",
        ],
      },
      {
        number: 10,
        title: "Light: Reflection and Refraction",
        hindiTitle: "प्रकाश: परावर्तन तथा अपवर्तन",
        pages: "185–216",
        contentPreview: "गोलीय दर्पणों द्वारा प्रकाश का परावर्तन, किरण आरेख, दर्पण सूत्र एवं आवर्धन, प्रकाश का अपवर्तन, स्नेल का नियम, लेंस सूत्र एवं लेंस की क्षमता।",
        keyQuestions: [
          "अवतल दर्पण के मुख्य फोकस की परिभाषा लिखिए।",
          "लेंस की क्षमता की परिभाषा लिखिए तथा इसका SI मात्रक बताइए।",
        ],
      },
    ],
  },
  {
    id: "book-history-10",
    title: "Bharat Aur Samkalin Vishwa (History)",
    hindiTitle: "भारत और समकालीन विश्व (इतिहास)",
    subject: "Social Science",
    classes: ["Class 10"],
    board: "BSTBPC / Bihar Board",
    chaptersCount: 8,
    pagesCount: 198,
    color: "rose",
    coverGradient: "from-rose-600 to-red-800",
    chapters: [
      {
        number: 1,
        title: "The Rise of Nationalism in Europe",
        hindiTitle: "यूरोप में राष्ट्रवाद का उदय",
        pages: "1–28",
        contentPreview: "फ्रांसीसी क्रांति और राष्ट्र का विचार, 1804 की नेपोलियन संहिता, इटली और जर्मनी का एकीकरण, राष्ट्र की दृश्य-कल्पना।",
        keyQuestions: [
          "1804 की नेपोलियन संहिता की मुख्य विशेषताओं की व्याख्या कीजिए।",
          "इटली के एकीकरण में मेजिनी, कावूर और गैरीबाल्डी के योगदान का उल्लेख कीजिए।",
        ],
      },
      {
        number: 2,
        title: "Nationalism in India",
        hindiTitle: "भारत में राष्ट्रवाद",
        pages: "29–54",
        contentPreview: "प्रथम विश्व युद्ध का प्रभाव, सत्याग्रह का विचार (चंपारण, खेड़ा, अहमदाबाद), रॉलेट एक्ट, जलियांवाला बाग हत्याकांड, असहयोग आंदोलन, सविनय अवज्ञा आंदोलन, पूना पैक्ट।",
        keyQuestions: [
          "बिहार के चंपारण सत्याग्रह का भारतीय स्वतंत्रता संग्राम में क्या महत्व है?",
          "गांधीजी ने असहयोग आंदोलन को वापस लेने का फैसला क्यों किया?",
        ],
      },
    ],
  },
  {
    id: "book-hindi-10",
    title: "Godhuli Bhag 2 (Hindi Reader)",
    hindiTitle: "गोधूलि भाग 2 (हिंदी)",
    subject: "Hindi",
    classes: ["Class 10"],
    board: "BSTBPC / Bihar State Board",
    chaptersCount: 24,
    pagesCount: 210,
    color: "emerald",
    coverGradient: "from-emerald-600 to-teal-800",
    chapters: [
      {
        number: 1,
        title: "Shram Vibhajan Aur Jati Pratha",
        hindiTitle: "श्रम विभाजन और जाति प्रथा (डॉ. भीमराव अंबेडकर)",
        pages: "1–12",
        contentPreview: "जाति प्रथा के दोष, सभ्य समाज में कार्यकुशलता हेतु श्रम विभाजन, और समता, स्वतंत्रता व बंधुत्व पर आधारित सच्चे लोकतंत्र का स्वरूप।",
        keyQuestions: [
          "लेखक किस विडंबना की बात करते हैं? विडंबना का स्वरूप क्या है?",
          "जाति प्रथा भारत में बेरोजगारी का एक प्रमुख और प्रत्यक्ष कारण कैसे बनी हुई है?",
        ],
      },
      {
        number: 2,
        title: "Vish Ke Dant",
        hindiTitle: "विष के दांत (नलिन विलोचन शर्मा)",
        pages: "13–24",
        contentPreview: "खोखा (कासू) और मदन के बीच सामाजिक वर्ग भेद और संघर्ष का मनोवैज्ञानिक चित्रण।",
        keyQuestions: [
          "महल और झोपड़ी वालों की लड़ाई में अक्सर महल वाले ही जीतते हैं - इस कथन की समीक्षा कीजिए।",
        ],
      },
    ],
  },
  {
    id: "book-english-10",
    title: "Panorama Part 2 (English)",
    hindiTitle: "पैनोरमा पार्ट 2 (अंग्रेज़ी)",
    subject: "English",
    classes: ["Class 10"],
    board: "BSTBPC / Bihar State Board",
    chaptersCount: 16,
    pagesCount: 165,
    color: "sky",
    coverGradient: "from-sky-600 to-blue-800",
    chapters: [
      {
        number: 1,
        title: "The Pace for Living",
        hindiTitle: "The Pace for Living (R.C. Hutchinson)",
        pages: "1–10",
        contentPreview: "A thought-provoking essay discussing the fast pace of modern civilization and its impact on the human mind and slow thinkers.",
        keyQuestions: [
          "Where did the writer watch the play?",
          "Who was the chief character in the play?",
          "Does the writer dislike rapid movement in every way?",
        ],
      },
      {
        number: 2,
        title: "Me and the Ecology Bit",
        hindiTitle: "Me and the Ecology Bit (Joan Lexau)",
        pages: "11–20",
        contentPreview: "A young boy's sincere attempts to persuade his neighbours to protect the environment and practice recycling.",
        keyQuestions: [
          "What does the narrator do on Saturdays and Sundays?",
          "Why is it difficult to make people understand about ecology?",
        ],
      },
    ],
  },
  {
    id: "book-sanskrit-10",
    title: "Piyusham Bhag 2 (Sanskrit)",
    hindiTitle: "पीयूषम् भाग 2 (संस्कृत)",
    subject: "Sanskrit",
    classes: ["Class 10"],
    board: "BSTBPC / Bihar State Board",
    chaptersCount: 14,
    pagesCount: 140,
    color: "purple",
    coverGradient: "from-purple-600 to-violet-800",
    chapters: [
      {
        number: 1,
        title: "Mangalam",
        hindiTitle: "मङ्गलम् (उपनिषदः)",
        pages: "1–8",
        contentPreview: "सत्यमेव जयते नानृतम् - महर्षि वेदव्यास विरचित उपनिषदों के प्रसिद्ध वैदिक श्लोक एवं उनका सरल हिंदी भावार्थ।",
        keyQuestions: [
          "मङ्गलम् पाठ का मुख्य संदेश क्या है?",
          "विद्वान शोक रहित होकर किस परम पुरुष को प्राप्त करते हैं?",
        ],
      },
      {
        number: 2,
        title: "Pataliputra Vaibhavam",
        hindiTitle: "पाटलिपुत्रवैभवम् (पटना का ऐतिहासिक गौरव)",
        pages: "9–18",
        contentPreview: "बिहार की राजधानी पटना के प्राचीन वैभव, चंद्रगुप्त मौर्य, अशोक, गुरु गोविंद सिंह जी का जन्मस्थान तथा दर्शनीय स्थलों का वर्णन।",
        keyQuestions: [
          "दामोदरगुप्त ने पाटलिपुत्र के विषय में क्या कहा है?",
          "पाटलिपुत्र के प्राचीन महोत्सव का वर्णन कीजिए।",
        ],
      },
    ],
  },
];

export default function BookSectionPage() {
  const [selectedClass, setSelectedClass] = useState("Class 10");
  const [selectedSubject, setSelectedSubject] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeBook, setActiveBook] = useState<Book | null>(null);
  const [readingChapter, setReadingChapter] = useState<Book["chapters"][0] | null>(null);

  const subjects = ["All", "Mathematics", "Science", "Social Science", "Hindi", "English", "Sanskrit"];

  const filteredBooks = BIHAR_BOOKS.filter((b) => {
    const matchesClass = b.classes.includes(selectedClass);
    const matchesSubject = selectedSubject === "All" || b.subject === selectedSubject;
    const matchesSearch =
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.hindiTitle.includes(searchQuery);
    return matchesClass && matchesSubject && matchesSearch;
  });

  return (
    <main className="flex flex-1 flex-col overflow-y-auto bg-slate-50/60 pb-16">
      {/* ─── Header ─── */}
      <div className="border-b border-slate-200 bg-white px-5 py-4">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="size-5 text-orange-600" />
                Book Section — Bihar State E-Textbooks
              </h1>
              <span className="rounded-full bg-orange-100 text-orange-800 text-[10px] font-bold px-2 py-0.5">
                SCERT / BSTBPC
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Official Bihar State Textbooks and NCERT syllabus books with chapter-wise reading & questions.
            </p>
          </div>

          {/* Class Tabs */}
          <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
            {["Class 9", "Class 10", "Class 11", "Class 12"].map((cls) => (
              <button
                key={cls}
                type="button"
                onClick={() => setSelectedClass(cls)}
                className={`rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                  selectedClass === cls
                    ? "bg-white text-orange-600 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {cls}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 pt-5 sm:px-8 space-y-6">
        {/* ─── Filter & Search Bar ─── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Subject Pills */}
          <div className="no-scrollbar flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1">
            {subjects.map((sub) => (
              <button
                key={sub}
                type="button"
                onClick={() => setSelectedSubject(sub)}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedSubject === sub
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {sub}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search books & chapters..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-4 text-xs shadow-xs focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* ─── Books Grid ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredBooks.map((book) => (
            <div
              key={book.id}
              className="group flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:shadow-md hover:border-orange-300"
            >
              <div>
                {/* Book Spine / Cover Preview */}
                <div
                  className={`h-36 w-full rounded-2xl bg-gradient-to-br ${book.coverGradient} p-4 text-white flex flex-col justify-between relative overflow-hidden shadow-xs mb-4`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-black/20 backdrop-blur-xs px-2 py-0.5 rounded-md">
                      {book.board}
                    </span>
                    <BookOpen className="size-5 text-white/80" />
                  </div>
                  <div>
                    <h3 className="text-base font-black leading-tight drop-shadow-xs">
                      {book.title}
                    </h3>
                    <p className="text-xs font-medium text-white/90 drop-shadow-xs">
                      {book.hindiTitle}
                    </p>
                  </div>
                  <div className="pointer-events-none absolute -right-6 -bottom-6 size-24 rounded-full bg-white/10 blur-lg" />
                </div>

                {/* Metadata */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>{book.chaptersCount} Chapters</span>
                    <span>{book.pagesCount} Pages</span>
                    <span>Class 10 (BSEB)</span>
                  </div>
                </div>

                {/* Chapter list preview */}
                <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-3">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Featured Chapters:
                  </span>
                  {book.chapters.slice(0, 3).map((c) => (
                    <button
                      key={c.number}
                      type="button"
                      onClick={() => {
                        setActiveBook(book);
                        setReadingChapter(c);
                      }}
                      className="w-full text-left text-xs text-slate-700 hover:text-orange-600 hover:bg-orange-50/50 p-1.5 rounded-lg transition-colors flex items-center justify-between"
                    >
                      <span className="truncate">
                        Ch {c.number}: {c.hindiTitle}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {c.pages}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="mt-5 flex items-center gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setActiveBook(book);
                    setReadingChapter(book.chapters[0]);
                  }}
                  className="flex-1 rounded-xl bg-orange-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-orange-700 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Eye className="size-3.5" />
                  Read Online
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveBook(book);
                    setReadingChapter(book.chapters[0]);
                  }}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1"
                >
                  <Download className="size-3.5 text-slate-500" />
                  Chapters
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Reading / Book Chapter Modal ─── */}
      <AnimatePresence>
        {activeBook && readingChapter && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative flex max-h-[90vh] w-full max-w-3xl flex-col rounded-3xl bg-white shadow-2xl overflow-hidden"
            >
              {/* Modal Header */}
              <div className={`flex items-center justify-between bg-gradient-to-r ${activeBook.coverGradient} px-6 py-4 text-white`}>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-white/80">
                    {activeBook.title} · Chapter {readingChapter.number} (Pages {readingChapter.pages})
                  </span>
                  <h3 className="text-lg font-bold">
                    {readingChapter.title} — {readingChapter.hindiTitle}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveBook(null);
                    setReadingChapter(null);
                  }}
                  className="rounded-full bg-white/20 p-1.5 text-white hover:bg-white/30 transition-colors"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 text-slate-700 text-xs sm:text-sm">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    अध्याय विवरण एवं पाठ्य सामग्री (Chapter Summary & Text)
                  </h4>
                  <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200 leading-relaxed text-slate-800">
                    {readingChapter.contentPreview}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                    <CheckCircle2 className="size-4 text-emerald-600" />
                    महत्वपूर्ण बोर्ड परीक्षा प्रश्न (Key Bihar Board Questions)
                  </h4>
                  <div className="space-y-2.5">
                    {readingChapter.keyQuestions.map((q, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl bg-blue-50/50 p-3 border border-blue-100 text-slate-800 flex items-start gap-2.5"
                      >
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-[10px]">
                          Q{idx + 1}
                        </span>
                        <span className="text-xs font-semibold">{q}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Chapter list in this book */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    इस पुस्तक के अन्य अध्याय (Other Chapters)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {activeBook.chapters.map((ch) => (
                      <button
                        key={ch.number}
                        type="button"
                        onClick={() => setReadingChapter(ch)}
                        className={`rounded-xl p-2.5 text-left text-xs transition-colors border ${
                          readingChapter.number === ch.number
                            ? "bg-orange-50 border-orange-300 font-bold text-orange-900"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        Ch {ch.number}: {ch.hindiTitle}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
                <Link
                  href="/doubts"
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  Ask Doubt on this Chapter
                </Link>

                <div className="flex items-center gap-2">
                  <Link
                    href="/practice"
                    className="rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white hover:bg-orange-700 transition-colors shadow-xs"
                  >
                    Take Quiz on this Book
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
