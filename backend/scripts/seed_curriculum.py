"""Phase 1 curriculum seed: BSEB / NCERT chapters (and a few topics) so the
dashboard's Chapter/Topic selectors and the "My Modules" chapter browser have
realistic data to show. No textbook content chunks -- retrieval degrades
gracefully without them (see docs/phase-1/04). Run seed_phase0.py first (it
creates the grades and the Science / Social Science subjects).

Covers Classes 6-10 for Science, Social Science, Mathematics, English, Hindi
and Sanskrit.
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
SUBJECTS = ["Science", "Social Science", "Mathematics", "English", "Hindi", "Sanskrit"]

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
    ("Science", 10, "Life Processes (जैव प्रक्रम)"): [
        "Nutrition",
        "Respiration",
        "Transportation",
        "Excretion",
    ],
    ("Mathematics", 10, "Introduction to Trigonometry (त्रिकोणमिति का परिचय)"): [
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
        "Matter in Our Surroundings (हमारे आस-पास के पदार्थ)",
        "Is Matter Around Us Pure (क्या हमारे आस-पास के पदार्थ शुद्ध हैं)",
        "Atoms and Molecules (परमाणु एवं अणु)",
        "Structure of the Atom (परमाणु की संरचना)",
        "The Fundamental Unit of Life (जीवन की मौलिक इकाई)",
        "Tissues (ऊतक)",
        "Motion (गति)",
        "Force and Laws of Motion (बल तथा गति के नियम)",
        "Gravitation (गुरुत्वाकर्षण)",
        "Work and Energy (कार्य तथा ऊर्जा)",
        "Sound (ध्वनि)",
        "Improvement in Food Resources (खाद्य संसाधनों में सुधार)",
    ],
    ("Science", 10): [
        "Chemical Reactions and Equations (रासायनिक अभिक्रियाएँ एवं समीकरण)",
        "Acids, Bases and Salts (अम्ल, क्षारक एवं लवण)",
        "Metals and Non-metals (धातु एवं अधातु)",
        "Carbon and its Compounds (कार्बन एवं उसके यौगिक)",
        "Life Processes (जैव प्रक्रम)",
        "Control and Coordination (नियंत्रण एवं समन्वय)",
        "How do Organisms Reproduce? (जीव जनन कैसे करते हैं?)",
        "Heredity (आनुवंशिकता)",
        "Light - Reflection and Refraction (प्रकाश – परावर्तन तथा अपवर्तन)",
        "Human Eye and Colorful World (मानव नेत्र तथा रंगबिरंगा संसार)",
        "Electricity (विद्युत)",
        "Magnetic Effects of Electric Current (विद्युत धारा के चुंबकीय प्रभाव)",
        "Our Environment (हमारा पर्यावरण)",
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
        # Itihas Ki Duniya Bhag 1 (History)
        "Geographical Discoveries (भौगोलिक खोजें)",
        "American War of Independence (अमेरिकी स्वतंत्रता संग्राम)",
        "French Revolution (फ्रांस की क्रांति)",
        "History of World Wars (विश्व युद्धों का इतिहास)",
        "Nazism (नाजीवाद)",
        "Forest Society and Colonialism (वन्य समाज और उपनिवेशवाद)",
        "Efforts for Peace (शांति के प्रयास)",
        "Agriculture and Agrarian Society (कृषि और खेतिहर समाज)",
        # Bhugol: Bharat Bhumi Evam Log (Geography)
        "Location and Extent (स्थिति एवं विस्तार)",
        "Physical Features (भौतिक स्वरूप)",
        "Drainage System (अपवाह स्वरूप)",
        "Climate (जलवायु)",
        "Natural Vegetation and Wildlife (प्राकृतिक वनस्पति एवं वन्य प्राणी)",
        "Population (जनसंख्या)",
        "Map Studies (मानचित्र अध्ययन)",
        "Our Neighboring Countries (हमारा पड़ोसी देश)",
        # Loktantrik Rajniti Bhag 1 (Civics)
        "Democracy in the Contemporary World (समकालीन विश्व में लोकतंत्र)",
        "What and Why Democracy? (लोकतंत्र क्या और क्यों?)",
        "Constitutional Design (संविधान निर्माण)",
        "Electoral Politics (चुनावी राजनीति)",
        "Working of Institutions (संस्थाओं का कामकाज)",
        "Democratic Rights (लोकतांत्रिक अधिकार)",
        # Hamari Arthvyavastha Bhag 1 (Economics)
        "The Story of a Village in Bihar (बिहार के एक गाँव की कहानी)",
        "People as a Resource (मानव एक संसाधन के रूप में)",
        "Poverty: A Challenge (गरीबी: एक चुनौती)",
        "Food Security in India (भारत में खाद्य सुरक्षा)",
    ],
    ("Social Science", 10): [
        # Itihas Ki Duniya Bhag 2 (History)
        "Nationalism in Europe (यूरोप में राष्ट्रवाद)",
        "Socialism and Communism (समाजवाद एवं साम्यवाद)",
        "Nationalist Movement in Indo-China (हिंद-चीन में राष्ट्रवादी आंदोलन)",
        "Nationalism in India (भारत में राष्ट्रवाद)",
        "Economy and Livelihood (अर्थव्यवस्था और आजीविका)",
        "Urbanization and Urban Life (शहरीकरण एवं शहरी जीवन)",
        "Trade and Globalization (व्यापार और भूमंडलीकरण)",
        "Press Culture and Nationalism (प्रेस-संस्कृति एवं राष्ट्रवाद)",
        # Bharat: Sansadhan Evam Upyog -- Geography section
        "Resources and Utilization (भारत: संसाधन एवं उपयोग)",
        "Agriculture (कृषि)",
        "Manufacturing Industries (निर्माण उद्योग)",
        "Transport, Communication and Trade (परिवहन, संचार एवं व्यापार)",
        "Bihar: Agriculture and Forest Resources (बिहार: कृषि एवं वन संसाधन)",
        "Map Reading (मानचित्र अध्ययन)",
        # Bharat: Sansadhan Evam Upyog -- Disaster Management section
        "Natural Disasters: An Introduction (प्राकृतिक आपदा: एक परिचय)",
        "Flood and Drought (प्राकृतिक आपदा एवं प्रबंधन: बाढ़ और सुखाड़)",
        "Earthquake and Tsunami (प्राकृतिक आपदा एवं प्रबंधन: भूकंप एवं सुनामी)",
        "Life Saving Contingency Management (जीवन रक्षक आकस्मिक प्रबंधन)",
        "Alternative Communication Systems During Disasters (Aapda Kal Mein Vaikalpik Sanchar Vyavastha)",
        "Disaster and Co-existence (आपदा और सह-अस्तित्व)",
        # Loktantrik Rajniti Bhag 2 (Civics)
        "Power Sharing in Democracy (लोकतंत्र में सत्ता की साझेदारी)",
        "Working of Power Sharing (सत्ता में साझेदारी की कार्यप्रणाली)",
        "Competition and Movements in Democracy (लोकतंत्र की प्रतिस्पर्धा एवं आंदोलन)",
        "Outcomes of Democracy (लोकतंत्र की उपलब्धियाँ)",
        "Challenges to Democracy (लोकतंत्र की चुनौतियाँ)",
        # Hamari Arthvyavastha Bhag 2 (Economics)
        "Economy and History of its Development (अर्थव्यवस्था एवं इसके विकास का इतिहास)",
        "State and National Income (राज्य एवं राष्ट्र की आय)",
        "Money, Savings and Credit (मुद्रा, बचत एवं साख)",
        "Our Financial Institutions (हमारी वित्तीय संस्थाएँ)",
        "Employment and Services (रोजगार एवं सेवाएँ)",
        "Globalization (वैश्वीकरण)",
        "Consumer Awareness and Protection (उपभोक्ता जागरण एवं संरक्षण)",
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
        "Number Systems (संख्या पद्धति)",
        "Polynomials (बहुपद)",
        "Coordinate Geometry (निर्देशांक ज्यामिति)",
        "Linear Equations in Two Variables (दो चरों वाले रैखिक समीकरण)",
        "Introduction to Euclid's Geometry (यूक्लिड की ज्यामिति का परिचय)",
        "Lines and Angles (रेखाएँ और कोण)",
        "Triangles (त्रिभुज)",
        "Quadrilaterals (चतुर्भुज)",
        "Circles (वृत्त)",
        "Heron's Formula (हीरोन का सूत्र)",
        "Surface Areas and Volumes (पृष्ठीय क्षेत्रफल और आयतन)",
        "Statistics (सांख्यिकी)",
    ],
    ("Mathematics", 10): [
        "Real Numbers (वास्तविक संख्याएँ)",
        "Polynomials (बहुपद)",
        "Pair of Linear Equations in Two Variables (दो चरों वाले रैखिक समीकरण युग्म)",
        "Quadratic Equations (द्विघात समीकरण)",
        "Arithmetic Progressions (समांतर श्रेढ़ियाँ)",
        "Triangles (त्रिभुज)",
        "Coordinate Geometry (निर्देशांक ज्यामिति)",
        "Introduction to Trigonometry (त्रिकोणमिति का परिचय)",
        "Some Applications of Trigonometry (त्रिकोणमिति के कुछ अनुप्रयोग)",
        "Circles (वृत्त)",
        "Areas Related to Circles (वृत्तों से संबंधित क्षेत्रफल)",
        "Surface Areas and Volumes (पृष्ठीय क्षेत्रफल और आयतन)",
        "Statistics (सांख्यिकी)",
        "Probability (प्रायिकता)",
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
        # Panorama Part 1 -- Prose Section
        "I Am Going to Dance Again",
        "Dharmayuddha",
        "Yayati",
        "The Eyes Are Not Here",
        "The Sound of Music",
        "Too Many People, Too Few Trees",
        "The Echoing Green",
        "A Dilemma",
        # Panorama Part 1 -- Poetry Section
        "The Grandmother",
        "On His Blindness",
        "Blow, Blow, Thou Winter Wind",
        "To Daffodils",
        "Sound",
        "Self Introduction",
        "I Am Like the Grass",
        "Abraham Lincoln's Letter to His Son's Teacher",
        # Panorama English Reader Part 1 (Supplementary)
        "The Home-Coming",
        "The Bhils",
        "The Cabuliwallah",
        "The Last Leaf",
        "The House and the Land",
        "The Necklace",
        "The Open Window",
    ],
    ("English", 10): [
        # Panorama Part 2 -- Prose Section
        "The Pace for Living",
        "Me and the Ecology Bit",
        "Gillu",
        "What is Wrong with Indian Films",
        "Acceptance Speech",
        "Once Upon a Time",
        "The Unity of Indian Culture",
        "Little Girls Wiser Than Men",
        # Panorama Part 2 -- Poetry Section
        "God Made the Country",
        "Ode on Solitude",
        "Polythene Bag",
        "Thinner Than a Crescent",
        "The Empty Heart",
        "Koel",
        "The Sleeping Porter",
        "Martha",
        # Panorama English Reader Part 2 (Supplementary)
        "January Night",
        "Allergy",
        "The Bet",
        "Quality",
        "Sun and Moon",
        "Two Horizons",
        "Love Defiled",
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
        # Godhuli Bhag 1 -- Gadya Khand (Prose)
        "कहानी का प्लॉट (शिवपूजन सहाय)",
        "भारत का पुरातन विद्यापीठ : नालंदा (डॉ. राजेन्द्र प्रसाद)",
        "ग्राम-गीत का मर्म (लक्ष्मीनारायण सुधांशु)",
        "लाल पान की बेगम (फणीश्वरनाथ रेणु)",
        "भारतीय चित्रपट : मूक से सवाक फिल्में (अमृतलाल नागर)",
        "अष्टावक्र (विष्णु प्रभाकर)",
        "टॉल्स्टॉय के घर में (रामवृक्ष बेनीपुरी)",
        "पधारो म्हारे देस (अनुपम मिश्र)",
        "रेल-यात्रा (शरद जोशी)",
        "निबंध (जगदीश नारायण चौबे)",
        "सूखी नदी का पुल (रामधारी सिंह 'दिनकर')",
        "शिक्षा में हेर-फेर (रवींद्रनाथ ठाकुर)",
        # Godhuli Bhag 1 -- Padya Khand (Poetry)
        "रैदास के पद (रैदास)",
        "मंझन के पद (मंझन)",
        "गुरु गोविंद सिंह के पद (गुरु गोविंद सिंह)",
        "पलक पाँवड़े (अयोध्या सिंह उपाध्याय 'हरिऔध')",
        "महादेवी वर्मा के गीत (महादेवी वर्मा)",
        "आ रही रवि की सवारी (हरिवंश राय बच्चन)",
        "पूरा हिंदुस्तान मिलेगा (केदारनाथ अग्रवाल)",
        "मेरा ईश्वर (लीलाधर जगूड़ी)",
        "कड़वे वचन (नचिकेता)",
        "कुछ सवाल (पाब्लो नेरुदा)",
        "पथिक (राम नरेश त्रिपाठी)",
        "मातृभूमि (मैथिलीशरण गुप्त)",
        # Varnika Bhag 1 (Supplementary)
        "दुःस्वप्न का तीर",
        "जंघई की बेटी",
        "सुजाता",
        "धरती अब भी घूम रही है",
        "माँ",
    ],
    ("Hindi", 10): [
        # Godhuli Bhag 2 -- Gadya Khand (Prose)
        "श्रम विभाजन और जाति प्रथा (भीमराव अंबेडकर)",
        "विष के दाँत (नलिन विलोचन शर्मा)",
        "भारत से हम क्या सीखें (मैक्समूलर)",
        "नाखून क्यों बढ़ते हैं (हजारी प्रसाद द्विवेदी)",
        "नागरी लिपि (गुणाकर मुले)",
        "बहादुर (अमरकांत)",
        "परंपरा का मूल्यांकन (रामविलास शर्मा)",
        "जित-जित मैं निरखत हूँ (पंडित बिरजू महाराज)",
        "आविन्यों (अशोक वाजपेयी)",
        "मछली (विनोद कुमार शुक्ल)",
        "नौबतखाने में इबादत (यतीन्द्र मिश्र)",
        "शिक्षा और संस्कृति (महात्मा गांधी)",
        # Godhuli Bhag 2 -- Padya Khand (Poetry)
        "रामनाम बिनु बिरथे जगि जनमा / जो नर दुख में दुख नहिं मानै (गुरु नानक)",
        "प्रेम अयनि श्री राधिका / करील के कुंजन ऊपर वारौं (रसखान)",
        "अति सूधो सनेह को मारग है / मो अँसुवानिहिं लै बरसौ (घनानंद)",
        "स्वदेशी (प्रेमघन)",
        "भारतमाता (सुमित्रानंदन पंत)",
        "जनतंत्र का जन्म (रामधारी सिंह 'दिनकर')",
        "हिरोशिमा (सच्चिदानंद हीरानंद वात्स्यायन 'अज्ञेय')",
        "एक वृक्ष की हत्या (कुँवर नारायण)",
        "हमारी नींद (वीरेन डंगवाल)",
        "अक्षर-ज्ञान (अनामिका)",
        "लौटकर आऊँगा फिर (जीवनानंद दास)",
        "मेरे बिना तुम प्रभु (रेनर मारिया रिल्के)",
        # Varnika Bhag 2 (Supplementary -- non-Hindi stories)
        "दही वाली मंगम्मा (कन्नड़ कहानी)",
        "ढहते विश्वास (उड़िया कहानी)",
        "माँ (गुजराती कहानी)",
        "नगर (तमिल कहानी)",
        "धरती कब तक घूमेगी (राजस्थानी कहानी)",
    ],
    # --------------------------------------------------------------- Sanskrit
    ("Sanskrit", 9): [
        # पीयूषम् भाग 1 (Class 9)
        "ईशस्तुतिः",
        "लोभाविष्टः चक्रधरः",
        "यक्षयुधिष्ठिर-संवादः",
        "चत्वारो वेदाः",
        "संस्कृतस्य महिमा",
        "संस्कृतसाहित्ये पर्यावरणम्",
        "ज्ञानं भारः क्रियां विना",
        "नीतिपद्यानि",
        "बिहारस्य सांस्कृतिकं वैभवम्",
        "ईद-महोत्सवः",
        "ग्राम्यजीवनम्",
        "वीर कुँवर सिंहः",
        "किशोराणां मनोविज्ञानम्",
    ],
    ("Sanskrit", 10): [
        # पीयूषम् द्वितीयो भागः (Class 10)
        "मङ्गलम्",
        "पाटलिपुत्रवैभवम्",
        "अलसकथा",
        "संस्कृतसाहित्ये लेखिकाः",
        "भारतमहिमा",
        "भारतीयसंस्काराः",
        "नीतिश्लोकाः",
        "कर्मवीर कथा",
        "स्वामी दयानन्दः",
        "मन्दाकिनीवर्णनम्",
        "व्याघ्रपथिककथा",
        "कर्णस्य दानवीरता",
        "विश्वशांतिः",
        "शास्त्रकाराः",
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
