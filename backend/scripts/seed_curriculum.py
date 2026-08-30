"""Phase 1 curriculum seed: BSEB / NCERT chapters (and a few topics) so the
dashboard's Chapter/Topic selectors and the "My Modules" chapter browser have
realistic data to show. No textbook content chunks -- retrieval degrades
gracefully without them (see docs/phase-1/04). Run seed_phase0.py first (it
creates the grades and the Science / Social Science subjects).

Covers Classes 6-10 for Science, Social Science, Mathematics, English and Hindi.
Mathematics / English / Hindi are created here if missing.

Idempotent: matches on each table's natural key
(subjects: name+board, chapters: subject+grade+chapter_number,
topics: chapter+title), so it is safe to re-run and safe to run against a
database that already has the older, smaller seed.

Usage:
    uv run python scripts/seed_curriculum.py
    DATABASE_URL=<url> uv run python scripts/seed_curriculum.py
"""

from sqlalchemy.orm import Session

from backend.db.models import CurriculumChapter, CurriculumTopic, Grade, Subject
from backend.db.session import SessionLocal, engine

BOARD = "BSEB"

# Subjects to ensure exist. "Science" and "Social Science" are created by
# seed_phase0.py; the rest are created here.
SUBJECTS = ["Science", "Social Science", "Mathematics", "English", "Hindi"]

# A handful of chapters carry real sub-topics (kept from the original seed so a
# re-run still guarantees them). Everything else is chapter-only -- a topic is
# optional and the app works fine without one.
TOPICS: dict[tuple[str, int, str], list[str]] = {
    ("Science", 7, "Nutrition in Plants"): [
        "Autotrophic Nutrition",
        "Parasitic and Insectivorous Plants",
    ],
    ("Science", 7, "Heat"): ["Conduction, Convection and Radiation"],
    ("Science", 8, "How Plants Make Their Food"): [
        "Photosynthesis: How Green Plants Prepare Food",
    ],
    ("Science", 8, "Force and Pressure"): [
        "Contact and Non-contact Forces",
        "Pressure Exerted by Fluids",
    ],
    ("Science", 8, "Friction"): ["Friction: Factors and Effects"],
    ("Social Science", 6, "Understanding Diversity"): ["Diversity in India"],
    ("Science", 10, "Life Processes"): [
        "Nutrition",
        "Respiration",
        "Transportation",
        "Excretion",
    ],
    ("Mathematics", 10, "Introduction to Trigonometry"): [
        "Trigonometric Ratios",
        "Trigonometric Identities",
    ],
}

