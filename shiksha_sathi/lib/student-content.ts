/**
 * Hardcoded content for the student Practice / Notes / Library sections.
 * Frontend-only demo data -- no backend yet. Content is matched loosely to a
 * chapter title via `contentKeyFor()` so it lights up for the seeded Class 8
 * Science chapters and falls back gracefully everywhere else.
 */

export type ContentKey = "photosynthesis" | "friction" | "force";

export function contentKeyFor(title: string | null | undefined): ContentKey | null {
  const t = (title ?? "").toLowerCase();
  if (!t) return null;
  if (t.includes("photosynth") || t.includes("plant") || t.includes("food")) {
    return "photosynthesis";
  }
  if (t.includes("friction")) return "friction";
  if (t.includes("force") || t.includes("pressure")) return "force";
  return null;
}

// --------------------------------------------------------------- practice

export type PracticeQuestion = {
  q: string;
  options: string[];
  /** index into `options` */
  answer: number;
  explanation?: string;
};

export type PracticeSetSlug = "mock" | "quick" | "pyq";

export type PracticeSet = {
  slug: PracticeSetSlug;
  title: string;
  tag: string;
  minutes: number | null;
  blurb: string;
};

export const PRACTICE_SETS: PracticeSet[] = [
  {
    slug: "mock",
    title: "Chapter Mock Test",
    tag: "Mock",
    minutes: 20,
    blurb: "Full-length practice like the real exam. Timed, mixed difficulty.",
  },
  {
    slug: "quick",
    title: "Quick MCQs",
    tag: "Practice",
    minutes: null,
    blurb: "A short set to warm up. No timer -- check yourself as you go.",
  },
  {
    slug: "pyq",
    title: "Previous Year Questions",
    tag: "PYQ",
    minutes: 15,
    blurb: "Questions that have appeared in past BSEB papers for this chapter.",
  },
];

const PHOTOSYNTHESIS_Q: PracticeQuestion[] = [
  {
    q: "Which green pigment in leaves absorbs sunlight for photosynthesis?",
    options: ["Haemoglobin", "Chlorophyll", "Melanin", "Carotene"],
    answer: 1,
    explanation: "Chlorophyll, present in chloroplasts, traps light energy.",
  },
  {
    q: "The tiny pores on a leaf through which gases enter and leave are called:",
    options: ["Stomata", "Xylem", "Veins", "Cuticles"],
    answer: 0,
    explanation: "Stomata let carbon dioxide in and oxygen out.",
  },
  {
    q: "Which gas is taken in by plants during photosynthesis?",
    options: ["Oxygen", "Nitrogen", "Carbon dioxide", "Hydrogen"],
    answer: 2,
  },
  {
    q: "Photosynthesis mainly takes place in the:",
    options: ["Roots", "Stem", "Flowers", "Leaves"],
    answer: 3,
    explanation: "Leaves have the most chloroplasts, so they are the food factories.",
  },
  {
    q: "The food prepared by plants is stored in the form of:",
    options: ["Protein", "Starch", "Fat", "Vitamins"],
    answer: 1,
  },
  {
    q: "Which of these is NOT needed for photosynthesis?",
    options: ["Sunlight", "Water", "Carbon dioxide", "Soil bacteria"],
    answer: 3,
  },
  {
    q: "Plants that trap and eat insects (like the pitcher plant) do so to get:",
    options: ["Water", "Nitrogen", "Sunlight", "Oxygen"],
    answer: 1,
    explanation: "They grow in nitrogen-poor soil, so they get nitrogen from insects.",
  },
  {
    q: "Which gas is released into the air as a by-product of photosynthesis?",
    options: ["Carbon dioxide", "Oxygen", "Methane", "Ammonia"],
    answer: 1,
  },
  {
    q: "Water reaches the leaves from the roots through tubes called:",
    options: ["Phloem", "Stomata", "Xylem", "Arteries"],
    answer: 2,
  },
  {
    q: "The nutrition in which an organism makes its own food is called:",
    options: ["Heterotrophic", "Parasitic", "Autotrophic", "Saprophytic"],
    answer: 2,
  },
];

