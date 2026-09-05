"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  BookOpen,
  Calculator,
  Atom,
  FlaskConical,
  Dna,
  BookMarked,
  Languages,
  Scroll,
  Globe2,
  Laptop,
  PlayCircle,
  HelpCircle,
  FileCheck2,
  ChevronRight,
  Sparkles,
  ArrowRight,
  Search,
  Download,
  CheckCircle2,
  X,
  Flame,
  PencilRuler,
  FileText,
  BarChart3,
  MessagesSquare,
} from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { useStudentData } from "@/lib/student-context";

// Bihar Board Subject definitions
export type SubjectCategory = {
  id: string;
  name: string;
  hindiName: string;
  chaptersCount: number;
  videosCount: number;
  questionsCount: number;
  testsCount: number;
  icon: React.ElementType;
  gradient: string;
  accentColor: string;
  chapters: {
    id: string;
    num: string;
    title: string;
    hindiTitle: string;
    topicsCount: number;
    summary: string;
    keyPoints: string[];
    formulas: string[];
  }[];
};

export const BIHAR_SUBJECTS: SubjectCategory[] = [
  {
    id: "math",
    name: "Mathematics",
    hindiName: "गणित",
    chaptersCount: 14,
    videosCount: 230,
    questionsCount: 1280,
    testsCount: 140,
    icon: Calculator,
    gradient: "from-amber-500 to-orange-600",
    accentColor: "bg-orange-50 text-orange-700 border-orange-200",
    chapters: [
      {
        id: "m-01",
        num: "01",
        title: "Real Numbers",
        hindiTitle: "वास्तविक संख्याएं",
        topicsCount: 4,
        summary: "Fundamental Theorem of Arithmetic, irrationality proofs for √2, √3, √5, decimal expansions of rational numbers.",
        keyPoints: [
          "Every composite number can be expressed as a product of primes uniquely.",
          "HCF(a, b) × LCM(a, b) = a × b for any two positive integers.",
          "If p is a prime and p divides a², then p divides a.",
        ],
        formulas: ["a = bq + r (0 ≤ r < b)", "HCF(a,b) × LCM(a,b) = a × b"],
      },
      {
        id: "m-02",
        num: "02",
        title: "Polynomials",
        hindiTitle: "बहुपद",
        topicsCount: 3,
        summary: "Geometrical meaning of zeroes, relationship between zeroes and coefficients of quadratic polynomials.",
        keyPoints: [
          "A polynomial of degree n can have at most n zeroes.",
          "For quadratic ax² + bx + c: Sum of zeroes (α + β) = -b/a, Product of zeroes (αβ) = c/a.",
        ],
        formulas: ["α + β = -b/a", "αβ = c/a", "p(x) = k[x² - (α+β)x + αβ]"],
      },
      {
        id: "m-03",
        num: "03",
        title: "Pair of Linear Equations in Two Variables",
        hindiTitle: "दो चरों वाले रैखिक समीकरण युग्म",
        topicsCount: 5,
        summary: "Graphical method, substitution method, elimination method, and algebraic conditions for consistency.",
        keyPoints: [
          "a₁/a₂ ≠ b₁/b₂: Unique solution (Intersecting lines, Consistent).",
          "a₁/a₂ = b₁/b₂ = c₁/c₂: Infinitely many solutions (Coincident lines).",
          "a₁/a₂ = b₁/b₂ ≠ c₁/c₂: No solution (Parallel lines, Inconsistent).",
        ],
        formulas: ["a₁x + b₁y + c₁ = 0", "a₂x + b₂y + c₂ = 0"],
      },
      {
        id: "m-04",
        num: "04",
        title: "Quadratic Equations",
        hindiTitle: "द्विघात समीकरण",
        topicsCount: 4,
        summary: "Standard form ax² + bx + c = 0, solution by factorisation and quadratic formula, nature of roots.",
        keyPoints: [
          "Discriminant D = b² - 4ac determines root nature.",
          "D > 0: Two distinct real roots; D = 0: Two equal real roots; D < 0: No real roots.",
        ],
        formulas: ["x = [-b ± √(b² - 4ac)] / (2a)", "D = b² - 4ac"],
      },
      {
        id: "m-05",
        num: "05",
        title: "Arithmetic Progressions",
        hindiTitle: "समांतर श्रेढ़ी",
        topicsCount: 4,
        summary: "General term of an AP, sum of first n terms, practical applications in daily life problems.",
        keyPoints: [
          "Common difference d = aₙ - aₙ₋₁ can be positive, negative, or zero.",
          "n-th term: aₙ = a + (n - 1)d.",
          "Sum of n terms: Sₙ = (n/2)[2a + (n - 1)d] = (n/2)[a + l].",
        ],
        formulas: ["aₙ = a + (n - 1)d", "Sₙ = n/2 [2a + (n - 1)d]", "Sₙ = n/2 [a + l]"],
      },
      {
        id: "m-06",
        num: "06",
        title: "Triangles",
        hindiTitle: "त्रिभुज",
        topicsCount: 5,
        summary: "Similarity of triangles, Thales Theorem (Basic Proportionality Theorem), criteria for similarity (AAA, SAS, SSS).",
        keyPoints: [
          "Two triangles are similar if corresponding angles are equal and corresponding sides are in proportion.",
          "BPT (Thales): If a line is drawn parallel to one side of a triangle, it divides the other two sides in the same ratio.",
        ],
        formulas: ["AD/DB = AE/EC (Thales Theorem)", "ar(ABC)/ar(PQR) = (AB/PQ)²"],
      },
      {
        id: "m-07",
        num: "07",
        title: "Coordinate Geometry",
        hindiTitle: "निर्देशांक ज्यामिति",
        topicsCount: 3,
        summary: "Distance formula, section formula (internal division), midpoint formula.",
        keyPoints: [
          "Distance between (x₁, y₁) and (x₂, y₂) is √[(x₂ - x₁)² + (y₂ - y₁)²].",
          "Section formula: [(m₁x₂ + m₂x₁)/(m₁ + m₂), (m₁y₂ + m₂y₁)/(m₁ + m₂)].",
        ],
        formulas: ["d = √[(x₂-x₁)² + (y₂-y₁)²]", "P(x,y) = [(m₁x₂+m₂x₁)/(m₁+m₂), (m₁y₂+m₂y₁)/(m₁+m₂)]"],
      },
      {
        id: "m-08",
        num: "08",
        title: "Introduction to Trigonometry",
        hindiTitle: "त्रिकोणमिति का परिचय",
        topicsCount: 4,
        summary: "Trigonometric ratios of acute angles, values of trigonometric ratios at 0°, 30°, 45°, 60°, 90°, trigonometric identities.",
        keyPoints: [
          "sin θ = P/H, cos θ = B/H, tan θ = P/B.",
          "sin²θ + cos²θ = 1, 1 + tan²θ = sec²θ, 1 + cot²θ = cosec²θ.",
        ],
        formulas: ["sin²θ + cos²θ = 1", "sec²θ - tan²θ = 1", "cosec²θ - cot²θ = 1"],
      },
    ],
  },
  {
    id: "physics",
    name: "Physics",
    hindiName: "भौतिक विज्ञान",
    chaptersCount: 5,
    videosCount: 180,
    questionsCount: 950,
    testsCount: 95,
    icon: Atom,
    gradient: "from-blue-600 to-indigo-700",
    accentColor: "bg-blue-50 text-blue-700 border-blue-200",
    chapters: [
      {
        id: "p-01",
        num: "01",
        title: "Light: Reflection and Refraction",
        hindiTitle: "प्रकाश: परावर्तन तथा अपवर्तन",
        topicsCount: 4,
        summary: "Reflection of light by spherical mirrors, image formation, mirror formula, refraction, Snell's Law, lens formula.",
        keyPoints: [
          "Mirror Formula: 1/f = 1/v + 1/u; Magnification: m = -v/u = h'/h.",
          "Snell's Law: sin i / sin r = constant (n₂₁).",
          "Lens Formula: 1/f = 1/v - 1/u; Power of lens: P = 1/f (in meters).",
        ],
        formulas: ["1/f = 1/v + 1/u", "1/f = 1/v - 1/u", "P = 1/f (Dioptre)"],
      },
      {
        id: "p-02",
        num: "02",
        title: "Human Eye and Colourful World",
        hindiTitle: "मानव नेत्र तथा रंगबिरंगा संसार",
        topicsCount: 4,
        summary: "Functioning of human eye, defects of vision (myopia, hypermetropia, presbyopia) and correction, dispersion of light through a prism.",
        keyPoints: [
          "Myopia is corrected by concave lens; Hypermetropia by convex lens.",
          "Twinkling of stars is due to atmospheric refraction.",
          "Blue colour of sky is due to Rayleigh scattering.",
        ],
        formulas: ["Refractive index through prism: μ = sin((A + Dm)/2) / sin(A/2)"],
      },
      {
        id: "p-03",
        num: "03",
        title: "Electricity",
        hindiTitle: "विद्युत",
        topicsCount: 5,
        summary: "Electric current, potential difference, Ohm's law, resistance, factors affecting resistance, series and parallel combination.",
        keyPoints: [
          "Ohm's Law: V = IR at constant temperature.",
          "Resistance in series: R = R₁ + R₂ + R₃; in parallel: 1/R = 1/R₁ + 1/R₂ + 1/R₃.",
          "Joule's law of heating: H = I²Rt.",
        ],
        formulas: ["V = IR", "R = ρ(L/A)", "H = I²Rt = VIt = (V²/R)t", "P = VI = I²R"],
      },
      {
        id: "p-04",
        num: "04",
        title: "Magnetic Effects of Electric Current",
        hindiTitle: "विद्युत धारा के चुंबकीय प्रभाव",
        topicsCount: 4,
        summary: "Magnetic field and field lines, field due to current-carrying conductor, solenoid, Fleming's Left-Hand Rule, electromagnetic induction.",
        keyPoints: [
          "Right-hand thumb rule gives magnetic field direction.",
          "Fleming's Left-Hand Rule is used for electric motors (Force, Magnetic field, Current).",
          "Earth wire protects users from electric shocks.",
        ],
        formulas: ["F = BIl sin θ"],
      },
    ],
  },
  {
    id: "chemistry",
    name: "Chemistry",
    hindiName: "रसायन शास्त्र",
    chaptersCount: 5,
    videosCount: 160,
    questionsCount: 890,
    testsCount: 85,
    icon: FlaskConical,
    gradient: "from-emerald-500 to-teal-700",
    accentColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    chapters: [
      {
        id: "c-01",
        num: "01",
        title: "Chemical Reactions and Equations",
        hindiTitle: "रासायनिक अभिक्रियाएं एवं समीकरण",
        topicsCount: 4,
        summary: "Chemical equation, balancing chemical equations, types of chemical reactions (combination, decomposition, displacement, double displacement, redox).",
        keyPoints: [
          "Balancing satisfies the Law of Conservation of Mass.",
          "Oxidation is gain of oxygen or loss of hydrogen; Reduction is loss of oxygen or gain of hydrogen.",
        ],
        formulas: ["2H₂ + O₂ → 2H₂O", "CaCO₃ → CaO + CO₂"],
      },
      {
        id: "c-02",
        num: "02",
        title: "Acids, Bases and Salts",
        hindiTitle: "अम्ल, क्षारक एवं लवण",
        topicsCount: 4,
        summary: "Definition in terms of furnishing of H+ and OH- ions, chemical properties, neutralization reaction, pH scale, importance of pH in everyday life.",
        keyPoints: [
          "pH < 7 is acidic; pH = 7 is neutral; pH > 7 is basic.",
          "Bleaching powder: CaOCl₂; Baking soda: NaHCO₃; Washing soda: Na₂CO₃·10H₂O; Plaster of Paris: CaSO₄·½H₂O.",
        ],
        formulas: ["pH = -log[H⁺]", "Acid + Base → Salt + Water"],
      },
      {
        id: "c-03",
        num: "03",
        title: "Metals and Non-metals",
        hindiTitle: "धातु एवं अधातु",
        topicsCount: 4,
        summary: "Properties of metals and non-metals, reactivity series, formation and properties of ionic compounds, metallurgy, corrosion.",
        keyPoints: [
          "Cinnabar (HgS) is ore of Mercury.",
          "Ionic compounds have high melting and boiling points and conduct electricity in molten state.",
        ],
        formulas: ["2ZnS + 3O₂ → 2ZnO + 2SO₂ (Roasting)"],
      },
    ],
  },
  {
    id: "biology",
    name: "Biology",
    hindiName: "जीव विज्ञान",
    chaptersCount: 4,
    videosCount: 140,
    questionsCount: 780,
    testsCount: 70,
    icon: Dna,
    gradient: "from-teal-600 to-cyan-700",
    accentColor: "bg-teal-50 text-teal-700 border-teal-200",
    chapters: [
      {
        id: "b-01",
        num: "01",
        title: "Life Processes",
        hindiTitle: "जैव प्रक्रम",
        topicsCount: 4,
        summary: "Nutrition (autotrophic & heterotrophic), Respiration (aerobic & anaerobic), Transportation in human beings and plants, Excretion in humans and plants.",
        keyPoints: [
          "Photosynthesis equation: 6CO₂ + 12H₂O → C₆H₁₂O₆ + 6O₂ + 6H₂O.",
          "Nephron is the basic filtration unit of kidney.",
          "Xylem transports water; Phloem transports food.",
        ],
        formulas: ["Aerobic: Glucose → Pyruvate → 6CO₂ + 6H₂O + Energy (38 ATP)"],
      },
      {
        id: "b-02",
        num: "02",
        title: "Control and Coordination",
        hindiTitle: "नियंत्रण एवं समन्वय",
        topicsCount: 3,
        summary: "Tropic movements in plants, plant hormones (Auxin, Gibberellin, Cytokinin, Abscisic acid), nervous system in animals, reflex arc, human brain.",
        keyPoints: [
          "Neuron is the structural and functional unit of nervous system.",
          "Synapse is the junction between two neurons.",
          "Cerebrum controls voluntary actions and memory.",
        ],
        formulas: ["Receptor → Sensory Neuron → Spinal Cord → Motor Neuron → Effector"],
      },
    ],
  },
  {
    id: "social",
    name: "Social Science",
    hindiName: "सामाजिक विज्ञान",
    chaptersCount: 16,
    videosCount: 210,
    questionsCount: 1100,
    testsCount: 115,
    icon: Globe2,
    gradient: "from-rose-500 to-red-700",
    accentColor: "bg-rose-50 text-rose-700 border-rose-200",
    chapters: [
      {
        id: "ss-01",
        num: "01",
        title: "The Rise of Nationalism in Europe",
        hindiTitle: "यूरोप में राष्ट्रवाद का उदय",
        topicsCount: 4,
        summary: "French Revolution and idea of nation, making of nationalism in Europe, unification of Italy and Germany, visualising the nation.",
        keyPoints: [
          "Frederic Sorrieu prepared series of four prints visualising world of democratic republics.",
          "Civil Code of 1804 (Napoleonic Code) abolished privileges based on birth.",
        ],
        formulas: ["Zollverein: Customs union formed in 1834"],
      },
      {
        id: "ss-02",
        num: "02",
        title: "Nationalism in India",
        hindiTitle: "भारत में राष्ट्रवाद",
        topicsCount: 4,
        summary: "First World War, Khilafat and Non-Cooperation, differing strands within the movement, Salt March and Civil Disobedience Movement, sense of collective belonging.",
        keyPoints: [
          "Champaran Satyagraha (1917, Bihar) was Gandhiji's first satyagraha in India against indigo planters.",
          "Jallianwala Bagh massacre occurred on 13 April 1919.",
          "Dandi March started on 12 March 1930 with 78 volunteers.",
        ],
        formulas: ["Poona Pact (Sept 1932): Signed between Gandhi & Ambedkar"],
      },
    ],
  },
  {
    id: "hindi",
    name: "Hindi (गोधूलि)",
    hindiName: "हिंदी",
    chaptersCount: 12,
    videosCount: 95,
    questionsCount: 650,
    testsCount: 60,
    icon: BookMarked,
    gradient: "from-amber-600 to-yellow-700",
    accentColor: "bg-amber-50 text-amber-700 border-amber-200",
    chapters: [
      {
        id: "h-01",
        num: "01",
        title: "श्रम विभाजन और जाति प्रथा",
        hindiTitle: "डॉ. भीमराव अंबेडकर",
        topicsCount: 2,
        summary: "जाति प्रथा के दोष, आधुनिक सभ्य समाज में कार्यकुशलता के लिए श्रम विभाजन, और समता व बंधुत्व पर आधारित आदर्श समाज की परिकल्पना।",
        keyPoints: [
          "श्रम विभाजन स्वाभाविक नहीं है क्योंकि यह मनुष्य की रुचि पर आधारित नहीं है।",
          "सच्चा लोकतंत्र बंधुत्व और आपसी सम्मान की भावना पर टिका होता है।",
        ],
        formulas: ["'एनिहिलेशन ऑफ कास्ट' का हिंदी रूपांतरण"],
      },
    ],
  },
  {
    id: "english",
    name: "English (Panorama)",
    hindiName: "अंग्रेज़ी",
    chaptersCount: 10,
    videosCount: 85,
    questionsCount: 520,
    testsCount: 50,
    icon: Languages,
    gradient: "from-sky-600 to-blue-800",
    accentColor: "bg-sky-50 text-sky-700 border-sky-200",
    chapters: [
      {
        id: "e-01",
        num: "01",
        title: "The Pace for Living",
        hindiTitle: "R.C. Hutchinson",
        topicsCount: 2,
        summary: "Author's reflections on fast modern life, speed of travel, and how slow thinkers are handicapped in getting a living.",
        keyPoints: [
          "The author observed a corn merchant in Dublin who had many anxieties.",
          "Modern lifestyle moves at rapid velocity affecting contemplation.",
        ],
        formulas: ["Vocabulary: Anxieties, Contemplation, Sluggish"],
      },
    ],
  },
  {
    id: "sanskrit",
    name: "Sanskrit (पीयूषम्)",
    hindiName: "संस्कृत",
    chaptersCount: 14,
    videosCount: 75,
    questionsCount: 480,
    testsCount: 45,
    icon: Scroll,
    gradient: "from-orange-600 to-amber-800",
    accentColor: "bg-orange-50 text-orange-800 border-orange-200",
    chapters: [
      {
        id: "sk-01",
        num: "01",
        title: "मङ्गलम्",
        hindiTitle: "उपनिषदः श्लोकाः",
        topicsCount: 2,
        summary: "सत्यमेव जयते नानृतम् — सत्य का मुख हिरण्मय पात्र से ढका है। महर्षि वेदव्यास विरचित उपनिषदों से उद्धृत श्लोक।",
        keyPoints: [
          "हिरण्मयेन पात्रेण सत्यस्यापिहितं मुखम्।",
          "सत्य की ही जीत होती है, असत्य की नहीं।",
        ],
        formulas: ["ईशावास्योपनिषद्, कठोपनिषद्, मुण्डकोपनिषद्"],
      },
    ],
  },
  {
    id: "computer",
    name: "Computer Science",
    hindiName: "कंप्यूटर विज्ञान",
    chaptersCount: 8,
    videosCount: 60,
    questionsCount: 350,
    testsCount: 35,
    icon: Laptop,
    gradient: "from-purple-600 to-violet-800",
    accentColor: "bg-purple-50 text-purple-700 border-purple-200",
    chapters: [
      {
        id: "cs-01",
        num: "01",
        title: "Basics of Information Technology",
        hindiTitle: "सूचना प्रौद्योगिकी के मूल तत्व",
        topicsCount: 3,
        summary: "Computer fundamentals, operating systems, internet basics, cyber safety and ethical guidelines.",
        keyPoints: [
          "CPU consists of ALU, CU, and Registers.",
          "HTTP vs HTTPS security and protocols.",
        ],
        formulas: ["1 Byte = 8 bits, 1 KB = 1024 Bytes"],
      },
    ],
  },
];