# (subject, grade numeric_level) -> ordered chapter titles.
# chapter_number is the 1-based position in the list. The first few entries for
# Science C7/C8 and Social Science C6 are pinned so they line up with rows the
# older seed already created.
CHAPTERS: dict[tuple[str, int], list[str]] = {
    # ---------------------------------------------------------------- Science
    ("Science", 6): [
        "Food: Where Does It Come From?",
        "Components of Food",
        "Fibre to Fabric",
        "Sorting Materials into Groups",
        "Separation of Substances",
        "Changes Around Us",
        "Getting to Know Plants",
        "Body Movements",
        "The Living Organisms and Their Surroundings",
        "Motion and Measurement of Distances",
        "Light, Shadows and Reflections",
        "Electricity and Circuits",
        "Fun with Magnets",
        "Water",
        "Air Around Us",
        "Garbage In, Garbage Out",
    ],
    ("Science", 7): [
        "Nutrition in Plants",  # pinned #1
        "Nutrition in Animals",
        "Fibre to Fabric",
        "Heat",  # pinned #4
        "Acids, Bases and Salts",
        "Physical and Chemical Changes",
        "Weather, Climate and Adaptations of Animals to Climate",
        "Winds, Storms and Cyclones",
        "Soil",
        "Respiration in Organisms",
        "Transportation in Animals and Plants",
        "Reproduction in Plants",
        "Motion and Time",
        "Electric Current and Its Effects",
        "Light",
        "Water: A Precious Resource",
        "Forests: Our Lifeline",
        "Wastewater Story",
    ],
    ("Science", 8): [
        "How Plants Make Their Food",  # pinned #1 (from seed_phase0)
        "Force and Pressure",  # pinned #2
        "Friction",  # pinned #3
        "Crop Production and Management",
        "Microorganisms: Friend and Foe",
        "Synthetic Fibres and Plastics",
        "Materials: Metals and Non-Metals",
        "Coal and Petroleum",
        "Combustion and Flame",
        "Conservation of Plants and Animals",
        "Cell — Structure and Functions",
        "Reproduction in Animals",
        "Reaching the Age of Adolescence",
        "Sound",
        "Chemical Effects of Electric Current",
        "Some Natural Phenomena",
        "Light",
        "Stars and the Solar System",
        "Pollution of Air and Water",
    ],
    ("Science", 9): [
        "Matter in Our Surroundings",
        "Is Matter Around Us Pure?",
        "Atoms and Molecules",
        "Structure of the Atom",
        "The Fundamental Unit of Life",
        "Tissues",
        "Diversity in Living Organisms",
        "Motion",
        "Force and Laws of Motion",
        "Gravitation",
        "Work and Energy",
        "Sound",
        "Why Do We Fall Ill",
        "Natural Resources",
        "Improvement in Food Resources",
    ],
    ("Science", 10): [
        "Chemical Reactions and Equations",
        "Acids, Bases and Salts",
        "Metals and Non-metals",
        "Carbon and its Compounds",
        "Periodic Classification of Elements",
        "Life Processes",
        "Control and Coordination",
        "How do Organisms Reproduce?",
        "Heredity and Evolution",
        "Light – Reflection and Refraction",
        "The Human Eye and the Colourful World",
        "Electricity",
        "Magnetic Effects of Electric Current",
        "Sources of Energy",
        "Our Environment",
        "Management of Natural Resources",
    ],
    # -------------------------------------------------------- Social Science
    ("Social Science", 6): [
        "Understanding Diversity",  # pinned #1
        "Diversity and Discrimination",
        "What is Government?",
        "Key Elements of a Democratic Government",
        "Panchayati Raj",
        "Rural Administration",
        "Urban Administration",
        "Rural Livelihoods",
        "Urban Livelihoods",
        "What, Where, How and When?",
        "From Hunting–Gathering to Growing Food",
        "In the Earliest Cities",
        "What Books and Burials Tell Us",
        "Kingdoms, Kings and an Early Republic",
        "New Questions and Ideas",
        "From a Kingdom to an Empire",
        "Villages, Towns and Trade",
        "New Empires and Kingdoms",
        "Buildings, Paintings and Books",
        "The Earth in the Solar System",
        "Globe: Latitudes and Longitudes",
        "Motions of the Earth",
        "Maps",
        "Major Domains of the Earth",
        "Major Landforms of the Earth",
        "Our Country – India",
        "India: Climate, Vegetation and Wildlife",
    ],
    ("Social Science", 7): [
        "Tracing Changes Through a Thousand Years",
        "New Kings and Kingdoms",
        "The Delhi Sultans",
        "The Mughal Empire",
        "Rulers and Buildings",
        "Towns, Traders and Craftspersons",
        "Tribes, Nomads and Settled Communities",
        "Devotional Paths to the Divine",
        "The Making of Regional Cultures",
        "Eighteenth-Century Political Formations",
        "Environment",
        "Inside Our Earth",
        "Our Changing Earth",
        "Air",
        "Water",
        "Natural Vegetation and Wildlife",
        "Human Environment – Settlement, Transport and Communication",
        "Life in the Deserts",
        "On Equality",
        "Role of the Government in Health",
        "How the State Government Works",
        "Growing up as Boys and Girls",
        "Women Change the World",
        "Understanding Media",
        "Markets Around Us",
        "A Shirt in the Market",
    ],
    ("Social Science", 8): [
        "How, When and Where",
        "From Trade to Territory",
        "Ruling the Countryside",
        "Tribals, Dikus and the Vision of a Golden Age",
        "When People Rebel – 1857 and After",
        "Weavers, Iron Smelters and Factory Owners",
        "Civilising the “Native”, Educating the Nation",
        "Women, Caste and Reform",
        "The Making of the National Movement: 1870s–1947",
        "India After Independence",
        "Resources",
        "Land, Soil, Water, Natural Vegetation and Wildlife Resources",
        "Mineral and Power Resources",
        "Agriculture",
        "Industries",
        "Human Resources",
        "The Indian Constitution",
        "Understanding Secularism",
        "Why Do We Need a Parliament?",
        "Understanding Laws",
        "Judiciary",
        "Understanding Our Criminal Justice System",
        "Understanding Marginalisation",
        "Confronting Marginalisation",
        "Public Facilities",
        "Law and Social Justice",
    ],
    ("Social Science", 9): [
        "The French Revolution",
        "Socialism in Europe and the Russian Revolution",
        "Nazism and the Rise of Hitler",
        "Forest Society and Colonialism",
        "Pastoralists in the Modern World",
        "India – Size and Location",
        "Physical Features of India",
        "Drainage",
        "Climate",
        "Natural Vegetation and Wildlife",
        "Population",
        "What is Democracy? Why Democracy?",
        "Constitutional Design",
        "Electoral Politics",
        "Working of Institutions",
        "Democratic Rights",
        "The Story of Village Palampur",
        "People as Resource",
        "Poverty as a Challenge",
        "Food Security in India",
    ],
    ("Social Science", 10): [
        "The Rise of Nationalism in Europe",
        "Nationalism in India",
        "The Making of a Global World",
        "The Age of Industrialisation",
        "Print Culture and the Modern World",
        "Resources and Development",
        "Forest and Wildlife Resources",
        "Water Resources",
        "Agriculture",
        "Minerals and Energy Resources",
        "Manufacturing Industries",
        "Lifelines of National Economy",
        "Power-sharing",
        "Federalism",
        "Gender, Religion and Caste",
        "Political Parties",
        "Outcomes of Democracy",
        "Development",
        "Sectors of the Indian Economy",
        "Money and Credit",
        "Globalisation and the Indian Economy",
        "Consumer Rights",
    ],
    # ----------------------------------------------------------- Mathematics
    ("Mathematics", 6): [
        "Knowing Our Numbers",
        "Whole Numbers",
        "Playing with Numbers",
        "Basic Geometrical Ideas",
        "Understanding Elementary Shapes",
        "Integers",
        "Fractions",
        "Decimals",
        "Data Handling",
        "Mensuration",
        "Algebra",
        "Ratio and Proportion",
        "Symmetry",
        "Practical Geometry",
    ],
    ("Mathematics", 7): [
        "Integers",
        "Fractions and Decimals",
        "Data Handling",
        "Simple Equations",
        "Lines and Angles",
        "The Triangle and its Properties",
        "Congruence of Triangles",
        "Comparing Quantities",
        "Rational Numbers",
        "Practical Geometry",
        "Perimeter and Area",
        "Algebraic Expressions",
        "Exponents and Powers",
        "Symmetry",
        "Visualising Solid Shapes",
    ],
    ("Mathematics", 8): [
        "Rational Numbers",
        "Linear Equations in One Variable",
        "Understanding Quadrilaterals",
        "Practical Geometry",
        "Data Handling",
        "Squares and Square Roots",
        "Cubes and Cube Roots",
        "Comparing Quantities",
        "Algebraic Expressions and Identities",
        "Visualising Solid Shapes",
        "Mensuration",
        "Exponents and Powers",
        "Direct and Inverse Proportions",
        "Factorisation",
        "Introduction to Graphs",
        "Playing with Numbers",
    ],
    ("Mathematics", 9): [
        "Number Systems",
        "Polynomials",
        "Coordinate Geometry",
        "Linear Equations in Two Variables",
        "Introduction to Euclid's Geometry",
        "Lines and Angles",
        "Triangles",
        "Quadrilaterals",
        "Areas of Parallelograms and Triangles",
        "Circles",
        "Constructions",
        "Heron's Formula",
        "Surface Areas and Volumes",
        "Statistics",
        "Probability",
    ],
    ("Mathematics", 10): [
        "Real Numbers",
        "Polynomials",
        "Pair of Linear Equations in Two Variables",
        "Quadratic Equations",
        "Arithmetic Progressions",
        "Triangles",
        "Coordinate Geometry",
        "Introduction to Trigonometry",
        "Some Applications of Trigonometry",
        "Circles",
        "Constructions",
        "Areas Related to Circles",
        "Surface Areas and Volumes",
        "Statistics",
        "Probability",
    ],
    # --------------------------------------------------------------- English
    ("English", 6): [
        "Who Did Patrick's Homework?",
        "How the Dog Found Himself a New Master!",
        "Taro's Reward",
        "An Indian-American Woman in Space: Kalpana Chawla",
        "A Different Kind of School",
        "Who I Am",
        "Fair Play",
        "A Game of Chance",
        "Desert Animals",
        "The Banyan Tree",
    ],
    ("English", 7): [
        "Three Questions",
        "A Gift of Chappals",
        "Gopal and the Hilsa Fish",
        "The Ashes That Made Trees Bloom",
        "Quality",
        "Expert Detectives",
        "The Invention of Vita-Wonk",
        "Fire: Friend and Foe",
        "A Bicycle in Good Repair",
        "The Story of Cricket",
    ],
    ("English", 8): [
        "The Best Christmas Present in the World",
        "The Tsunami",
        "Glimpses of the Past",
        "Bepin Choudhury's Lapse of Memory",
        "The Summit Within",
        "This is Jody's Fawn",
        "A Visit to Cambridge",
        "A Short Monsoon Diary",
        "The Great Stone Face",
    ],
    ("English", 9): [
        "The Fun They Had",
        "The Sound of Music",
        "The Little Girl",
        "A Truly Beautiful Mind",
        "The Snake and the Mirror",
        "My Childhood",
        "Reach for the Top",
        "Kathmandu",
        "If I Were You",
    ],
    ("English", 10): [
        "A Letter to God",
        "Nelson Mandela: Long Walk to Freedom",
        "Two Stories about Flying",
        "From the Diary of Anne Frank",
        "The Hundred Dresses",
        "Glimpses of India",
        "Mijbil the Otter",
        "Madam Rides the Bus",
        "The Sermon at Benares",
        "The Proposal",
    ],
    # ----------------------------------------------------------------- Hindi
    ("Hindi", 6): [
        "वह चिड़िया जो",
        "बचपन",
        "नादान दोस्त",
        "चाँद से थोड़ी-सी गप्पें",
        "अक्षरों का महत्व",
        "पार नज़र के",
        "साथी हाथ बढ़ाना",
        "ऐसे-ऐसे",
        "टिकट-अलबम",
        "झाँसी की रानी",
    ],
    ("Hindi", 7): [
        "हम पंछी उन्मुक्त गगन के",
        "दादी माँ",
        "हिमालय की बेटियाँ",
        "कठपुतली",
        "मिठाईवाला",
        "रक्त और हमारा शरीर",
        "पापा खो गए",
        "शाम एक किसान",
        "चिड़िया की बच्ची",
        "अपूर्व अनुभव",
    ],
    ("Hindi", 8): [
        "ध्वनि",
        "लाख की चूड़ियाँ",
        "बस की यात्रा",
        "दीवानों की हस्ती",
        "चिट्ठियों की अनूठी दुनिया",
        "भगवान के डाकिए",
        "क्या निराश हुआ जाए",
        "यह सबसे कठिन समय नहीं",
        "कबीर की साखियाँ",
        "सुदामा चरित",
    ],
    ("Hindi", 9): [
        "दो बैलों की कथा",
        "ल्हासा की ओर",
        "उपभोक्तावाद की संस्कृति",
        "साँवले सपनों की याद",
        "प्रेमचंद के फटे जूते",
        "मेरे बचपन के दिन",
        "एक कुत्ता और एक मैना",
        "साखियाँ एवं सबद",
        "वाख",
        "सवैये",
    ],
    ("Hindi", 10): [
        "सूरदास – पद",
        "राम-लक्ष्मण-परशुराम संवाद",
        "देव – सवैया और कवित्त",
        "आत्मकथ्य",
        "उत्साह और अट नहीं रही है",
        "यह दंतुरित मुसकान",
        "नेताजी का चश्मा",
        "बालगोबिन भगत",
        "लखनवी अंदाज़",
        "एक कहानी यह भी",
    ],
}