const FRICTION_Q: PracticeQuestion[] = [
  {
    q: "Friction always acts:",
    options: [
      "In the direction of motion",
      "Opposite to the direction of motion",
      "Downwards only",
      "Upwards only",
    ],
    answer: 1,
    explanation: "Friction opposes the relative motion between two surfaces.",
  },
  {
    q: "Friction is caused mainly by:",
    options: [
      "Gravity",
      "Irregularities on the surfaces in contact",
      "Air pressure",
      "Magnetism",
    ],
    answer: 1,
  },
  {
    q: "Which surface produces the most friction?",
    options: ["Wet glass", "Polished marble", "Rough sandpaper", "Oiled metal"],
    answer: 2,
  },
  {
    q: "To reduce friction between machine parts, we use:",
    options: ["Water", "Lubricants like oil", "Sand", "Glue"],
    answer: 1,
  },
  {
    q: "Which type of friction is the smallest for the same pair of surfaces?",
    options: ["Static friction", "Sliding friction", "Rolling friction", "They are equal"],
    answer: 2,
    explanation: "Rolling friction < sliding friction < static friction.",
  },
  {
    q: "The grooves (treads) on tyres are made to:",
    options: [
      "Look attractive",
      "Increase friction for better grip",
      "Reduce the weight",
      "Decrease friction",
    ],
    answer: 1,
  },
  {
    q: "Friction produces:",
    options: ["Cold", "Heat", "Light only", "Sound only"],
    answer: 1,
    explanation: "Rubbing hands together warms them -- friction converts work into heat.",
  },
  {
    q: "A ball rolled on grass stops sooner than on a road because grass has:",
    options: ["Less friction", "More friction", "No friction", "Negative friction"],
    answer: 1,
  },
  {
    q: "Which is an example where friction is useful?",
    options: [
      "Wearing out of shoe soles",
      "Applying brakes to stop a cycle",
      "Heating of machine parts",
      "Rusting of metal",
    ],
    answer: 1,
  },
  {
    q: "Sportspersons use spiked shoes to:",
    options: [
      "Reduce friction with the ground",
      "Increase friction with the ground",
      "Run slower",
      "Look professional",
    ],
    answer: 1,
  },
];

const FORCE_Q: PracticeQuestion[] = [
  {
    q: "A force can change:",
    options: [
      "Only the shape of an object",
      "Only the speed of an object",
      "The shape, speed and direction of an object",
      "Nothing at all",
    ],
    answer: 2,
  },
  {
    q: "Force per unit area is called:",
    options: ["Pressure", "Weight", "Density", "Friction"],
    answer: 0,
    explanation: "Pressure = force / area.",
  },
  {
    q: "A sharp knife cuts better than a blunt one because it has:",
    options: [
      "More force",
      "Smaller area, so more pressure",
      "Larger area, so more pressure",
      "Less weight",
    ],
    answer: 1,
  },
  {
    q: "The force between two objects that are not touching (like a magnet and a pin) is a:",
    options: ["Contact force", "Muscular force", "Non-contact force", "Frictional force"],
    answer: 2,
  },
  {
    q: "Liquids exert pressure on:",
    options: [
      "Only the bottom of the container",
      "Only the walls of the container",
      "The bottom and the walls of the container",
      "Nothing",
    ],
    answer: 2,
  },
  {
    q: "Atmospheric pressure is caused by the weight of:",
    options: ["Water", "Air above us", "Clouds only", "The ground"],
    answer: 1,
  },
  {
    q: "A wide strap on a heavy bag is more comfortable because it:",
    options: [
      "Increases the force",
      "Reduces the pressure by increasing area",
      "Increases the pressure",
      "Reduces the weight of the bag",
    ],
    answer: 1,
  },
  {
    q: "The SI unit of force is the:",
    options: ["Newton", "Pascal", "Joule", "Watt"],
    answer: 0,
  },
  {
    q: "Two forces acting on an object in opposite directions and equal in size will:",
    options: [
      "Add up",
      "Cancel each other (net force zero)",
      "Double the motion",
      "Turn the object",
    ],
    answer: 1,
  },
  {
    q: "Camels can walk on sand easily because their broad feet:",
    options: [
      "Increase pressure on the sand",
      "Decrease pressure on the sand",
      "Have no friction",
      "Are very light",
    ],
    answer: 1,
  },
];

const GENERIC_Q: PracticeQuestion[] = [
  {
    q: "Practice questions for this chapter are still being written.",
    options: [
      "Try the Ask Medha section for now",
      "Skip this chapter",
      "Wait forever",
      "Give up",
    ],
    answer: 0,
    explanation:
      "This is sample data. Real chapter-wise question banks will load here once the content is ready.",
  },
  {
    q: "Which section can answer your doubts on any chapter right now?",
    options: ["Library", "Ask Medha", "Attendance", "Profile"],
    answer: 1,
  },
  {
    q: "Where can you read chapter notes?",
    options: ["The Notes section", "The Practice section only", "Nowhere", "The Library only"],
    answer: 0,
  },
];