export default function StudentDashboardPage() {
  const router = useRouter();
  const { teacher } = useAuth();
  const { firstName, gradeLabel } = useStudentData();

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("math");
  const [selectedClass, setSelectedClass] = useState<string>("Class 10 (Matric)");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeChapterModal, setActiveChapterModal] = useState<
    SubjectCategory["chapters"][0] | null
  >(null);

  const currentSubject =
    BIHAR_SUBJECTS.find((s) => s.id === selectedSubjectId) || BIHAR_SUBJECTS[0];

  const studentName = firstName || teacher?.full_name?.split(" ")[0] || "Student";

  const filteredChapters = currentSubject.chapters.filter(
    (c) =>
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.hindiTitle.includes(searchQuery),
  );

  return (
    <main className="flex flex-1 flex-col overflow-y-auto bg-slate-50/60 pb-16">
      {/* ─── Top Notification & Welcome Bar ─── */}
      <div className="border-b border-slate-200 bg-white px-4 py-3 sm:px-8">
        <div className="mx-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between max-w-7xl">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-orange-100 text-orange-600 font-bold text-lg shadow-xs">
              {studentName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-800">
                  Hello, {studentName}! 👋
                </h1>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                  Active Student
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Bihar State Government School Portal · Medha Digital Classroom
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Class Selector Dropdown */}
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs focus:border-blue-500 focus:outline-none"
            >
              <option value="Class 9 (Navam)">Class 9 (नवम वर्ग)</option>
              <option value="Class 10 (Matric)">Class 10 (दशम वर्ग - मैट्रिक)</option>
              <option value="Class 11 (Intermediate)">Class 11 (एकादश)</option>
              <option value="Class 12 (Intermediate)">Class 12 (द्वादश)</option>
            </select>

            {/* Daily Streak */}
            <div className="flex items-center gap-1.5 rounded-xl bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs font-bold text-amber-700">
              <Flame className="size-4 text-amber-500 fill-amber-500" />
              <span>5-Day Streak</span>
            </div>

            {/* Doubt Solve Shortcut */}
            <Link
              href="/doubts"
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition-colors"
            >
              <MessagesSquare className="size-3.5" />
              <span>Ask Doubt</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 pt-5 sm:px-8 space-y-6">
        {/* ─── Start Learning Header & Search ─── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              Start Learning
            </h2>
            <p className="text-xs text-slate-500">
              Master the concepts with interactive study materials & Bihar State syllabus
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search chapters & topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-4 text-xs shadow-xs focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* ─── Horizontal Subject Carousel / Icons (Extramarks Style) ─── */}
        <div className="no-scrollbar flex items-center gap-3 overflow-x-auto pb-2 pt-1">
          {BIHAR_SUBJECTS.map((sub) => {
            const Icon = sub.icon;
            const isSelected = sub.id === selectedSubjectId;
            return (
              <button
                key={sub.id}
                type="button"
                onClick={() => setSelectedSubjectId(sub.id)}
                className={`flex shrink-0 flex-col items-center justify-center rounded-2xl p-3.5 transition-all duration-200 min-w-[110px] text-center border ${
                  isSelected
                    ? "border-orange-500 bg-white shadow-md ring-2 ring-orange-500/20 scale-[1.03]"
                    : "border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50 shadow-xs"
                }`}
              >
                <div
                  className={`flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br ${sub.gradient} text-white shadow-xs mb-2 transition-transform duration-200 ${
                    isSelected ? "scale-105" : ""
                  }`}
                >
                  <Icon className="size-6" />
                </div>
                <span
                  className={`text-xs font-bold leading-tight ${
                    isSelected ? "text-slate-900" : "text-slate-700"
                  }`}
                >
                  {sub.name}
                </span>
                <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                  {sub.chaptersCount} Chapters
                </span>
              </button>
            );
          })}
        </div>

        {/* ─── Active Subject Banner (Extramarks Inspired Gradient Card) ─── */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-orange-600 via-amber-600 to-amber-700 p-6 text-white shadow-lg sm:p-8">
          <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="space-y-3 max-w-xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-md">
                <span>🌟 Bihar Board Class 10th Syllabus</span>
              </div>
              <h2 className="text-2xl font-black tracking-tight sm:text-3xl">
                {currentSubject.name} ({currentSubject.hindiName})
              </h2>
              <p className="text-xs text-white/90 leading-relaxed">
                Comprehensive chapter notes, animated video lectures, formula sheets & board model papers.
              </p>

              {/* Stats badges */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <div className="flex items-center gap-2 rounded-xl bg-black/20 px-3 py-1.5 text-xs font-semibold backdrop-blur-xs">
                  <PlayCircle className="size-4 text-amber-300" />
                  <span>{currentSubject.videosCount}+ Videos</span>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-black/20 px-3 py-1.5 text-xs font-semibold backdrop-blur-xs">
                  <HelpCircle className="size-4 text-orange-200" />
                  <span>{currentSubject.questionsCount}+ Questions</span>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-black/20 px-3 py-1.5 text-xs font-semibold backdrop-blur-xs">
                  <FileCheck2 className="size-4 text-emerald-300" />
                  <span>{currentSubject.testsCount}+ Chapter Tests</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (currentSubject.chapters[0]) {
                    setActiveChapterModal(currentSubject.chapters[0]);
                  }
                }}
                className="rounded-2xl bg-white px-5 py-3 text-xs font-bold text-orange-700 shadow-md hover:bg-orange-50 transition-all text-center"
              >
                Study Chapter 1 Notes →
              </button>
              <Link
                href="/practice"
                className="rounded-2xl bg-orange-950/40 border border-white/20 px-5 py-3 text-xs font-bold text-white hover:bg-orange-950/60 transition-all text-center"
              >
                Take Chapter Quiz 🎯
              </Link>
            </div>
          </div>

          {/* Decorative background circles */}
          <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-16 left-1/3 size-56 rounded-full bg-amber-400/20 blur-2xl" />
        </div>

        {/* ─── Bihar Board AIRTS / Open Test Banner ─── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 p-5 text-white shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Sparkles className="size-3.5" />
                State Level Preparation Series
              </span>
              <h3 className="text-base font-bold sm:text-lg">
                Bihar Board Matric & Inter Open Test Series 2026
              </h3>
              <p className="text-xs text-slate-300">
                Weekly mock tests matching Bihar School Examination Board (BSEB) question pattern.
              </p>
            </div>
            <Link
              href="/open-test"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-300 transition-colors shadow-xs"
            >
              Take Free Open Test <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>

        {/* ─── Select Chapter Section (Extramarks style chapter grid) ─── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-800">
              Select Chapter ({filteredChapters.length} Chapters in {currentSubject.name})
            </h3>
            <span className="text-xs font-medium text-slate-500">
              NCERT & Bihar State Board (BSEB) Aligned
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {filteredChapters.map((chap) => (
              <div
                key={chap.id}
                className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition-all hover:border-blue-400 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 font-mono text-xs font-bold text-slate-700 group-hover:bg-blue-50 group-hover:text-blue-700 transition-colors">
                      {chap.num}
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 group-hover:text-blue-700 transition-colors">
                        {chap.title}
                      </h4>
                      <p className="text-xs text-slate-500 font-medium">
                        {chap.hindiTitle}
                      </p>
                      <span className="mt-1 inline-block text-[11px] font-semibold text-slate-400">
                        {chap.topicsCount} Topics · Summary & Notes Included
                      </span>
                    </div>
                  </div>
                </div>

                {/* Chapter Actions */}
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => setActiveChapterModal(chap)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition-colors"
                  >
                    <BookOpen className="size-3.5" />
                    Study Material
                  </button>

                  <Link
                    href="/practice"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition-colors"
                  >
                    <PencilRuler className="size-3.5" />
                    Take Quiz
                  </Link>

                  <Link
                    href="/doubts"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
                  >
                    <HelpCircle className="size-3.5" />
                    Ask Doubt
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Chapter Study Material Modal / Drawer ─── */}
      <AnimatePresence>
        {activeChapterModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-3xl bg-white shadow-2xl overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-blue-700 to-indigo-800 px-6 py-4 text-white">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-200">
                    Chapter {activeChapterModal.num} · {currentSubject.name}
                  </span>
                  <h3 className="text-lg font-bold">
                    {activeChapterModal.title} ({activeChapterModal.hindiTitle})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveChapterModal(null)}
                  className="rounded-full bg-white/10 p-1.5 text-white hover:bg-white/20 transition-colors"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5 text-slate-700 text-xs sm:text-sm">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    अध्याय सारांश (Chapter Overview)
                  </h4>
                  <p className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 leading-relaxed">
                    {activeChapterModal.summary}
                  </p>
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                    <CheckCircle2 className="size-4 text-emerald-600" />
                    मुख्य संकल्पनाएं (Key Exam Points)
                  </h4>
                  <ul className="space-y-2">
                    {activeChapterModal.keyPoints.map((pt, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2.5 rounded-xl bg-emerald-50/50 p-2.5 border border-emerald-100 text-slate-800 text-xs"
                      >
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white font-bold text-[10px]">
                          {idx + 1}
                        </span>
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {activeChapterModal.formulas.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                      <Calculator className="size-4 text-amber-500" />
                      महत्वपूर्ण सूत्र (Key Formulas)
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {activeChapterModal.formulas.map((form, idx) => (
                        <div
                          key={idx}
                          className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 font-mono text-xs font-bold text-amber-900"
                        >
                          {form}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
                <Link
                  href="/doubts"
                  onClick={() => setActiveChapterModal(null)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <HelpCircle className="size-4 text-blue-600" />
                  Ask Doubt on this Chapter
                </Link>

                <div className="flex items-center gap-2">
                  <Link
                    href="/practice"
                    onClick={() => setActiveChapterModal(null)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-colors shadow-xs"
                  >
                    <PencilRuler className="size-4" />
                    Start Chapter Quiz
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