def get_or_create(db: Session, model, defaults: dict | None = None, **lookup):
    instance = db.query(model).filter_by(**lookup).one_or_none()
    if instance is not None:
        return instance, False
    instance = model(**lookup, **(defaults or {}))
    db.add(instance)
    db.flush()
    return instance, True


def seed(db: Session) -> None:
    grades = {g.numeric_level: g for g in db.query(Grade).all()}
    if not grades:
        raise SystemExit("no grades found -- run seed_phase0.py first")

    subjects: dict[str, Subject] = {}
    for name in SUBJECTS:
        subject, created = get_or_create(db, Subject, name=name, board=BOARD)
        subjects[name] = subject
        print(f"{'created' if created else 'exists '}  subject    {name}")

    made_ch = made_tp = 0
    for (subject_name, level), titles in CHAPTERS.items():
        grade = grades.get(level)
        subject = subjects.get(subject_name)
        if grade is None or subject is None:
            raise SystemExit(f"missing grade {level} or subject {subject_name!r}")

        for number, title in enumerate(titles, start=1):
            chapter, created = get_or_create(
                db,
                CurriculumChapter,
                subject_id=subject.id,
                grade_id=grade.id,
                chapter_number=number,
                defaults={"title": title},
            )
            made_ch += created
            if created:
                print(f"  + chapter  Class {level} {subject_name} #{number:<2} {title}")

            for i, topic_title in enumerate(
                TOPICS.get((subject_name, level, title), []), start=1
            ):
                _, t_created = get_or_create(
                    db,
                    CurriculumTopic,
                    chapter_id=chapter.id,
                    title=topic_title,
                    defaults={"sequence_order": i},
                )
                made_tp += t_created
                if t_created:
                    print(f"      + topic  {topic_title}")

    total_ch = db.query(CurriculumChapter).count()
    total_tp = db.query(CurriculumTopic).count()
    print(
        f"\nnew chapters: {made_ch}   new topics: {made_tp}   "
        f"(db now: {total_ch} chapters, {total_tp} topics)"
    )


def main() -> None:
    print(f"target database: {engine.url.render_as_string(hide_password=True)}")
    db = SessionLocal()
    try:
        seed(db)
        db.commit()
        print("committed.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