const BANK: Record<ContentKey, PracticeQuestion[]> = {
  photosynthesis: PHOTOSYNTHESIS_Q,
  friction: FRICTION_Q,
  force: FORCE_Q,
};

/** Questions for a chapter + practice-set combo. Mock uses the full bank,
 *  Quick uses the first few, PYQ shuffles a slice -- all deterministic. */
export function questionsFor(
  chapterTitle: string | null,
  set: PracticeSetSlug,
): PracticeQuestion[] {
  const key = contentKeyFor(chapterTitle);
  const bank = key ? BANK[key] : GENERIC_Q;
  if (set === "quick") return bank.slice(0, Math.min(5, bank.length));
  if (set === "pyq") return bank.slice(Math.max(0, bank.length - 6));
  return bank;
}

export function hasRealPractice(chapterTitle: string | null): boolean {
  return contentKeyFor(chapterTitle) !== null;
}

// --------------------------------------------------------------- notes

export type NoteDoc = {
  summary: string;
  keyPoints: string[];
  sections: { heading: string; body: string }[];
  glossary: { term: string; meaning: string }[];
};

const NOTES: Record<ContentKey, NoteDoc> = {
  photosynthesis: {
    summary:
      "Green plants make their own food using sunlight, water and carbon dioxide. This process is called photosynthesis and it releases the oxygen we breathe.",
    keyPoints: [
      "Photosynthesis happens mainly in the leaves, inside chloroplasts.",
      "Chlorophyll is the green pigment that traps sunlight.",
      "Raw materials: carbon dioxide (from air, through stomata) + water (from soil, through roots).",
      "Products: glucose (food, stored as starch) + oxygen (released to the air).",
      "Word equation: carbon dioxide + water --(sunlight, chlorophyll)--> glucose + oxygen.",
      "Organisms that make their own food are autotrophs; those that depend on others are heterotrophs.",
    ],
    sections: [
      {
        heading: "Why leaves are the food factory",
        body: "Leaves are flat and thin, so sunlight reaches most cells. They are packed with chloroplasts and covered with tiny pores called stomata that let carbon dioxide in and oxygen out. Water travels up from the roots through tube-like vessels (xylem).",
      },
      {
        heading: "Testing a leaf for starch",
        body: "Boil the leaf in water, then in alcohol to remove the green colour, wash it, and add iodine solution. A blue-black colour shows starch is present -- proof that photosynthesis happened.",
      },
      {
        heading: "Other modes of nutrition",
        body: "Some plants cannot make enough food. Insectivorous plants like the pitcher plant trap insects to get nitrogen. Parasitic plants like Cuscuta (amarbel) take food from a host. Fungi that grow on bread or pickle are saprotrophs -- they feed on dead, decaying matter.",
      },
      {
        heading: "Nutrients and the soil",
        body: "Plants also need nitrogen, phosphorus and other minerals from the soil. Rhizobium bacteria in the roots of pulses (legumes) fix nitrogen from the air, which is why farmers rotate crops with pulses.",
      },
    ],
    glossary: [
      { term: "Photosynthesis", meaning: "Making food from CO2 and water using light energy." },
      { term: "Chlorophyll", meaning: "Green pigment in chloroplasts that absorbs sunlight." },
      { term: "Stomata", meaning: "Tiny pores on leaves for gas exchange." },
      { term: "Autotroph", meaning: "An organism that makes its own food." },
      { term: "Saprotroph", meaning: "An organism that feeds on dead and decaying matter." },
    ],
  },
  friction: {
    summary:
      "Friction is the force that opposes motion between two surfaces in contact. It is caused by the roughness of surfaces and can be both a friend and a nuisance.",
    keyPoints: [
      "Friction always acts opposite to the direction of motion (or attempted motion).",
      "It is caused by irregularities on the two surfaces interlocking.",
      "Rougher surfaces and heavier objects produce more friction.",
      "Static friction (before motion) > sliding friction > rolling friction.",
      "Friction can be increased (treads on tyres, spikes on shoes) or reduced (oil, ball bearings, streamlining).",
      "Friction produces heat -- rubbing your palms warms them.",
    ],
    sections: [
      {
        heading: "Friend or foe?",
        body: "Useful friction: we can walk without slipping, write with a pen, and stop a bicycle with brakes. Harmful friction: it wears out shoe soles, machine parts and tyres, and wastes energy as heat.",
      },
      {
        heading: "Increasing and reducing friction",
        body: "Increase it with grooved tyres, rubber soles and gymnasts' powder. Reduce it with lubricants (oil, grease), by using wheels or ball bearings that convert sliding into rolling, and by giving vehicles a smooth streamlined shape to cut down fluid friction.",
      },
      {
        heading: "Fluid friction (drag)",
        body: "Air and water also oppose objects moving through them; this is called drag. Fast fish, birds and aeroplanes have a special shape so that fluids flow past them smoothly.",
      },
    ],
    glossary: [
      { term: "Friction", meaning: "Force that opposes relative motion between surfaces." },
      { term: "Lubricant", meaning: "A substance like oil that reduces friction." },
      { term: "Rolling friction", meaning: "The small friction when an object rolls over a surface." },
      { term: "Drag", meaning: "Friction due to air or water on a moving object." },
    ],
  },
  force: {
    summary:
      "A force is a push or a pull. It can change the speed, direction or shape of an object. Pressure is the force acting on a unit area.",
    keyPoints: [
      "Force has size and direction; the SI unit is the newton (N).",
      "Contact forces: muscular force, friction. Non-contact forces: gravity, magnetic force, electrostatic force.",
      "Net force = sum of forces; equal and opposite forces cancel out.",
      "Pressure = force / area. Smaller area means more pressure for the same force.",
      "Liquids and gases exert pressure on the bottom and the walls of their container.",
      "Atmospheric pressure is the weight of the air column above us.",
    ],
    sections: [
      {
        heading: "What a force can do",
        body: "Pushing a door changes its state of motion; squeezing dough changes its shape; hitting a moving ball changes its direction. A force is needed for any of these changes.",
      },
      {
        heading: "Pressure in daily life",
        body: "Knives, needles and nails are sharp (small area) so they give high pressure and cut or pierce easily. Wide foundations of buildings, broad tractor tyres and camel feet spread the load over a large area to lower the pressure on the ground.",
      },
      {
        heading: "Pressure in fluids",
        body: "Water pressure increases with depth, which is why dams are built thicker at the bottom. Air pressure lets us drink through a straw and holds a rubber sucker to a wall.",
      },
    ],
    glossary: [
      { term: "Force", meaning: "A push or a pull on an object." },
      { term: "Pressure", meaning: "Force acting per unit area (force / area)." },
      { term: "Contact force", meaning: "A force that acts only when objects touch." },
      { term: "Atmospheric pressure", meaning: "Pressure exerted by the weight of air around us." },
    ],
  },
};

export function noteFor(chapterTitle: string | null): NoteDoc | null {
  const key = contentKeyFor(chapterTitle);
  return key ? NOTES[key] : null;
}

// --------------------------------------------------------------- library

export type BookCategory =
  | "Textbook"
  | "Reference"
  | "Stories"
  | "Competitive"
  | "Magazine";

export type Book = {
  id: string;
  title: string;
  author: string;
  category: BookCategory;
  subject: string;
  classLabel: string;
  pages: number;
  blurb: string;
};

export const BOOK_CATEGORIES: BookCategory[] = [
  "Textbook",
  "Reference",
  "Stories",
  "Competitive",
  "Magazine",
];

export const LIBRARY_BOOKS: Book[] = [
  {
    id: "sci-8-bseb",
    title: "Science, Class 8",
    author: "Bihar State Textbook Corporation",
    category: "Textbook",
    subject: "Science",
    classLabel: "Class 8",
    pages: 214,
    blurb:
      "The prescribed BSEB science textbook -- crop production, microorganisms, friction, force and pressure, sound, light and more.",
  },
  {
    id: "math-8-bseb",
    title: "Ganit (Mathematics), Class 8",
    author: "Bihar State Textbook Corporation",
    category: "Textbook",
    subject: "Mathematics",
    classLabel: "Class 8",
    pages: 268,
    blurb: "Rational numbers, linear equations, quadrilaterals, mensuration and data handling with solved examples.",
  },
  {
    id: "sst-8-bseb",
    title: "Samajik Vigyan (Social Science), Class 8",
    author: "Bihar State Textbook Corporation",
    category: "Textbook",
    subject: "Social Science",
    classLabel: "Class 8",
    pages: 240,
    blurb: "History, geography and civics for Class 8 -- the modern period, resources, and the Indian Constitution.",
  },
  {
    id: "eng-8-radiance",
    title: "Radiance English Reader, Class 8",
    author: "BSEB",
    category: "Textbook",
    subject: "English",
    classLabel: "Class 8",
    pages: 176,
    blurb: "Prose and poetry with comprehension, grammar and writing practice.",
  },
  {
    id: "sci-lab-manual",
    title: "Science Lab Manual & Activities",
    author: "NCERT",
    category: "Reference",
    subject: "Science",
    classLabel: "Class 6-8",
    pages: 132,
    blurb: "Step-by-step experiments you can do with simple materials at home or in a low-resource classroom.",
  },
  {
    id: "atlas",
    title: "Oxford Student Atlas for India",
    author: "Oxford University Press",
    category: "Reference",
    subject: "Geography",
    classLabel: "All classes",
    pages: 168,
    blurb: "Physical and political maps of India and the world, with thematic maps on climate, crops and population.",
  },
  {
    id: "grammar-wren",
    title: "High School English Grammar & Composition",
    author: "Wren & Martin",
    category: "Reference",
    subject: "English",
    classLabel: "Class 6-10",
    pages: 480,
    blurb: "The classic grammar reference -- tenses, voice, narration, and essay and letter writing.",
  },
  {
    id: "dict-hindi-eng",
    title: "Rajpal Hindi-English Dictionary",
    author: "Rajpal & Sons",
    category: "Reference",
    subject: "Language",
    classLabel: "All classes",
    pages: 620,
    blurb: "A pocket bilingual dictionary for quick word look-ups while reading and writing.",
  },
  {
    id: "panchatantra",
    title: "Panchatantra ki Kahaniyan",
    author: "Vishnu Sharma (retold)",
    category: "Stories",
    subject: "Hindi",
    classLabel: "Class 5-8",
    pages: 144,
    blurb: "Timeless animal fables about wisdom, friendship and cleverness.",
  },
  {
    id: "premchand",
    title: "Premchand ki Lokpriya Kahaniyan",
    author: "Munshi Premchand",
    category: "Stories",
    subject: "Hindi",
    classLabel: "Class 8-10",
    pages: 198,
    blurb: "Idgah, Panch Parmeshwar, Boodhi Kaki and other stories of village life.",
  },
  {
    id: "malgudi",
    title: "Swami and Friends",
    author: "R. K. Narayan",
    category: "Stories",
    subject: "English",
    classLabel: "Class 7-9",
    pages: 176,
    blurb: "The adventures of Swami and his friends in the small town of Malgudi.",
  },
  {
    id: "wings-of-fire",
    title: "Wings of Fire (Abridged)",
    author: "A. P. J. Abdul Kalam",
    category: "Stories",
    subject: "Biography",
    classLabel: "Class 8-10",
    pages: 160,
    blurb: "How a newspaper boy from Rameswaram became a scientist and the President of India.",
  },
  {
    id: "ntse-guide",
    title: "NTSE / NMMS Practice Guide",
    author: "Arihant Experts",
    category: "Competitive",
    subject: "Aptitude",
    classLabel: "Class 8",
    pages: 356,
    blurb: "Mental ability and scholastic aptitude practice for the National Means-cum-Merit Scholarship exam.",
  },
  {
    id: "olympiad-sci",
    title: "Science Olympiad Workbook, Class 8",
    author: "MTG Learning Media",
    category: "Competitive",
    subject: "Science",
    classLabel: "Class 8",
    pages: 144,
    blurb: "Chapter-wise MCQs, HOTS questions and previous years' olympiad papers.",
  },
  {
    id: "maths-challenge",
    title: "Mathematics Challenge Problems",
    author: "RMO Foundation",
    category: "Competitive",
    subject: "Mathematics",
    classLabel: "Class 8-10",
    pages: 220,
    blurb: "Puzzle-style problems in number theory, geometry and combinatorics to stretch your thinking.",
  },
  {
    id: "chandamama",
    title: "Chandamama -- Collected Issues",
    author: "Chandamama India",
    category: "Magazine",
    subject: "General",
    classLabel: "Class 4-8",
    pages: 96,
    blurb: "Folk tales, science snippets and puzzles from the beloved children's magazine.",
  },
  {
    id: "science-reporter",
    title: "Science Reporter",
    author: "CSIR-NIScPR",
    category: "Magazine",
    subject: "Science",
    classLabel: "Class 8+",
    pages: 60,
    blurb: "Monthly popular-science articles on space, health, technology and the environment.",
  },
  {
    id: "gk-yearbook",
    title: "Manorama Yearbook (Student Edition)",
    author: "Malayala Manorama",
    category: "Reference",
    subject: "General Knowledge",
    classLabel: "All classes",
    pages: 520,
    blurb: "Current affairs, country profiles, science facts and sports records in one volume.",
  },
];
