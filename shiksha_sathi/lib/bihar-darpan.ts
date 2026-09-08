/**
 * बिहार दर्पण / Bihar Darpan -- a daily learning feed for students about Bihar
 * and the people from Bihar who shaped the state and the nation.
 *
 * Frontend-only, hardcoded content. There is no backend for this. The feed
 * rotates by date: `biharDayIndex()` maps today's date onto one of the 30
 * entries below, and the UI also lets a student browse all 30 by hand.
 *
 * Every string is bilingual (`hi` = Hindi/Devanagari, `en` = English) so the
 * section works for a Hindi, English or Hinglish reader and doubles as light
 * language practice. Quotes are compiled from widely-published sources; a
 * teacher should verify wording before using one in class.
 *
 * The Flutter app carries a mirror of this data in
 * `lib/core/data/bihar_darpan.dart` -- keep the two in sync when editing.
 */

export type BiharText = { hi: string; en: string };

export type BiharQuiz = {
  q: BiharText;
  options: BiharText[]; // exactly 4
  answer: number; // 0-based index into options
  explain: BiharText;
};

export type BiharDay = {
  day: number; // 1..30
  quote: BiharText;
  author: BiharText;
  about: BiharText; // one line on who they are / their Bihar link
  affairs: BiharText[]; // 3 items
  quiz: BiharQuiz;
  gk: BiharText[]; // 3 items
};

/** Which of the 30 entries to show for a given date (rotates through the year). */
export function biharDayIndex(date: Date = new Date()): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - start.getTime()) / 86_400_000);
  return ((dayOfYear % BIHAR_DAYS.length) + BIHAR_DAYS.length) % BIHAR_DAYS.length;
}

export function biharDayForDate(date: Date = new Date()): BiharDay {
  return BIHAR_DAYS[biharDayIndex(date)];
}

export const BIHAR_DAYS: BiharDay[] = [
  {
    day: 1,
    quote: {
      hi: "हर व्यक्ति का यह जन्मसिद्ध अधिकार है कि उसे कम से कम वह बुनियादी शिक्षा मिले, जिसके बिना वह एक नागरिक के रूप में अपना कर्तव्य नहीं निभा सकता।",
      en: "It is the birthright of every individual to receive at least the basic education without which he cannot fully discharge his duties as a citizen.",
    },
    author: { hi: "डॉ. राजेन्द्र प्रसाद", en: "Dr. Rajendra Prasad" },
    about: {
      hi: "भारत के पहले राष्ट्रपति; सिवान ज़िले के ज़ीरादेई गाँव में जन्मे।",
      en: "First President of India; born in Ziradei village, Siwan district, Bihar.",
    },
    affairs: [
      {
        hi: "3 दिसंबर को डॉ. राजेन्द्र प्रसाद की जयंती बिहार में 'राजेन्द्र प्रसाद दिवस' के रूप में मनाई जाती है।",
        en: "3 December, Dr. Rajendra Prasad's birth anniversary, is observed across Bihar as Rajendra Prasad Day.",
      },
      {
        hi: "पटना का 'राजेन्द्र भवन' और कई विद्यालय-अस्पताल उनके नाम पर हैं; उनका पैतृक घर ज़ीरादेई आज स्मारक है।",
        en: "Rajendra Bhawan in Patna and many schools and hospitals carry his name; his ancestral home in Ziradei is now a memorial.",
      },
      {
        hi: "वे संविधान सभा के अध्यक्ष थे, जिसने 26 नवंबर 1949 को भारत का संविधान अंगीकार किया।",
        en: "He chaired the Constituent Assembly, which adopted the Constitution of India on 26 November 1949.",
      },
    ],
    quiz: {
      q: { hi: "डॉ. राजेन्द्र प्रसाद का जन्म बिहार के किस ज़िले में हुआ था?", en: "In which district of Bihar was Dr. Rajendra Prasad born?" },
      options: [
        { hi: "सिवान", en: "Siwan" },
        { hi: "गया", en: "Gaya" },
        { hi: "भागलपुर", en: "Bhagalpur" },
        { hi: "पूर्णिया", en: "Purnia" },
      ],
      answer: 0,
      explain: {
        hi: "उनका जन्म 3 दिसंबर 1884 को सिवान ज़िले के ज़ीरादेई गाँव में हुआ था।",
        en: "He was born on 3 December 1884 in Ziradei village, Siwan district.",
      },
    },
    gk: [
      { hi: "डॉ. राजेन्द्र प्रसाद अकेले ऐसे राष्ट्रपति हैं जो लगातार दो पूर्ण कार्यकाल (1950–1962) तक इस पद पर रहे।", en: "Dr. Rajendra Prasad is the only President of India to serve two full consecutive terms (1950–1962)." },
      { hi: "उन्हें 1962 में भारत रत्न से सम्मानित किया गया।", en: "He was awarded the Bharat Ratna in 1962." },
      { hi: "वे एक मेधावी छात्र थे; कलकत्ता विश्वविद्यालय की परीक्षा में उनके उत्तर पर परीक्षक ने लिखा था — 'परीक्षार्थी परीक्षक से बेहतर है।'", en: "A brilliant student, an examiner at Calcutta University once wrote on his answer script, 'The examinee is better than the examiner.'" },
    ],
  },
  {
    day: 2,
    quote: {
      hi: "संपूर्ण क्रांति अब नारा नहीं, यह मंत्र है।",
      en: "Total Revolution is no longer a slogan; it is a mantra.",
    },
    author: { hi: "लोकनायक जयप्रकाश नारायण", en: "Loknayak Jayaprakash Narayan" },
    about: {
      hi: "स्वतंत्रता सेनानी और '1974 आंदोलन' के नेता; सारण/बलिया की सीमा पर सिताबदियारा में जन्मे।",
      en: "Freedom fighter and leader of the 1974 movement; born in Sitabdiara, on the Saran–Ballia border.",
    },
    affairs: [
      { hi: "जयप्रकाश नारायण की जयंती 11 अक्टूबर को देश भर में मनाई जाती है; बिहार में यह दिन विशेष रूप से याद किया जाता है।", en: "JP's birth anniversary on 11 October is marked nationwide, and remembered especially in Bihar." },
      { hi: "पटना का 'जयप्रकाश नारायण अंतरराष्ट्रीय हवाई अड्डा' उन्हीं के नाम पर है।", en: "Patna's Jayaprakash Narayan International Airport is named after him." },
      { hi: "उनका 'संपूर्ण क्रांति' का आह्वान 5 जून 1974 को पटना के गांधी मैदान में हुई विशाल सभा से जुड़ा है।", en: "His call for 'Total Revolution' is linked to the huge rally at Patna's Gandhi Maidan on 5 June 1974." },
    ],
    quiz: {
      q: { hi: "जयप्रकाश नारायण को किस उपनाम से जाना जाता है?", en: "By what title is Jayaprakash Narayan popularly known?" },
      options: [
        { hi: "देशबंधु", en: "Deshbandhu" },
        { hi: "लोकनायक", en: "Loknayak" },
        { hi: "गुरुदेव", en: "Gurudev" },
        { hi: "पंजाब केसरी", en: "Punjab Kesari" },
      ],
      answer: 1,
      explain: {
        hi: "'लोकनायक' अर्थात 'जनता का नायक' — 1974 के आंदोलन के दौरान यह नाम लोकप्रिय हुआ।",
        en: "'Loknayak' means 'leader of the people' — the name became popular during the 1974 movement.",
      },
    },
    gk: [
      { hi: "जयप्रकाश नारायण को 1965 में सामुदायिक नेतृत्व के लिए रेमन मैग्सेसे पुरस्कार मिला।", en: "JP received the Ramon Magsaysay Award for public service in 1965." },
      { hi: "उन्हें मरणोपरांत 1999 में भारत रत्न से सम्मानित किया गया।", en: "He was posthumously awarded the Bharat Ratna in 1999." },
      { hi: "अमेरिका में पढ़ाई के दौरान वे खेतों और कारखानों में मज़दूरी कर अपना खर्च चलाते थे।", en: "While studying in the United States, he supported himself by working in fields and factories." },
    ],
  },
  {
    day: 3,
    quote: {
      hi: "विद्या ही सबसे अच्छी मित्र है; विद्वान व्यक्ति हर जगह पूजा जाता है।",
      en: "Knowledge is the best friend; a learned person is honoured everywhere.",
    },
    author: { hi: "आचार्य चाणक्य (कौटिल्य)", en: "Acharya Chanakya (Kautilya)" },
    about: {
      hi: "अर्थशास्त्र के रचयिता और मौर्य साम्राज्य के महामंत्री; पाटलिपुत्र (आज का पटना) उनकी कर्मभूमि थी।",
      en: "Author of the Arthashastra and chief minister of the Maurya empire; Pataliputra (modern Patna) was the seat of his work.",
    },
    affairs: [
      { hi: "पटना में स्थित 'चाणक्य राष्ट्रीय विधि विश्वविद्यालय' (CNLU) उन्हीं के नाम पर 2006 में स्थापित हुआ।", en: "Chanakya National Law University (CNLU), Patna, established in 2006, is named after him." },
      { hi: "उनका ग्रंथ 'अर्थशास्त्र' राज्य-व्यवस्था, अर्थनीति और कूटनीति पर दुनिया के सबसे पुराने ग्रंथों में गिना जाता है।", en: "His 'Arthashastra' is among the world's oldest treatises on statecraft, economics and diplomacy." },
      { hi: "बिहार सरकार का प्रशासनिक प्रशिक्षण संस्थान 'चाणक्य' के नाम से जुड़ी शासन-परंपरा को आज भी उद्धृत करता है।", en: "Bihar's administrative training bodies still cite the governance tradition associated with Chanakya." },
    ],
    quiz: {
      q: { hi: "चाणक्य ने किस ग्रंथ की रचना की?", en: "Which treatise did Chanakya compose?" },
      options: [
        { hi: "अष्टाध्यायी", en: "Ashtadhyayi" },
        { hi: "अर्थशास्त्र", en: "Arthashastra" },
        { hi: "मेघदूत", en: "Meghaduta" },
        { hi: "राजतरंगिणी", en: "Rajatarangini" },
      ],
      answer: 1,
      explain: {
        hi: "'अर्थशास्त्र' चाणक्य की रचना है; 'अष्टाध्यायी' पाणिनि की और 'मेघदूत' कालिदास की है।",
        en: "The Arthashastra is Chanakya's; the Ashtadhyayi is Panini's and Meghaduta is Kalidasa's.",
      },
    },
    gk: [
      { hi: "चाणक्य को विष्णुगुप्त और कौटिल्य नामों से भी जाना जाता है।", en: "Chanakya is also known by the names Vishnugupta and Kautilya." },
      { hi: "उन्होंने चंद्रगुप्त मौर्य को गद्दी पर बैठाकर नंद वंश का अंत करवाया।", en: "He mentored Chandragupta Maurya to the throne, ending the Nanda dynasty." },
      { hi: "'चाणक्य नीति' नाम से उनके सूत्र आज भी नैतिक शिक्षा में पढ़े-पढ़ाए जाते हैं।", en: "His aphorisms, collected as 'Chanakya Niti', are still taught as moral lessons." },
    ],
  },
  {
    day: 4,
    quote: {
      hi: "जैसे नाव में आगे बढ़ता यात्री किनारे के स्थिर पेड़ों को पीछे जाता देखता है, वैसे ही लंका में स्थिर व्यक्ति को तारे पश्चिम की ओर जाते दिखते हैं।",
      en: "Just as a passenger in a moving boat sees the still trees on the bank move backward, so a person at Lanka sees the fixed stars moving westward.",
    },
    author: { hi: "आर्यभट", en: "Aryabhata" },
    about: {
      hi: "प्राचीन भारत के महान गणितज्ञ-खगोलशास्त्री; उन्होंने पाटलिपुत्र के निकट कुसुमपुर में कार्य किया।",
      en: "Great mathematician–astronomer of ancient India; he worked at Kusumapura, near Pataliputra.",
    },
    affairs: [
      { hi: "भारत का पहला उपग्रह (1975 में प्रक्षेपित) 'आर्यभट' उन्हीं के नाम पर रखा गया था।", en: "India's first satellite, launched in 1975, was named 'Aryabhata' after him." },
      { hi: "उनका ग्रंथ 'आर्यभटीय' मात्र 121 श्लोकों में गणित और खगोल-विज्ञान समेटे हुए है।", en: "His work 'Aryabhatiya' packs mathematics and astronomy into just 121 verses." },
      { hi: "पटना क्षेत्र की प्राचीन ज्ञान-परंपरा (नालंदा–कुसुमपुर) आज भी विज्ञान मेलों और पाठ्यक्रमों में उद्धृत होती है।", en: "The ancient knowledge tradition of the Patna region (Nalanda–Kusumapura) is still cited in science fairs and curricula." },
    ],
    quiz: {
      q: { hi: "आर्यभट ने गणित को कौन-सी क्रांतिकारी संकल्पना दी, जो आज हर संख्या-पद्धति का आधार है?", en: "Which revolutionary idea, now central to every number system, is credited to Aryabhata's tradition?" },
      options: [
        { hi: "ऋणात्मक संख्याएँ", en: "Negative numbers" },
        { hi: "स्थानीय मान और शून्य का प्रयोग", en: "Place value and the use of zero" },
        { hi: "लघुगणक", en: "Logarithms" },
        { hi: "निर्देशांक ज्यामिति", en: "Coordinate geometry" },
      ],
      answer: 1,
      explain: {
        hi: "आर्यभट की दशमलव स्थानीय-मान पद्धति और शून्य के व्यवस्थित प्रयोग ने आधुनिक अंकगणित की नींव रखी।",
        en: "Aryabhata's decimal place-value system and systematic use of zero laid the foundation of modern arithmetic.",
      },
    },
    gk: [
      { hi: "आर्यभट ने बताया कि पृथ्वी अपनी धुरी पर घूमती है और चंद्रमा सूर्य के प्रकाश से चमकता है।", en: "Aryabhata stated that the Earth rotates on its axis and that the Moon shines by reflected sunlight." },
      { hi: "उन्होंने पाई (π) का मान लगभग 3.1416 निकाला — उस समय की सबसे सटीक गणनाओं में से एक।", en: "He computed the value of pi (π) as about 3.1416 — one of the most accurate estimates of his time." },
      { hi: "उन्होंने ग्रहणों का वैज्ञानिक कारण छाया बताया, न कि किसी दैत्य को।", en: "He explained eclipses scientifically as shadows, not as the work of a demon." },
    ],
  },
  {
    day: 5,
    quote: {
      hi: "जब सारे उपाय विफल हो जाएँ, तब तलवार उठाना उचित है।",
      en: "When all other means have failed, it is righteous to draw the sword.",
    },
    author: { hi: "गुरु गोबिंद सिंह जी", en: "Guru Gobind Singh Ji" },
    about: {
      hi: "सिखों के दसवें गुरु और खालसा पंथ के संस्थापक; उनका जन्म पटना साहिब में हुआ।",
      en: "Tenth Sikh Guru and founder of the Khalsa; he was born at Patna Sahib.",
    },
    affairs: [
      { hi: "पटना साहिब का 'तख्त श्री हरिमंदिर जी' सिख धर्म के पाँच तख्तों में से एक है और गुरु जी की जन्मस्थली है।", en: "Takht Sri Harmandir Ji at Patna Sahib is one of the five Takhts of Sikhism and the Guru's birthplace." },
      { hi: "प्रकाश पर्व (गुरु जी का प्रकाशोत्सव) पर पटना साहिब में देश-विदेश से लाखों श्रद्धालु आते हैं।", en: "On Prakash Parv, the Guru's birth celebration, lakhs of devotees from India and abroad gather at Patna Sahib." },
      { hi: "2017 में गुरु गोबिंद सिंह जी का 350वाँ प्रकाश पर्व पटना में बड़े स्तर पर मनाया गया।", en: "In 2017, the Guru's 350th Prakash Parv was celebrated on a grand scale in Patna." },
    ],
    quiz: {
      q: { hi: "गुरु गोबिंद सिंह जी ने किस पंथ की स्थापना की?", en: "Which order did Guru Gobind Singh Ji establish?" },
      options: [
        { hi: "उदासी", en: "Udasi" },
        { hi: "निर्मल", en: "Nirmal" },
        { hi: "खालसा", en: "Khalsa" },
        { hi: "नामधारी", en: "Namdhari" },
      ],
      answer: 2,
      explain: {
        hi: "उन्होंने 1699 में बैसाखी के दिन आनंदपुर साहिब में खालसा पंथ की स्थापना की।",
        en: "He founded the Khalsa on Baisakhi day in 1699 at Anandpur Sahib.",
      },
    },
    gk: [
      { hi: "गुरु गोबिंद सिंह जी ने 'गुरु ग्रंथ साहिब' को सदा के लिए गुरु का स्थान दिया।", en: "Guru Gobind Singh Ji conferred permanent Guruship on the Guru Granth Sahib." },
      { hi: "वे कवि और विद्वान भी थे; उनकी रचनाएँ 'दशम ग्रंथ' में संकलित हैं।", en: "He was also a poet and scholar; his compositions are collected in the Dasam Granth." },
      { hi: "उनके प्रारंभिक वर्ष पटना में बीते; बचपन का नाम 'गोबिंद राय' था।", en: "His early years were spent in Patna; his childhood name was 'Gobind Rai'." },
    ],
  },
  {
    day: 6,
    quote: {
      hi: "क्षमा शोभती उस भुजंग को, जिसके पास गरल हो; उसको क्या, जो दंतहीन, विषरहित, विनीत, सरल हो।",
      en: "Forgiveness suits the serpent that still carries venom; what merit is it in one who is fangless, poisonless and meek?",
    },
    author: { hi: "रामधारी सिंह 'दिनकर'", en: "Ramdhari Singh 'Dinkar'" },
    about: {
      hi: "'राष्ट्रकवi'; बेगूसराय के सिमरिया गाँव में जन्मे; 'रश्मिरथी' और 'उर्वशी' उनकी प्रसिद्ध रचनाएँ हैं।",
      en: "The 'National Poet'; born in Simaria village, Begusarai; 'Rashmirathi' and 'Urvashi' are among his famous works.",
    },
    affairs: [
      { hi: "23 सितंबर को दिनकर जी की जयंती बिहार में 'दिनकर जयंती' के रूप में मनाई जाती है।", en: "23 September is celebrated across Bihar as Dinkar Jayanti, his birth anniversary." },
      { hi: "सिमरिया में उनके नाम पर स्मारक और 'दिनकर द्वार' बना है; बेगूसराय को अकसर 'दिनकर की धरती' कहा जाता है।", en: "A memorial and 'Dinkar Dwar' stand at Simaria; Begusarai is often called 'the land of Dinkar'." },
      { hi: "उनकी पंक्तियाँ आज भी संसद से लेकर विद्यालयों तक ओज और साहस के लिए उद्धृत होती हैं।", en: "His lines are still quoted from Parliament to classrooms as verses of courage and vigour." },
    ],
    quiz: {
      q: { hi: "'रश्मिरथी' किसकी रचना है और यह किस पात्र पर केंद्रित है?", en: "'Rashmirathi' is composed by whom, and centres on which character?" },
      options: [
        { hi: "मैथिलीशरण गुप्त — यशोधरा", en: "Maithili Sharan Gupt — Yashodhara" },
        { hi: "दिनकर — कर्ण", en: "Dinkar — Karna" },
        { hi: "निराला — राम", en: "Nirala — Rama" },
        { hi: "तुलसीदास — हनुमान", en: "Tulsidas — Hanuman" },
      ],
      answer: 1,
      explain: {
        hi: "'रश्मिरथी' दिनकर की रचना है और महाभारत के पात्र कर्ण के जीवन पर केंद्रित है।",
        en: "'Rashmirathi' is by Dinkar and is centred on Karna, a character from the Mahabharata.",
      },
    },
    gk: [
      { hi: "दिनकर को 'संस्कृति के चार अध्याय' के लिए 1959 में साहित्य अकादमी और 'उर्वशी' के लिए 1972 में ज्ञानपीठ पुरस्कार मिला।", en: "Dinkar won the Sahitya Akademi Award in 1959 for 'Sanskriti ke Char Adhyay' and the Jnanpith Award in 1972 for 'Urvashi'." },
      { hi: "उन्हें 1959 में पद्म भूषण से सम्मानित किया गया और वे राज्यसभा के सदस्य भी रहे।", en: "He was awarded the Padma Bhushan in 1959 and also served as a member of the Rajya Sabha." },
      { hi: "उनका काव्य-नाटक 'रश्मिरथी' का तीसरा सर्ग ('कृष्ण की चेतावनी') मंचों पर सबसे अधिक सुनाया जाता है।", en: "The third canto of 'Rashmirathi' ('Krishna ki Chetavani') is among the most frequently recited passages on Indian stages." },
    ],
  },
  {
    day: 7,
    quote: {
      hi: "कई दिनों तक चूल्हा रोया, चक्की रही उदास; कई दिनों तक कानी कुतिया सोई उनके पास।",
      en: "For days the hearth wept and the grindstone lay forlorn; for days the one-eyed bitch slept beside them.",
    },
    author: { hi: "बाबा नागार्जुन (वैद्यनाथ मिश्र)", en: "Baba Nagarjun (Vaidyanath Mishra)" },
    about: {
      hi: "हिंदी और मैथिली के जनकवि; मधुबनी ज़िले के सतलखा गाँव में जन्मे।",
      en: "People's poet of Hindi and Maithili; born in Satlakha village, Madhubani district.",
    },
    affairs: [
      { hi: "नागार्जुन की जयंती (30 जून) पर मिथिलांचल में साहित्यिक आयोजन होते हैं।", en: "Literary events are held across the Mithila region on Nagarjun's birth anniversary (30 June)." },
      { hi: "मैथिली में वे 'यात्री' उपनाम से लिखते थे; मैथिली को 2003 में संविधान की आठवीं अनुसूची में शामिल किया गया।", en: "In Maithili he wrote under the pen name 'Yatri'; Maithili was included in the Eighth Schedule of the Constitution in 2003." },
      { hi: "उनकी कविता 'अकाल और उसके बाद' भूख और अभाव पर हिंदी की सबसे उद्धृत कविताओं में है।", en: "His poem 'Akaal aur Uske Baad' is among the most quoted Hindi poems on hunger and want." },
    ],
    quiz: {
      q: { hi: "बाबा नागार्जुन मुख्यतः किन दो भाषाओं में लिखते थे?", en: "In which two languages did Baba Nagarjun mainly write?" },
      options: [
        { hi: "हिंदी और मैथिली", en: "Hindi and Maithili" },
        { hi: "हिंदी और भोजपुरी", en: "Hindi and Bhojpuri" },
        { hi: "मैथिली और बांग्ला", en: "Maithili and Bengali" },
        { hi: "हिंदी और अंगिका", en: "Hindi and Angika" },
      ],
      answer: 0,
      explain: {
        hi: "वे हिंदी में 'नागार्जुन' और मैथिली में 'यात्री' नाम से लिखते थे।",
        en: "He wrote as 'Nagarjun' in Hindi and as 'Yatri' in Maithili.",
      },
    },
    gk: [
      { hi: "नागार्जुन को 'आधुनिक कबीर' कहा जाता है, क्योंकि उनकी कविता सीधी, तीखी और जन-सरोकार वाली थी।", en: "Nagarjun is called a 'modern Kabir' for his direct, sharp, socially engaged verse." },
      { hi: "उन्हें साहित्य अकादमी पुरस्कार (1969, मैथिली) और साहित्य अकादमी की सर्वोच्च फ़ेलोशिप मिली।", en: "He received the Sahitya Akademi Award (1969, for Maithili) and the Akademi's highest Fellowship." },
      { hi: "वे आजीवन घुमक्कड़ रहे — इसी स्वभाव के कारण मैथिली में उनका उपनाम 'यात्री' पड़ा।", en: "He was a lifelong wanderer — which is why his Maithili pen name was 'Yatri' (the traveller)." },
    ],
  },
  {
    day: 8,
    quote: {
      hi: "जनम अवधि हम रूप निहारल, नयन न तिरपित भेल।",
      en: "All my life I have gazed upon that beauty, yet my eyes have never had their fill.",
    },
    author: { hi: "महाकवि विद्यापति", en: "Mahakavi Vidyapati" },
    about: {
      hi: "मैथिली के आदिकवि (14वीं–15वीं सदी); मिथिला की भक्ति और शृंगार परंपरा के शिखर।",
      en: "The foundational poet of Maithili (14th–15th century); a peak of Mithila's devotional and lyrical tradition.",
    },
    affairs: [
      { hi: "मधुबनी ज़िले में 'विद्यापति नगर' और दरभंगा के निकट 'विद्यापति धाम' (बिसफी) उनसे जुड़े स्थल हैं।", en: "'Vidyapati Nagar' in Madhubani district and 'Vidyapati Dham' (Bisfi) near Darbhanga are sites linked to him." },
      { hi: "उनकी पदावली आज भी विवाह और चौठचंद्र जैसे मैथिल संस्कारों में गाई जाती है।", en: "His songs are still sung at Maithil ceremonies such as weddings and Chauth Chandra." },
      { hi: "बिहार सरकार मैथिली-भोजपुरी अकादमी के ज़रिए विद्यापति की रचनाओं का प्रकाशन-संरक्षण करती है।", en: "The Bihar government preserves and publishes Vidyapati's works through its Maithili–Bhojpuri Academy." },
    ],
    quiz: {
      q: { hi: "विद्यापति किस भाषा के आदिकवि माने जाते हैं?", en: "Vidyapati is regarded as the foundational poet of which language?" },
      options: [
        { hi: "भोजपुरी", en: "Bhojpuri" },
        { hi: "मैथिली", en: "Maithili" },
        { hi: "मगही", en: "Magahi" },
        { hi: "अवधी", en: "Awadhi" },
      ],
      answer: 1,
      explain: {
        hi: "उन्हें 'मैथिल कवि कोकिल' कहा जाता है; उनकी पदावली मैथिली साहित्य की नींव है।",
        en: "He is called 'Maithil Kavi Kokil' (the nightingale poet of Mithila); his songs are the bedrock of Maithili literature.",
      },
    },
    gk: [
      { hi: "विद्यापति ने संस्कृत, अवहट्ट और मैथिली — तीनों में रचनाएँ कीं।", en: "Vidyapati composed in three languages — Sanskrit, Avahattha and Maithili." },
      { hi: "उनकी शैली ने आगे चलकर बांग्ला, असमिया और ओड़िया की पद-रचना को भी प्रभावित किया।", en: "His style later influenced devotional song-poetry in Bengali, Assamese and Odia as well." },
      { hi: "'विद्यापति गीत' मिथिला की सांस्कृतिक पहचान का हिस्सा है।", en: "'Vidyapati Geet' is part of Mithila's cultural identity." },
    ],
  },
  {
    day: 9,
    quote: {
      hi: "गवना कराइ सजनी के, बिदेस कमाइ चलि जाला — रुपैया कमाइ, जोबनवा गँवाइ, बुढ़ारी में लवटेला।",
      en: "He weds, then leaves his bride to earn in far-off lands — he gathers coins, loses his youth, and returns only in old age.",
    },
    author: { hi: "भिखारी ठाकुर", en: "Bhikhari Thakur" },
    about: {
      hi: "भोजपुरी के 'शेक्सपियर'; सारण (छपरा) के कुतुबपुर गाँव में जन्मे लोक-नाटककार और 'बिदेसिया' के रचयिता।",
      en: "The 'Shakespeare of Bhojpuri'; folk playwright born in Kutubpur village, Saran (Chhapra), and author of 'Bidesia'.",
    },
    affairs: [
      { hi: "बिहार में उनके नाम पर 'भिखारी ठाकुर रंगमंच' और लोक-कला पुरस्कार दिए जाते हैं।", en: "Bihar names theatre spaces and folk-art awards after him, including the 'Bhikhari Thakur' honours." },
      { hi: "उनका नाटक 'बिदेसिया' पलायन (मज़दूरों के परदेस जाने) की पीड़ा पर आज भी प्रासंगिक है।", en: "His play 'Bidesia', about the pain of migration for work, remains strikingly relevant." },
      { hi: "छपरा के कुतुबपुर में उनकी जयंती (18 दिसंबर के आसपास) पर लोक-नाट्य समारोह होते हैं।", en: "Folk-theatre festivals are held around his birth anniversary (mid-December) at Kutubpur, Chhapra." },
    ],
    quiz: {
      q: { hi: "भिखारी ठाकुर का सबसे प्रसिद्ध नाटक कौन-सा है?", en: "What is Bhikhari Thakur's most famous play?" },
      options: [
        { hi: "बिदेसिया", en: "Bidesia" },
        { hi: "अंधेर नगरी", en: "Andher Nagari" },
        { hi: "आषाढ़ का एक दिन", en: "Aashadh ka Ek Din" },
        { hi: "नागमंडल", en: "Nagamandala" },
      ],
      answer: 0,
      explain: {
        hi: "'बिदेसिया' उनकी सबसे चर्चित कृति है; इसी से 'बिदेसिया' एक लोक-नाट्य शैली का नाम बन गया।",
        en: "'Bidesia' is his best-known work; it even gave its name to a whole style of Bhojpuri folk theatre.",
      },
    },
    gk: [
      { hi: "भिखारी ठाकुर ने नाच मंडली बनाई और गीत, संवाद, संगीत व अभिनय — सब स्वयं रचे।", en: "Bhikhari Thakur ran his own troupe and wrote the songs, dialogue, music and acting himself." },
      { hi: "उनकी रचनाएँ 'बेटी-बेचवा', 'गबरघिचोर' आदि सामाजिक कुरीतियों पर सीधी चोट करती हैं।", en: "Works like 'Beti-Bechwa' and 'Gabarghichor' strike directly at social evils." },
      { hi: "राहुल सांकृत्यायन ने उन्हें 'भोजपुरी का शेक्सपियर' और 'अनगढ़ हीरा' कहा।", en: "The scholar Rahul Sankrityayan called him the 'Shakespeare of Bhojpuri' and an 'uncut diamond'." },
    ],
  },
  {
    day: 10,
    quote: {
      hi: "इसमें फूल भी है, शूल भी, धूल भी है, गुलाब भी — कीचड़ भी है, चंदन भी।",
      en: "Here there are flowers and thorns, dust and roses, mire and sandalwood alike.",
    },
    author: { hi: "फणीश्वरनाथ 'रेणु'", en: "Phanishwar Nath 'Renu'" },
    about: {
      hi: "'आंचलिक' उपन्यास के प्रवर्तक; पूर्णिया (अब अररिया) के औराही हिंगना गाँव में जन्मे; 'मैला आँचल' उनकी अमर कृति है।",
      en: "Pioneer of the 'regional' (aanchalik) novel; born in Aurahi Hingna village, Purnia (now Araria); 'Maila Aanchal' is his classic.",
    },
    affairs: [
      { hi: "उनकी कहानी 'मारे गए गुलफ़ाम' पर बनी फ़िल्म 'तीसरी क़सम' (1966) को राष्ट्रीय पुरस्कार मिला।", en: "The film 'Teesri Kasam' (1966), based on his story 'Maare Gaye Gulfam', won a National Award." },
      { hi: "अररिया के औराही हिंगना में 'रेणु स्मारक' और उनके नाम पर पुस्तकालय हैं।", en: "Aurahi Hingna in Araria has a 'Renu memorial' and a library in his name." },
      { hi: "उन्होंने 1975 के आपातकाल के विरोध में पद्मश्री लौटा दी थी।", en: "He returned his Padma Shri in protest against the Emergency of 1975." },
    ],
    quiz: {
      q: { hi: "फणीश्वरनाथ रेणु का सर्वाधिक प्रसिद्ध उपन्यास कौन-सा है?", en: "Which is Phanishwar Nath Renu's most famous novel?" },
      options: [
        { hi: "गोदान", en: "Godan" },
        { hi: "मैला आँचल", en: "Maila Aanchal" },
        { hi: "गुनाहों का देवता", en: "Gunahon ka Devta" },
        { hi: "तमस", en: "Tamas" },
      ],
      answer: 1,
      explain: {
        hi: "'मैला आँचल' (1954) कोसी अंचल के एक गाँव की कथा है और आंचलिक उपन्यास की सबसे बड़ी मिसाल मानी जाती है।",
        en: "'Maila Aanchal' (1954), set in a village of the Kosi region, is the landmark example of the regional novel in Hindi.",
      },
    },
    gk: [
      { hi: "रेणु ने अपने लेखन में लोकगीत, बोली और गाँव की लय को साहित्य की भाषा बनाया।", en: "Renu turned folk songs, dialect and the rhythm of village life into literary language." },
      { hi: "वे 1942 के भारत छोड़ो आंदोलन और नेपाल के लोकतांत्रिक आंदोलन — दोनों में सक्रिय रहे।", en: "He was active both in the Quit India Movement of 1942 and in Nepal's democratic movement." },
      { hi: "उनकी रिपोर्ताज 'ऋणजल धनजल' कोसी की बाढ़ पर लिखा मार्मिक दस्तावेज़ है।", en: "His reportage 'Rinjal Dhanjal' is a moving account of the Kosi floods." },
    ],
  },
  {
    day: 11,
    quote: {
      hi: "संगीत का कोई मज़हब नहीं होता; सुर सबका होता है।",
      en: "Music has no religion; a musical note belongs to everyone.",
    },
    author: { hi: "उस्ताद बिस्मिल्लाह ख़ाँ", en: "Ustad Bismillah Khan" },
    about: {
      hi: "शहनाई के महानतम वादक; बक्सर ज़िले के डुमराँव में जन्मे; भारत रत्न से सम्मानित।",
      en: "The greatest shehnai maestro; born in Dumraon, Buxar district; a Bharat Ratna awardee.",
    },
    affairs: [
      { hi: "डुमराँव में उनके नाम पर 'उस्ताद बिस्मिल्लाह ख़ाँ' स्मारक व संगीत आयोजन होते हैं।", en: "Dumraon holds an 'Ustad Bismillah Khan' memorial and music events in his honour." },
      { hi: "15 अगस्त 1947 को लालकिले से उनकी शहनाई की प्रस्तुति स्वतंत्र भारत की पहली सुबह की स्मृति है।", en: "His shehnai recital from the Red Fort on 15 August 1947 is remembered as the sound of independent India's first morning." },
      { hi: "बिहार और वाराणसी दोनों उन्हें अपनी सांस्कृतिक विरासत के रूप में याद करते हैं।", en: "Both Bihar and Varanasi remember him as part of their cultural heritage." },
    ],
    quiz: {
      q: { hi: "उस्ताद बिस्मिल्लाह ख़ाँ किस वाद्य यंत्र के लिए विख्यात हैं?", en: "Ustad Bismillah Khan is celebrated for which instrument?" },
      options: [
        { hi: "सितार", en: "Sitar" },
        { hi: "शहनाई", en: "Shehnai" },
        { hi: "सरोद", en: "Sarod" },
        { hi: "तबला", en: "Tabla" },
      ],
      answer: 1,
      explain: {
        hi: "उन्होंने शहनाई को मंदिर-विवाह के वाद्य से उठाकर शास्त्रीय मंच का सम्मानित यंत्र बना दिया।",
        en: "He lifted the shehnai from temples and weddings to the respected classical concert stage.",
      },
    },
    gk: [
      { hi: "उन्हें 2001 में भारत रत्न मिला; वे यह सम्मान पाने वाले तीसरे संगीतकार थे।", en: "He received the Bharat Ratna in 2001, the third musician to be so honoured." },
      { hi: "मुसलमान होते हुए भी वे काशी विश्वनाथ मंदिर के निकट रियाज़ करते और गंगा को माँ कहते थे।", en: "A devout Muslim, he practised near the Kashi Vishwanath temple and called the Ganga his mother." },
      { hi: "उन्हें पद्म श्री, पद्म भूषण और पद्म विभूषण — तीनों पद्म सम्मान भी मिले।", en: "He also received all three Padma honours — Padma Shri, Padma Bhushan and Padma Vibhushan." },
    ],
  },
  {
    day: 12,
    quote: {
      hi: "समाज के सबसे पिछड़े और कमज़ोर व्यक्ति को ऊपर उठाए बिना कोई समाज सच में आगे नहीं बढ़ता।",
      en: "No society truly moves forward without lifting up its most backward and weakest members.",
    },
    author: { hi: "जननायक कर्पूरी ठाकुर", en: "Jannayak Karpoori Thakur" },
    about: {
      hi: "बिहार के दो बार मुख्यमंत्री; सादगी और सामाजिक न्याय की मिसाल; समस्तीपुर के पितौंझिया (अब कर्पूरी ग्राम) में जन्मे।",
      en: "Twice Chief Minister of Bihar; a byword for simplicity and social justice; born in Pitaunjhia (now Karpoori Gram), Samastipur.",
    },
    affairs: [
      { hi: "2024 में कर्पूरी ठाकुर को मरणोपरांत भारत रत्न से सम्मानित किया गया।", en: "In 2024, Karpoori Thakur was posthumously awarded the Bharat Ratna." },
      { hi: "24 जनवरी को उनकी जयंती बिहार में 'जननायक कर्पूरी ठाकुर जयंती' के रूप में मनाई जाती है।", en: "24 January is observed in Bihar as Jannayak Karpoori Thakur Jayanti." },
      { hi: "मुख्यमंत्री रहते उन्होंने मैट्रिक तक की पढ़ाई निःशुल्क की और पिछड़ों के लिए आरक्षण लागू किया।", en: "As CM he made schooling free up to matriculation and introduced reservation for backward classes in Bihar." },
    ],
    quiz: {
      q: { hi: "किस नेता को 2024 में भारत रत्न (मरणोपरांत) दिया गया और जिन्हें 'जननायक' कहा जाता है?", en: "Which leader, called 'Jannayak', was awarded the Bharat Ratna (posthumously) in 2024?" },
      options: [
        { hi: "कर्पूरी ठाकुर", en: "Karpoori Thakur" },
        { hi: "श्रीकृष्ण सिंह", en: "Shri Krishna Singh" },
        { hi: "अनुग्रह नारायण सिन्हा", en: "Anugrah Narayan Sinha" },
        { hi: "बिंदेश्वरी दुबे", en: "Bindeshwari Dubey" },
      ],
      answer: 0,
      explain: {
        hi: "कर्पूरी ठाकुर को 'जननायक' कहा जाता है; भारत रत्न की घोषणा उनकी जयंती (24 जनवरी) 2024 की पूर्व संध्या पर हुई।",
        en: "Karpoori Thakur is called 'Jannayak'; the Bharat Ratna was announced on the eve of his birth anniversary (24 January) in 2024.",
      },
    },
    gk: [
      { hi: "वे इतने सरल थे कि मुख्यमंत्री पद छोड़ने पर उनके पास न घर था, न कार।", en: "He was so unassuming that on leaving the CM's office he owned neither a house nor a car." },
      { hi: "उन्हें बिहार में अंग्रेज़ी की अनिवार्यता हटाने के फ़ैसले के लिए भी याद किया जाता है।", en: "He is also remembered for removing compulsory English as a pass requirement in Bihar schools of the time." },
      { hi: "वे 1970 और 1977 में — दो बार बिहार के मुख्यमंत्री बने।", en: "He became Chief Minister of Bihar twice — in 1970 and in 1977." },
    ],
  },
  {
    day: 13,
    quote: {
      hi: "प्रतिभा अमीरी-ग़रीबी नहीं देखती; उसे बस एक मौक़ा चाहिए।",
      en: "Talent does not care whether you are rich or poor; it only needs an opportunity.",
    },
    author: { hi: "आनंद कुमार", en: "Anand Kumar" },
    about: {
      hi: "पटना के गणितज्ञ-शिक्षक; 'सुपर 30' कार्यक्रम के संस्थापक, जो ग़रीब बच्चों को निःशुल्क IIT-JEE कोचिंग देता है।",
      en: "Mathematician and teacher from Patna; founder of 'Super 30', which gives free IIT-JEE coaching to students from poor families.",
    },
    affairs: [
      { hi: "'सुपर 30' पर 2019 में हिंदी फ़िल्म बनी, जिससे यह पहल दुनिया भर में चर्चित हुई।", en: "A 2019 Hindi film on 'Super 30' brought the initiative worldwide attention." },
      { hi: "आनंद कुमार को शिक्षा के क्षेत्र में योगदान के लिए 2023 में पद्म श्री से सम्मानित किया गया।", en: "Anand Kumar was awarded the Padma Shri in 2023 for his contribution to education." },
      { hi: "यह मॉडल पटना से शुरू होकर देश के कई राज्यों में दोहराया गया है।", en: "The model, born in Patna, has been replicated in several states." },
    ],
    quiz: {
      q: { hi: "'सुपर 30' किस लक्ष्य के लिए जाना जाता है?", en: "'Super 30' is known for which goal?" },
      options: [
        { hi: "ग़रीब छात्रों को निःशुल्क IIT-JEE कोचिंग", en: "Free IIT-JEE coaching for poor students" },
        { hi: "किसानों को ऋण", en: "Loans for farmers" },
        { hi: "खेल छात्रवृत्ति", en: "Sports scholarships" },
        { hi: "महिला स्वयं-सहायता समूह", en: "Women's self-help groups" },
      ],
      answer: 0,
      explain: {
        hi: "हर साल चुने गए 30 प्रतिभाशाली पर वंचित छात्रों को आनंद कुमार निःशुल्क कोचिंग, भोजन और आवास देते हैं।",
        en: "Each year 30 gifted but underprivileged students get free coaching, food and lodging from Anand Kumar.",
      },
    },
    gk: [
      { hi: "आनंद कुमार को कैम्ब्रिज विश्वविद्यालय में शोध का अवसर मिला था, पर पिता के निधन और धन के अभाव में वे जा नहीं सके।", en: "Anand Kumar earned a place for research at Cambridge but could not go after his father's death and for lack of money." },
      { hi: "पहले उन्होंने पापड़ बेचकर परिवार चलाया, फिर 'रामानुजन स्कूल ऑफ़ मैथमेटिक्स' शुरू किया।", en: "He first supported his family by selling papads, then started the 'Ramanujan School of Mathematics'." },
      { hi: "कई वर्षों में 'सुपर 30' के अधिकांश छात्रों ने IIT में प्रवेश पाया है।", en: "Over many years, most 'Super 30' students have gone on to enter the IITs." },
    ],
  },
  {
    day: 14,
    quote: {
      hi: "लोकगीत माटी की ख़ुशबू हैं; इन्हें सहेजना हम सबकी ज़िम्मेदारी है।",
      en: "Folk songs are the fragrance of the soil; preserving them is a duty we all share.",
    },
    author: { hi: "शारदा सिन्हा", en: "Sharda Sinha" },
    about: {
      hi: "'बिहार कोकिला'; सुपौल ज़िले में जन्मीं लोक-गायिका, छठ और विवाह गीतों की सबसे बड़ी आवाज़।",
      en: "The 'Nightingale of Bihar'; folk singer born in Supaul district, the defining voice of Chhath and wedding songs.",
    },
    affairs: [
      { hi: "शारदा सिन्हा को 1991 में पद्म श्री, 2018 में पद्म भूषण और 2025 में (मरणोपरांत) पद्म विभूषण से सम्मानित किया गया।", en: "Sharda Sinha received the Padma Shri in 1991, the Padma Bhushan in 2018, and the Padma Vibhushan (posthumously) in 2025." },
      { hi: "उनके छठ गीत — जैसे 'केलवा के पात पर' और 'हो दीनानाथ' — हर वर्ष छठ पर बजते हैं।", en: "Her Chhath songs — like 'Kelwa ke Paat Par' and 'Ho Dinanath' — are played every year during Chhath." },
      { hi: "नवंबर 2024 में उनके निधन पर बिहार में राजकीय शोक घोषित हुआ।", en: "State mourning was declared in Bihar on her death in November 2024." },
    ],
    quiz: {
      q: { hi: "शारदा सिन्हा किस लोक-परंपरा के गीतों के लिए सबसे अधिक जानी जाती हैं?", en: "Sharda Sinha is best known for songs of which folk tradition?" },
      options: [
        { hi: "होली और फाग", en: "Holi and Phag" },
        { hi: "छठ और विवाह गीत", en: "Chhath and wedding songs" },
        { hi: "क़व्वाली", en: "Qawwali" },
        { hi: "बाउल", en: "Baul" },
      ],
      answer: 1,
      explain: {
        hi: "उनका नाम छठ महापर्व के गीतों से इतना जुड़ा है कि छठ की पहचान उनकी आवाज़ बन गई।",
        en: "Her name is so tied to the songs of the Chhath festival that her voice became its signature.",
      },
    },
    gk: [
      { hi: "उन्होंने मैथिली, भोजपुरी और मगही — तीनों में गाया।", en: "She sang in Maithili, Bhojpuri and Magahi." },
      { hi: "फ़िल्म 'मैंने प्यार किया' का 'कहे तोसे सजना' और 'गैंग्स ऑफ़ वासेपुर' का 'तार बिजली' उन्हीं की आवाज़ में है।", en: "'Kahe Tose Sajna' from 'Maine Pyar Kiya' and 'Taar Bijli' from 'Gangs of Wasseypur' are in her voice." },
      { hi: "वे संगीत नाटक अकादमी पुरस्कार से भी सम्मानित थीं।", en: "She was also honoured with the Sangeet Natak Akademi Award." },
    ],
  },
  {
    day: 15,
    quote: {
      hi: "जब तक शरीर में प्राण है, मातृभूमि की रक्षा के लिए तलवार उठाए रहूँगा।",
      en: "As long as there is breath in this body, I will keep my sword raised for the motherland.",
    },
    author: { hi: "बाबू वीर कुँवर सिंह", en: "Babu Veer Kunwar Singh" },
    about: {
      hi: "1857 के प्रथम स्वतंत्रता संग्राम के नायक; आरा ज़िले के जगदीशपुर के राजा, जिन्होंने अस्सी वर्ष की आयु में अंग्रेज़ों से युद्ध किया।",
      en: "Hero of the First War of Independence, 1857; the ageing ruler of Jagdishpur, Arrah, who fought the British in his eighties.",
    },
    affairs: [
      { hi: "23 अप्रैल को बिहार में 'विजयोत्सव' मनाया जाता है — इसी दिन 1858 में कुँवर सिंह ने जगदीशपुर में अंग्रेज़ों को हराया था।", en: "23 April is celebrated in Bihar as 'Vijayotsav' — the day in 1858 when Kunwar Singh defeated the British at Jagdishpur." },
      { hi: "आरा में 'वीर कुँवर सिंह विश्वविद्यालय' और पटना के एक बड़े उद्यान का नाम उन्हीं पर है।", en: "Veer Kunwar Singh University in Arrah and a major park in Patna are named after him." },
      { hi: "2018 में उनकी 160वीं विजय-वर्षगाँठ पर विशेष डाक टिकट और आयोजन हुए।", en: "In 2018, a commemorative stamp and events marked the 160th anniversary of his victory." },
    ],
    quiz: {
      q: { hi: "वीर कुँवर सिंह किस स्थान के राजा थे?", en: "Veer Kunwar Singh was the ruler of which place?" },
      options: [
        { hi: "जगदीशपुर", en: "Jagdishpur" },
        { hi: "डुमराँव", en: "Dumraon" },
        { hi: "बेतिया", en: "Bettiah" },
        { hi: "दरभंगा", en: "Darbhanga" },
      ],
      answer: 0,
      explain: {
        hi: "वे आरा (भोजपुर) ज़िले के जगदीशपुर रियासत के राजा थे।",
        en: "He was the ruler of the Jagdishpur estate in Arrah (Bhojpur) district.",
      },
    },
    gk: [
      { hi: "किंवदंती है कि गंगा पार करते समय गोली लगने पर उन्होंने अपना घायल हाथ स्वयं काटकर नदी को अर्पित कर दिया।", en: "Legend says that, shot while crossing the Ganga, he cut off his own wounded arm and offered it to the river." },
      { hi: "1857 के विद्रोह में वे बिहार के सबसे प्रमुख सैन्य नेता थे।", en: "He was the foremost military leader of Bihar in the revolt of 1857." },
      { hi: "युद्ध जीतने के कुछ ही दिनों बाद, 26 अप्रैल 1858 को उनका निधन हो गया।", en: "He died on 26 April 1858, only days after his final victory." },
    ],
  },
  {
    day: 16,
    quote: {
      hi: "लोकतंत्र की सबसे बड़ी पाठशाला जागरूक नागरिक है।",
      en: "The greatest school of democracy is an aware citizen.",
    },
    author: { hi: "डॉ. सच्चिदानंद सिन्हा", en: "Dr. Sachchidananda Sinha" },
    about: {
      hi: "पत्रकार, विधिवेत्ता और शिक्षाविद्; भारत की संविधान सभा के पहले (अस्थायी) सभापति; बिहार को अलग प्रांत बनाने के आंदोलन के अग्रणी।",
      en: "Journalist, jurist and educationist; the first (provisional) chairman of India's Constituent Assembly; a leader of the movement for a separate Bihar province.",
    },
    affairs: [
      { hi: "9 दिसंबर 1946 को संविधान सभा की पहली बैठक की अध्यक्षता डॉ. सच्चिदानंद सिन्हा ने की।", en: "Dr. Sachchidananda Sinha presided over the first sitting of the Constituent Assembly on 9 December 1946." },
      { hi: "पटना का 'सिन्हा लाइब्रेरी' उन्हीं की देन है और आज भी एक प्रमुख शोध-पुस्तकालय है।", en: "Patna's Sinha Library was his gift and remains a leading research library today." },
      { hi: "बिहार के 1912 में अलग प्रांत बनने के पीछे उनके लेखन और पैरवी की बड़ी भूमिका मानी जाती है।", en: "His writing and advocacy are seen as central to Bihar becoming a separate province in 1912." },
    ],
    quiz: {
      q: { hi: "भारत की संविधान सभा की पहली बैठक की अध्यक्षता किसने की?", en: "Who chaired the first sitting of India's Constituent Assembly?" },
      options: [
        { hi: "डॉ. राजेन्द्र प्रसाद", en: "Dr. Rajendra Prasad" },
        { hi: "डॉ. सच्चिदानंद सिन्हा", en: "Dr. Sachchidananda Sinha" },
        { hi: "बी. आर. आंबेडकर", en: "B. R. Ambedkar" },
        { hi: "जवाहरलाल नेहरू", en: "Jawaharlal Nehru" },
      ],
      answer: 1,
      explain: {
        hi: "सबसे वरिष्ठ सदस्य होने के नाते डॉ. सच्चिदानंद सिन्हा को अस्थायी सभापति बनाया गया; बाद में डॉ. राजेन्द्र प्रसाद स्थायी अध्यक्ष चुने गए।",
        en: "As the senior-most member, Dr. Sachchidananda Sinha was made provisional chairman; Dr. Rajendra Prasad was later elected permanent President.",
      },
    },
    gk: [
      { hi: "दोनों — पहला (अस्थायी) और पहला स्थायी — अध्यक्ष बिहार से थे: सच्चिदानंद सिन्हा और राजेन्द्र प्रसाद।", en: "Both the first (provisional) and the first permanent chairmen were from Bihar: Sachchidananda Sinha and Rajendra Prasad." },
      { hi: "वे 'हिंदुस्तान रिव्यू' पत्रिका के संपादक और कई शैक्षणिक संस्थाओं के संस्थापक-सहयोगी थे।", en: "He edited the 'Hindustan Review' and helped found several educational institutions." },
      { hi: "पटना विश्वविद्यालय के विकास में उनका योगदान उल्लेखनीय है।", en: "He made a notable contribution to the growth of Patna University." },
    ],
  },
  {
    day: 17,
    quote: {
      hi: "किसान और मज़दूर के हाथ जब तक ख़ाली रहेंगे, स्वराज अधूरा रहेगा।",
      en: "Swaraj will stay unfinished as long as the hands of the farmer and the worker remain empty.",
    },
    author: { hi: "श्रीकृष्ण सिंह (श्री बाबू)", en: "Shri Krishna Singh (Shri Babu)" },
    about: {
      hi: "बिहार के पहले मुख्यमंत्री; 'बिहार केसरी'; मुंगेर ज़िले से; ज़मींदारी उन्मूलन क़ानून लाने वाले पहले मुख्यमंत्रियों में।",
      en: "The first Chief Minister of Bihar; 'Bihar Kesari'; from Munger district; among the first CMs in India to legislate abolition of the zamindari system.",
    },
    affairs: [
      { hi: "बिहार में विधानसभा भवन के पास 'श्रीकृष्ण सिंह' की प्रतिमा है; पटना का 'श्रीकृष्ण मेमोरियल हॉल' उन्हीं के नाम पर है।", en: "A statue of Shri Krishna Singh stands near the Assembly; Patna's Shri Krishna Memorial Hall carries his name." },
      { hi: "उनके कार्यकाल में बरौनी रिफ़ाइनरी, बोकारो और सिंदरी जैसे उद्योगों की नींव बिहार क्षेत्र में पड़ी।", en: "Industries such as the Barauni refinery, Bokaro and Sindri were founded in the Bihar region during his tenure." },
      { hi: "1955 में बोधगया मंदिर अधिनियम उनके नेतृत्व में लागू हुआ।", en: "The Bodh Gaya Temple Act was implemented under his leadership in 1955." },
    ],
    quiz: {
      q: { hi: "बिहार के पहले मुख्यमंत्री कौन थे?", en: "Who was the first Chief Minister of Bihar?" },
      options: [
        { hi: "अनुग्रह नारायण सिन्हा", en: "Anugrah Narayan Sinha" },
        { hi: "श्रीकृष्ण सिंह", en: "Shri Krishna Singh" },
        { hi: "कर्पूरी ठाकुर", en: "Karpoori Thakur" },
        { hi: "बिनोदानंद झा", en: "Binodanand Jha" },
      ],
      answer: 1,
      explain: {
        hi: "श्रीकृष्ण सिंह 1946 से 1961 तक बिहार के मुख्यमंत्री रहे; अनुग्रह नारायण सिन्हा उनके उपमुख्यमंत्री थे।",
        en: "Shri Krishna Singh was CM of Bihar from 1946 to 1961; Anugrah Narayan Sinha was his Deputy CM.",
      },
    },
    gk: [
      { hi: "'श्री बाबू' और 'अनुग्रह बाबू' की जोड़ी को बिहार की राजनीति में 'जोड़ी नंबर 1' कहा जाता था।", en: "The pairing of 'Shri Babu' and 'Anugrah Babu' was called Bihar politics' 'first pair'." },
      { hi: "वे नमक सत्याग्रह में जेल जाने वाले बिहार के प्रमुख नेताओं में थे।", en: "He was among the leading Bihar figures jailed during the Salt Satyagraha." },
      { hi: "उन्हें आधुनिक बिहार के औद्योगिक ढाँचे का शिल्पी माना जाता है।", en: "He is regarded as an architect of modern Bihar's industrial base." },
    ],
  },
  {
    day: 18,
    quote: {
      hi: "राज्य की असली पूँजी उसके गाँव और उसके किसान हैं।",
      en: "A state's real wealth is its villages and its farmers.",
    },
    author: { hi: "डॉ. अनुग्रह नारायण सिन्हा", en: "Dr. Anugrah Narayan Sinha" },
    about: {
      hi: "'बिहार विभूति'; बिहार के पहले उप-मुख्यमंत्री और पहले वित्त मंत्री; औरंगाबाद ज़िले से।",
      en: "'Bihar Vibhuti'; the first Deputy Chief Minister and first Finance Minister of Bihar; from Aurangabad district.",
    },
    affairs: [
      { hi: "पटना का 'अनुग्रह नारायण मगध मेडिकल कॉलेज' (गया) और कई संस्थान उनके नाम पर हैं।", en: "Anugrah Narayan Magadh Medical College (Gaya) and several institutions are named after him." },
      { hi: "उनकी जयंती (18 जून) पर बिहार में 'बिहार विभूति दिवस' मनाया जाता है।", en: "His birth anniversary (18 June) is marked in Bihar as 'Bihar Vibhuti Day'." },
      { hi: "उन्होंने बिहार के लिए संतुलित बजट और ग्रामीण विकास की नींव रखी।", en: "He laid the groundwork for balanced budgeting and rural development in Bihar." },
    ],
    quiz: {
      q: { hi: "'बिहार विभूति' के नाम से किसे जाना जाता है?", en: "Who is remembered as 'Bihar Vibhuti'?" },
      options: [
        { hi: "श्रीकृष्ण सिंह", en: "Shri Krishna Singh" },
        { hi: "अनुग्रह नारायण सिन्हा", en: "Anugrah Narayan Sinha" },
        { hi: "जयप्रकाश नारायण", en: "Jayaprakash Narayan" },
        { hi: "सच्चिदानंद सिन्हा", en: "Sachchidananda Sinha" },
      ],
      answer: 1,
      explain: {
        hi: "अनुग्रह नारायण सिन्हा को 'बिहार विभूति' कहा जाता है; 'बिहार केसरी' श्रीकृष्ण सिंह हैं।",
        en: "Anugrah Narayan Sinha is called 'Bihar Vibhuti'; 'Bihar Kesari' is Shri Krishna Singh.",
      },
    },
    gk: [
      { hi: "वे चंपारण सत्याग्रह (1917) में गांधीजी के सहयोगियों में से थे।", en: "He was among Gandhi's associates in the Champaran Satyagraha of 1917." },
      { hi: "बिहार के पहले मंत्रिमंडल में वित्त, राजस्व और स्थानीय स्वशासन उनके ज़िम्मे थे।", en: "In Bihar's first cabinet he held finance, revenue and local self-government." },
      { hi: "उन्हें 'दीनबंधु' भी कहा जाता था — दीन-दुखियों का सहारा।", en: "He was also called 'Deenbandhu' — friend of the poor and the distressed." },
    ],
  },
  {
    day: 19,
    quote: {
      hi: "समानता माँगी नहीं जाती, उसे अर्जित करने का अवसर छीना नहीं जाना चाहिए।",
      en: "Equality is not to be begged for; the chance to earn it must not be taken away.",
    },
    author: { hi: "बाबू जगजीवन राम", en: "Babu Jagjivan Ram" },
    about: {
      hi: "'बाबूजी'; भोजपुर ज़िले के चंदवा गाँव में जन्मे; भारत के उप-प्रधानमंत्री और दलित सशक्तिकरण के अग्रणी नेता।",
      en: "'Babuji'; born in Chandwa village, Bhojpur district; Deputy Prime Minister of India and a pioneering leader of Dalit empowerment.",
    },
    affairs: [
      { hi: "5 अप्रैल को उनकी जयंती देश भर में 'समता दिवस' के रूप में मनाई जाती है।", en: "His birth anniversary on 5 April is observed nationwide as 'Samta Diwas' (Equality Day)." },
      { hi: "वे 1971 के भारत-पाक युद्ध के समय भारत के रक्षा मंत्री थे।", en: "He was India's Defence Minister during the 1971 India–Pakistan war." },
      { hi: "उन्होंने लगभग 30 वर्ष तक केंद्रीय मंत्री रहकर एक रिकॉर्ड बनाया।", en: "He set a record by serving as a Union minister for nearly 30 years." },
    ],
    quiz: {
      q: { hi: "बाबू जगजीवन राम 1971 के युद्ध के समय भारत के कौन-से मंत्री थे?", en: "Which portfolio did Babu Jagjivan Ram hold during the 1971 war?" },
      options: [
        { hi: "गृह मंत्री", en: "Home Minister" },
        { hi: "रक्षा मंत्री", en: "Defence Minister" },
        { hi: "वित्त मंत्री", en: "Finance Minister" },
        { hi: "कृषि मंत्री", en: "Agriculture Minister" },
      ],
      answer: 1,
      explain: {
        hi: "1971 में बांग्लादेश मुक्ति युद्ध के दौरान वे रक्षा मंत्री थे।",
        en: "He was Defence Minister during the 1971 war that led to the creation of Bangladesh.",
      },
    },
    gk: [
      { hi: "उनकी पुत्री मीरा कुमार लोकसभा की पहली महिला अध्यक्ष बनीं।", en: "His daughter Meira Kumar became the first woman Speaker of the Lok Sabha." },
      { hi: "वे 1977–79 में भारत के उप-प्रधानमंत्री रहे।", en: "He served as Deputy Prime Minister of India from 1977 to 1979." },
      { hi: "छात्र जीवन में ही उन्होंने बनारस में छुआछूत के विरुद्ध आवाज़ उठाई थी।", en: "As a student in Banaras he had already spoken out against untouchability." },
    ],
  },
  {
    day: 20,
    quote: {
      hi: "स्वच्छता और सम्मान हर इंसान का अधिकार है, विशेषाधिकार नहीं।",
      en: "Sanitation and dignity are the right of every human being, not a privilege.",
    },
    author: { hi: "डॉ. बिंदेश्वर पाठक", en: "Dr. Bindeshwar Pathak" },
    about: {
      hi: "'सुलभ इंटरनेशनल' के संस्थापक; वैशाली ज़िले के रामपुर बघेल में जन्मे समाज-सुधारक जिन्होंने कम लागत की शौचालय तकनीक दी।",
      en: "Founder of Sulabh International; social reformer born in Rampur Baghel, Vaishali district, who developed low-cost toilet technology.",
    },
    affairs: [
      { hi: "सुलभ के 'दो गड्ढे वाले' शौचालय मॉडल को स्वच्छता कार्यक्रमों में देश भर में अपनाया गया।", en: "Sulabh's twin-pit toilet model has been adopted in sanitation programmes across India." },
      { hi: "डॉ. पाठक को 1991 में पद्म भूषण मिला; 2023 में उनके निधन पर देश ने शोक जताया।", en: "Dr. Pathak received the Padma Bhushan in 1991; the nation mourned his passing in 2023." },
      { hi: "उन्होंने सिर पर मैला ढोने की प्रथा से मुक्त कराए लोगों के पुनर्वास पर काम किया।", en: "He worked on rehabilitating people freed from the practice of manual scavenging." },
    ],
    quiz: {
      q: { hi: "डॉ. बिंदेश्वर पाठक ने किस संस्था की स्थापना की?", en: "Which organisation did Dr. Bindeshwar Pathak found?" },
      options: [
        { hi: "सुलभ इंटरनेशनल", en: "Sulabh International" },
        { hi: "प्रथम", en: "Pratham" },
        { hi: "गूँज", en: "Goonj" },
        { hi: "सेवा", en: "SEWA" },
      ],
      answer: 0,
      explain: {
        hi: "उन्होंने 1970 में 'सुलभ इंटरनेशनल' शुरू किया, जो स्वच्छता और सामाजिक सुधार पर काम करता है।",
        en: "He started 'Sulabh International' in 1970, working on sanitation and social reform.",
      },
    },
    gk: [
      { hi: "उन्होंने समाजशास्त्र में पीएच.डी. की और छुआछूत पर शोध किया।", en: "He earned a PhD in sociology, researching untouchability." },
      { hi: "सुलभ ने भारत के कई शहरों में 'पे-एंड-यूज़' सार्वजनिक शौचालय की अवधारणा को लोकप्रिय बनाया।", en: "Sulabh popularised the 'pay-and-use' public toilet concept in many Indian cities." },
      { hi: "उन्हें स्टॉकहोम वाटर प्राइज़ सहित कई अंतरराष्ट्रीय सम्मान मिले।", en: "He received many international honours, including the Stockholm Water Prize." },
    ],
  },
  {
    day: 21,
    quote: {
      hi: "अप्प दीपो भव — अपना दीपक स्वयं बनो।",
      en: "Appa dipo bhava — be a light unto yourself.",
    },
    author: { hi: "गौतम बुद्ध", en: "Gautama Buddha" },
    about: {
      hi: "बिहार के बोधगया में पीपल वृक्ष के नीचे उन्हें ज्ञान (बोधि) की प्राप्ति हुई; यहीं से बौद्ध धर्म का आरंभ हुआ।",
      en: "He attained enlightenment (bodhi) under a peepal tree at Bodh Gaya in Bihar; Buddhism began from here.",
    },
    affairs: [
      { hi: "बोधगया का महाबोधि मंदिर 2002 में यूनेस्को विश्व धरोहर घोषित हुआ।", en: "The Mahabodhi Temple at Bodh Gaya was declared a UNESCO World Heritage Site in 2002." },
      { hi: "हर साल दुनिया भर से लाखों बौद्ध श्रद्धालु बोधगया और नालंदा आते हैं।", en: "Every year lakhs of Buddhist pilgrims from around the world visit Bodh Gaya and Nalanda." },
      { hi: "गया में फल्गु नदी पर 'गयाजी धाम' रबर बांध बनने से साल भर जल उपलब्ध रहता है।", en: "A rubber dam on the Falgu river at Gaya now keeps water available year-round for rituals." },
    ],
    quiz: {
      q: { hi: "गौतम बुद्ध को ज्ञान की प्राप्ति बिहार के किस स्थान पर हुई?", en: "At which place in Bihar did Gautama Buddha attain enlightenment?" },
      options: [
        { hi: "राजगीर", en: "Rajgir" },
        { hi: "वैशाली", en: "Vaishali" },
        { hi: "बोधगया", en: "Bodh Gaya" },
        { hi: "नालंदा", en: "Nalanda" },
      ],
      answer: 2,
      explain: {
        hi: "बोधगया में निरंजना (फल्गु) नदी के किनारे बोधि वृक्ष के नीचे उन्हें ज्ञान मिला।",
        en: "He was enlightened under the Bodhi tree beside the Niranjana (Falgu) river at Bodh Gaya.",
      },
    },
    gk: [
      { hi: "बुद्ध ने अपना पहला उपदेश सारनाथ में दिया, पर उनका अधिकांश जीवन मगध (आज का बिहार) में बीता।", en: "The Buddha gave his first sermon at Sarnath, but spent much of his life in Magadha (modern Bihar)." },
      { hi: "राजगीर की गृध्रकूट पहाड़ी और वेणुवन उनसे जुड़े प्रमुख स्थल हैं।", en: "Gridhrakuta hill and Venuvana at Rajgir are important sites linked to him." },
      { hi: "'बिहार' नाम संस्कृत के 'विहार' (बौद्ध मठ) से बना है।", en: "The name 'Bihar' comes from the Sanskrit 'vihara' (Buddhist monastery)." },
    ],
  },
  {
    day: 22,
    quote: {
      hi: "जियो और जीने दो; अहिंसा ही परम धर्म है।",
      en: "Live and let live; non-violence is the highest virtue.",
    },
    author: { hi: "भगवान महावीर", en: "Bhagwan Mahavir" },
    about: {
      hi: "जैन धर्म के 24वें तीर्थंकर; उनका जन्म वैशाली के निकट कुंडग्राम में हुआ माना जाता है।",
      en: "The 24th Tirthankara of Jainism; he is traditionally held to have been born at Kundagrama, near Vaishali.",
    },
    affairs: [
      { hi: "'महावीर जयंती' पर बिहार के पावापुरी और वैशाली में बड़े आयोजन होते हैं।", en: "'Mahavir Jayanti' sees large gatherings at Pawapuri and Vaishali in Bihar." },
      { hi: "नालंदा ज़िले के पावापुरी में 'जल मंदिर' महावीर के निर्वाण स्थल पर बना है।", en: "The 'Jal Mandir' at Pawapuri, Nalanda district, marks the place of Mahavir's nirvana." },
      { hi: "वैशाली में 'अभिषेक पुष्करिणी' और अशोक स्तंभ जैसे स्थल पर्यटन-सर्किट का हिस्सा हैं।", en: "Sites at Vaishali like the coronation tank and the Ashokan pillar are part of the tourism circuit." },
    ],
    quiz: {
      q: { hi: "भगवान महावीर का निर्वाण बिहार के किस स्थान पर हुआ?", en: "At which place in Bihar did Bhagwan Mahavir attain nirvana?" },
      options: [
        { hi: "पावापुरी", en: "Pawapuri" },
        { hi: "बोधगया", en: "Bodh Gaya" },
        { hi: "राजगीर", en: "Rajgir" },
        { hi: "सासाराम", en: "Sasaram" },
      ],
      answer: 0,
      explain: {
        hi: "पावापुरी (नालंदा ज़िला) में महावीर को निर्वाण प्राप्त हुआ; वहाँ का जल मंदिर इसी की स्मृति है।",
        en: "Mahavir attained nirvana at Pawapuri (Nalanda district); the Jal Mandir there commemorates it.",
      },
    },
    gk: [
      { hi: "महावीर और गौतम बुद्ध समकालीन थे और दोनों ने मगध क्षेत्र में उपदेश दिए।", en: "Mahavir and Gautama Buddha were contemporaries, and both taught in the Magadha region." },
      { hi: "वैशाली को दुनिया के पहले गणराज्यों में से एक माना जाता है (लिच्छवि/वज्जि संघ)।", en: "Vaishali is regarded as one of the world's earliest republics (the Licchavi/Vajji confederacy)." },
      { hi: "जैन परंपरा में महावीर के पाँच व्रत हैं: अहिंसा, सत्य, अस्तेय, ब्रह्मचर्य और अपरिग्रह।", en: "In Jain tradition, Mahavir's five vows are non-violence, truth, non-stealing, celibacy and non-possession." },
    ],
  },
  {
    day: 23,
    quote: {
      hi: "सभी मनुष्य मेरी संतान हैं।",
      en: "All people are my children.",
    },
    author: { hi: "सम्राट अशोक", en: "Emperor Ashoka" },
    about: {
      hi: "मौर्य सम्राट जिनकी राजधानी पाटलिपुत्र (पटना) थी; कलिंग युद्ध के बाद उन्होंने अहिंसा और धम्म का मार्ग अपनाया।",
      en: "The Maurya emperor whose capital was Pataliputra (Patna); after the Kalinga war he embraced non-violence and dhamma.",
    },
    affairs: [
      { hi: "भारत का राष्ट्रीय प्रतीक — 'अशोक स्तंभ' का सिंह शीर्ष — सारनाथ से लिया गया है, पर यह परंपरा मगध की देन है।", en: "India's national emblem — the lion capital — is from Sarnath, but the tradition belongs to Magadha." },
      { hi: "बिहार में वैशाली, लौरिया-नंदनगढ़ और लौरिया-अरेराज में आज भी अशोक स्तंभ खड़े हैं।", en: "Ashokan pillars still stand in Bihar at Vaishali, Lauriya-Nandangarh and Lauriya-Areraj." },
      { hi: "पटना के कुम्हरार में मौर्यकालीन 80-स्तंभों वाले सभा-भवन के अवशेष मिले हैं।", en: "Remains of an 80-pillared Mauryan assembly hall have been found at Kumhrar in Patna." },
    ],
    quiz: {
      q: { hi: "सम्राट अशोक की राजधानी कौन-सी थी?", en: "What was Emperor Ashoka's capital?" },
      options: [
        { hi: "उज्जयिनी", en: "Ujjayini" },
        { hi: "पाटलिपुत्र", en: "Pataliputra" },
        { hi: "तक्षशिला", en: "Takshashila" },
        { hi: "कन्नौज", en: "Kannauj" },
      ],
      answer: 1,
      explain: {
        hi: "मौर्य साम्राज्य की राजधानी पाटलिपुत्र थी, जो आज का पटना है।",
        en: "The Maurya capital was Pataliputra, which is today's Patna.",
      },
    },
    gk: [
      { hi: "अशोक ने अपने संदेश चट्टानों और स्तंभों पर खुदवाए — ये 'अशोक के अभिलेख' कहलाते हैं।", en: "Ashoka had his messages carved on rocks and pillars — these are the 'Ashokan edicts'." },
      { hi: "कलिंग युद्ध की भारी हिंसा देखकर उन्होंने युद्ध त्याग दिया।", en: "The great bloodshed of the Kalinga war led him to renounce war." },
      { hi: "पाटलिपुत्र मौर्य और गुप्त — दोनों साम्राज्यों की राजधानी रहा।", en: "Pataliputra served as the capital of both the Maurya and the Gupta empires." },
    ],
  },
  {
    day: 24,
    quote: {
      hi: "एक साधारण व्यक्ति भी दृढ़ संकल्प से साम्राज्य खड़ा कर सकता है।",
      en: "Even an ordinary person can build an empire with firm resolve.",
    },
    author: { hi: "चंद्रगुप्त मौर्य", en: "Chandragupta Maurya" },
    about: {
      hi: "मौर्य साम्राज्य के संस्थापक; चाणक्य के मार्गदर्शन में उन्होंने पाटलिपुत्र से एक विशाल साम्राज्य स्थापित किया।",
      en: "Founder of the Maurya empire; guided by Chanakya, he built a vast empire from Pataliputra.",
    },
    affairs: [
      { hi: "मेगस्थनीज़ (सेल्यूकस का राजदूत) ने चंद्रगुप्त के पाटलिपुत्र का वर्णन अपनी पुस्तक 'इंडिका' में किया।", en: "Megasthenes, envoy of Seleucus, described Chandragupta's Pataliputra in his book 'Indica'." },
      { hi: "पटना के पास 'बुलंदी बाग़' और 'कुम्हरार' में मौर्यकालीन काठ की नगर-प्राचीर के अवशेष मिले हैं।", en: "Remains of the Mauryan wooden city wall have been found near Patna at Bulandi Bagh and Kumhrar." },
      { hi: "मौर्य काल का पाटलिपुत्र उस समय दुनिया के सबसे बड़े नगरों में से एक था।", en: "Mauryan-era Pataliputra was among the largest cities in the world at the time." },
    ],
    quiz: {
      q: { hi: "मौर्य साम्राज्य की स्थापना किसने की?", en: "Who founded the Maurya empire?" },
      options: [
        { hi: "बिंदुसार", en: "Bindusara" },
        { hi: "चंद्रगुप्त मौर्य", en: "Chandragupta Maurya" },
        { hi: "अशोक", en: "Ashoka" },
        { hi: "अजातशत्रु", en: "Ajatashatru" },
      ],
      answer: 1,
      explain: {
        hi: "चंद्रगुप्त मौर्य ने लगभग 321 ईसा पूर्व नंद वंश को हराकर मौर्य साम्राज्य की नींव रखी।",
        en: "Chandragupta Maurya founded the empire around 321 BCE by defeating the Nanda dynasty.",
      },
    },
    gk: [
      { hi: "उन्होंने सेल्यूकस निकेटर को हराकर संधि की और अफ़ग़ानिस्तान तक का क्षेत्र प्राप्त किया।", en: "He defeated Seleucus Nicator and gained territory up to Afghanistan in the treaty that followed." },
      { hi: "जैन परंपरा के अनुसार उन्होंने अंत में राजपाट त्याग कर संन्यास ले लिया।", en: "Jain tradition holds that he finally renounced the throne and became an ascetic." },
      { hi: "उनके पोते अशोक ने साम्राज्य को अपने चरम विस्तार तक पहुँचाया।", en: "His grandson Ashoka took the empire to its greatest extent." },
    ],
  },
  {
    day: 25,
    quote: {
      hi: "अच्छी सड़कें और न्याय की सुलभता — यही राज्य की असली ताक़त है।",
      en: "Good roads and easy access to justice — that is a state's real strength.",
    },
    author: { hi: "शेर शाह सूरी", en: "Sher Shah Suri" },
    about: {
      hi: "सासाराम (रोहतास) से जुड़े शासक; प्रशासनिक सुधारों और ग्रैंड ट्रंक रोड के आधुनिकीकरण के लिए प्रसिद्ध।",
      en: "A ruler linked to Sasaram (Rohtas); famed for administrative reform and for modernising the Grand Trunk Road.",
    },
    affairs: [
      { hi: "सासाराम में झील के बीच बना 'शेर शाह सूरी का मक़बरा' इंडो-इस्लामिक स्थापत्य का उत्कृष्ट उदाहरण है।", en: "Sher Shah Suri's tomb, set in the middle of a lake at Sasaram, is a fine example of Indo-Islamic architecture." },
      { hi: "उनका बनवाया 'रुपया' (चाँदी का सिक्का) आधुनिक भारतीय मुद्रा के नाम का स्रोत है।", en: "The silver coin he introduced, the 'rupiya', is the source of the name of India's currency." },
      { hi: "ग्रैंड ट्रंक रोड आज भी बिहार से होकर गुज़रती है (राष्ट्रीय राजमार्ग के रूप में)।", en: "The Grand Trunk Road still runs through Bihar today, as a national highway." },
    ],
    quiz: {
      q: { hi: "'रुपया' नामक चाँदी का सिक्का किसने चलाया?", en: "Who introduced the silver coin called the 'rupiya'?" },
      options: [
        { hi: "अकबर", en: "Akbar" },
        { hi: "शेर शाह सूरी", en: "Sher Shah Suri" },
        { hi: "बलबन", en: "Balban" },
        { hi: "अलाउद्दीन ख़िलजी", en: "Alauddin Khilji" },
      ],
      answer: 1,
      explain: {
        hi: "शेर शाह सूरी ने प्रशासनिक सुधारों के साथ मानक 'रुपया' सिक्का चलाया, जो आगे चलकर मुद्रा का नाम बना।",
        en: "Sher Shah Suri, along with his administrative reforms, issued the standard 'rupiya' coin, which later gave the currency its name.",
      },
    },
    gk: [
      { hi: "उन्होंने डाक-चौकी (सराय) प्रणाली शुरू की, जिससे संदेश तेज़ी से पहुँचते थे।", en: "He set up a system of post-stations (sarais) so that messages travelled quickly." },
      { hi: "उन्होंने भूमि की पैमाइश कर लगान तय करने की व्यवस्था दी, जिसे बाद में अकबर ने अपनाया।", en: "He introduced land measurement to fix revenue, a system later adopted by Akbar." },
      { hi: "उनका असली नाम फ़रीद ख़ान था; बचपन में शेर मारने पर 'शेर ख़ान' कहलाए।", en: "His real name was Farid Khan; he earned the title 'Sher Khan' after killing a tiger in his youth." },
    ],
  },
  {
    day: 26,
    quote: {
      hi: "एक अकेले किसान की पुकार ने भी इतिहास की धारा मोड़ दी।",
      en: "Even the call of one lone farmer turned the course of history.",
    },
    author: { hi: "राजकुमार शुक्ल", en: "Rajkumar Shukla" },
    about: {
      hi: "पश्चिम चंपारण के किसान, जिनके बार-बार आग्रह पर महात्मा गांधी 1917 में चंपारण आए — उनका पहला सत्याग्रह।",
      en: "A farmer of West Champaran whose repeated pleading brought Mahatma Gandhi to Champaran in 1917 — his first satyagraha in India.",
    },
    affairs: [
      { hi: "चंपारण सत्याग्रह के 100 वर्ष (2017) पर बिहार में साल भर 'चंपारण शताब्दी' आयोजन हुए।", en: "The centenary of the Champaran Satyagraha (2017) was marked with a year of events across Bihar." },
      { hi: "मोतिहारी में 'गांधी संग्रहालय' और भितिहरवा आश्रम इस आंदोलन की स्मृति में हैं।", en: "The Gandhi Museum in Motihari and the Bhitiharwa Ashram preserve the memory of this movement." },
      { hi: "चंपारण की 'तिनकठिया' प्रथा (नील की ज़बरन खेती) इसी सत्याग्रह से समाप्त हुई।", en: "Champaran's 'tinkathia' system, which forced farmers to grow indigo, was ended by this satyagraha." },
    ],
    quiz: {
      q: { hi: "महात्मा गांधी का भारत में पहला सत्याग्रह कहाँ हुआ?", en: "Where did Mahatma Gandhi lead his first satyagraha in India?" },
      options: [
        { hi: "खेड़ा", en: "Kheda" },
        { hi: "चंपारण", en: "Champaran" },
        { hi: "बारदोली", en: "Bardoli" },
        { hi: "अहमदाबाद", en: "Ahmedabad" },
      ],
      answer: 1,
      explain: {
        hi: "1917 में चंपारण (बिहार) में नील किसानों के लिए गांधीजी का सत्याग्रह उनका भारत में पहला सत्याग्रह था।",
        en: "Gandhi's 1917 satyagraha for indigo farmers in Champaran, Bihar, was his first in India.",
      },
    },
    gk: [
      { hi: "राजकुमार शुक्ल गांधीजी से लखनऊ कांग्रेस अधिवेशन (1916) में मिले और पीछे पड़ गए कि वे चंपारण आएँ।", en: "Rajkumar Shukla met Gandhi at the 1916 Lucknow Congress and doggedly persuaded him to come to Champaran." },
      { hi: "इसी आंदोलन में डॉ. राजेन्द्र प्रसाद, अनुग्रह नारायण सिन्हा और ब्रजकिशोर प्रसाद गांधीजी से जुड़े।", en: "Dr. Rajendra Prasad, Anugrah Narayan Sinha and Brajkishore Prasad joined Gandhi during this movement." },
      { hi: "चंपारण ने ही गांधीजी को 'सत्याग्रह' का पहला बड़ा प्रयोग-स्थल दिया।", en: "Champaran gave Gandhi the first large testing ground for 'satyagraha'." },
    ],
  },
  {
    day: 27,
    quote: {
      hi: "सवाल पूछना बंद मत कीजिए — जागरूक नागरिक ही लोकतंत्र की ताक़त है।",
      en: "Never stop asking questions — an aware citizen is the strength of a democracy.",
    },
    author: { hi: "रवीश कुमार", en: "Ravish Kumar" },
    about: {
      hi: "पूर्वी चंपारण के जितवारपुर गाँव में जन्मे पत्रकार; हिंदी टेलीविज़न पत्रकारिता के लिए रेमन मैग्सेसे पुरस्कार से सम्मानित।",
      en: "Journalist born in Jitwarpur village, East Champaran; a Ramon Magsaysay Award winner for Hindi television journalism.",
    },
    affairs: [
      { hi: "रवीश कुमार को 2019 में रेमन मैग्सेसे पुरस्कार मिला।", en: "Ravish Kumar received the Ramon Magsaysay Award in 2019." },
      { hi: "उन्हें गणेश शंकर विद्यार्थी और कुलदीप नैयर जैसे पत्रकारिता सम्मान भी मिल चुके हैं।", en: "He has also received journalism honours such as the Ganesh Shankar Vidyarthi and Kuldip Nayar awards." },
      { hi: "उनकी किताबें 'इश्क़ में शहर होना' और 'द फ्री वॉइस' चर्चित रही हैं।", en: "His books 'Ishq Mein Shahar Hona' and 'The Free Voice' have been widely read." },
    ],
    quiz: {
      q: { hi: "रवीश कुमार को 2019 में कौन-सा प्रमुख पुरस्कार मिला?", en: "Which major award did Ravish Kumar receive in 2019?" },
      options: [
        { hi: "रेमन मैग्सेसे पुरस्कार", en: "Ramon Magsaysay Award" },
        { hi: "पुलित्ज़र पुरस्कार", en: "Pulitzer Prize" },
        { hi: "ज्ञानपीठ पुरस्कार", en: "Jnanpith Award" },
        { hi: "दादा साहब फाल्के पुरस्कार", en: "Dadasaheb Phalke Award" },
      ],
      answer: 0,
      explain: {
        hi: "उन्हें हिंदी पत्रकारिता में आम लोगों के मुद्दे उठाने के लिए 2019 का रेमन मैग्सेसे पुरस्कार मिला।",
        en: "He won the 2019 Ramon Magsaysay Award for highlighting ordinary people's concerns in Hindi journalism.",
      },
    },
    gk: [
      { hi: "बिहार से रेमन मैग्सेसे पुरस्कार पाने वालों में जयप्रकाश नारायण और किरण बेदी (गैर-बिहारी) से आगे रवीश कुमार का नाम जुड़ा।", en: "Ravish Kumar joined Jayaprakash Narayan among Bihar-linked recipients of the Ramon Magsaysay Award." },
      { hi: "उन्होंने पढ़ाई पटना के लोयोला हाई स्कूल और फिर दिल्ली विश्वविद्यालय से की।", en: "He studied at Loyola High School, Patna, and then at the University of Delhi." },
      { hi: "उनका कार्यक्रम 'प्राइम टाइम' आम नागरिकों की समस्याओं पर केंद्रित रहा।", en: "His programme 'Prime Time' focused on the problems of ordinary citizens." },
    ],
  },
  {
    day: 28,
    quote: {
      hi: "संघर्ष ही कलाकार की असली पाठशाला है।",
      en: "Struggle is an artist's real school.",
    },
    author: { hi: "पंकज त्रिपाठी", en: "Pankaj Tripathi" },
    about: {
      hi: "गोपालगंज ज़िले के बेलसंड (बरौली के पास) गाँव में जन्मे अभिनेता; रंगमंच से निकलकर राष्ट्रीय पहचान बनाई।",
      en: "Actor born in a village near Barauli, Gopalganj district; he rose from theatre to national recognition.",
    },
    affairs: [
      { hi: "पंकज त्रिपाठी को फ़िल्म 'न्यूटन' और वेब-सीरीज़ 'मिर्ज़ापुर' के लिए विशेष सराहना मिली।", en: "Pankaj Tripathi drew wide praise for the film 'Newton' and the web series 'Mirzapur'." },
      { hi: "उन्हें 2024 में पद्म श्री से सम्मानित किया गया।", en: "He was awarded the Padma Shri in 2024." },
      { hi: "उन्होंने कई फ़िल्मों में बिहार की बोली और परिवेश को परदे पर प्रामाणिकता से दिखाया।", en: "He has brought Bihar's dialect and settings to the screen with authenticity in many films." },
    ],
    quiz: {
      q: { hi: "अभिनेता पंकज त्रिपाठी बिहार के किस ज़िले से हैं?", en: "Actor Pankaj Tripathi is from which district of Bihar?" },
      options: [
        { hi: "गोपालगंज", en: "Gopalganj" },
        { hi: "मुज़फ़्फ़रपुर", en: "Muzaffarpur" },
        { hi: "पूर्णिया", en: "Purnia" },
        { hi: "आरा", en: "Arrah" },
      ],
      answer: 0,
      explain: {
        hi: "वे गोपालगंज ज़िले के एक किसान परिवार से आते हैं और खेती में हाथ बँटाते हुए बड़े हुए।",
        en: "He comes from a farming family in Gopalganj district and grew up helping on the farm.",
      },
    },
    gk: [
      { hi: "बिहार के कई कलाकारों ने राष्ट्रीय सिनेमा में जगह बनाई — जैसे मनोज बाजपेयी (बेतिया) और नीतू चंद्रा (पटना)।", en: "Many artists from Bihar have made their mark in national cinema — such as Manoj Bajpayee (Bettiah) and Neetu Chandra (Patna)." },
      { hi: "पंकज त्रिपाठी ने दिल्ली के 'राष्ट्रीय नाट्य विद्यालय' (NSD) से प्रशिक्षण लिया।", en: "Pankaj Tripathi trained at the National School of Drama (NSD) in Delhi." },
      { hi: "छात्र जीवन में वे पटना में जेपी आंदोलन से प्रेरित छात्र-राजनीति में भी सक्रिय रहे।", en: "As a student in Patna he was active in student politics inspired by the JP movement." },
    ],
  },
  {
    day: 29,
    quote: {
      hi: "सपने देखना कभी बंद मत करना — यही तुम्हें आगे ले जाएँगे।",
      en: "Never stop dreaming — your dreams are what carry you forward.",
    },
    author: { hi: "सुशांत सिंह राजपूत", en: "Sushant Singh Rajput" },
    about: {
      hi: "पटना/पूर्णिया से जुड़े अभिनेता; इंजीनियरिंग की पढ़ाई छोड़कर अभिनय में आए; खगोल-विज्ञान और शिक्षा में गहरी रुचि रखते थे।",
      en: "Actor with roots in Patna/Purnia; he left engineering studies for acting and had a deep interest in astronomy and education.",
    },
    affairs: [
      { hi: "उनकी फ़िल्म 'एम.एस. धोनी: द अनटोल्ड स्टोरी' और 'छिछोरे' बहुत सराही गईं।", en: "His films 'M.S. Dhoni: The Untold Story' and 'Chhichhore' were widely appreciated." },
      { hi: "उन्होंने एक टेलीस्कोप ख़रीदा था और चंद्रमा पर ज़मीन के दस्तावेज़ की बात मशहूर हुई थी।", en: "He owned a telescope, and news of his 'buying land on the Moon' became well known." },
      { hi: "उनके निधन (2020) के बाद युवाओं के लिए कई शिक्षा-छात्रवृत्ति पहल उनके नाम से शुरू हुईं।", en: "After his death in 2020, several education and scholarship initiatives for youth were started in his name." },
    ],
    quiz: {
      q: { hi: "सुशांत सिंह राजपूत ने किस क्रिकेटर की बायोपिक में मुख्य भूमिका निभाई?", en: "Sushant Singh Rajput played the lead in the biopic of which cricketer?" },
      options: [
        { hi: "सचिन तेंदुलकर", en: "Sachin Tendulkar" },
        { hi: "एम.एस. धोनी", en: "M.S. Dhoni" },
        { hi: "कपिल देव", en: "Kapil Dev" },
        { hi: "सौरव गांगुली", en: "Sourav Ganguly" },
      ],
      answer: 1,
      explain: {
        hi: "2016 की फ़िल्म 'एम.एस. धोनी: द अनटोल्ड स्टोरी' में उन्होंने धोनी की भूमिका निभाई।",
        en: "He played M.S. Dhoni in the 2016 film 'M.S. Dhoni: The Untold Story'.",
      },
    },
    gk: [
      { hi: "वे पढ़ाई में तेज़ थे — दिल्ली कॉलेज ऑफ़ इंजीनियरिंग में प्रवेश-परीक्षा में उन्होंने अच्छी रैंक पाई थी।", en: "He was a strong student — he secured a good rank in the entrance exam for Delhi College of Engineering." },
      { hi: "उन्होंने अभिनय की शुरुआत टीवी धारावाहिक 'पवित्र रिश्ता' से की।", en: "He began his acting career with the TV serial 'Pavitra Rishta'." },
      { hi: "बिहार के कई युवाओं के लिए वे 'छोटे शहर से बड़ा सपना' की मिसाल माने जाते हैं।", en: "For many young people in Bihar he stands as an example of 'a big dream from a small town'." },
    ],
  },
  {
    day: 30,
    quote: {
      hi: "अवसर की समानता मिले, तो कोई भी बच्चा कहीं भी पहुँच सकता है।",
      en: "Given equal opportunity, any child can rise anywhere.",
    },
    author: { hi: "मीरा कुमार", en: "Meira Kumar" },
    about: {
      hi: "बाबू जगजीवन राम की पुत्री; पूर्व विदेश सेवा अधिकारी और लोकसभा की पहली महिला अध्यक्ष (2009–2014)।",
      en: "Daughter of Babu Jagjivan Ram; a former Foreign Service officer and the first woman Speaker of the Lok Sabha (2009–2014).",
    },
    affairs: [
      { hi: "मीरा कुमार बिहार के सासाराम निर्वाचन क्षेत्र से कई बार सांसद रहीं।", en: "Meira Kumar was elected several times as a Member of Parliament from the Sasaram constituency in Bihar." },
      { hi: "लोकसभा अध्यक्ष के रूप में उन्होंने सदन की कार्यवाही के डिजिटल रिकॉर्ड और संग्रहालय पर ज़ोर दिया।", en: "As Speaker she pushed for digital records of House proceedings and a parliamentary museum." },
      { hi: "2017 में वे राष्ट्रपति पद की उम्मीदवार रहीं।", en: "In 2017 she was a candidate for the office of President of India." },
    ],
    quiz: {
      q: { hi: "लोकसभा की पहली महिला अध्यक्ष कौन थीं?", en: "Who was the first woman Speaker of the Lok Sabha?" },
      options: [
        { hi: "सुमित्रा महाजन", en: "Sumitra Mahajan" },
        { hi: "मीरा कुमार", en: "Meira Kumar" },
        { hi: "सरोजिनी नायडू", en: "Sarojini Naidu" },
        { hi: "विजया लक्ष्मी पंडित", en: "Vijaya Lakshmi Pandit" },
      ],
      answer: 1,
      explain: {
        hi: "मीरा कुमार 2009 में लोकसभा की पहली महिला अध्यक्ष बनीं; वे बिहार के सासाराम से सांसद थीं।",
        en: "Meira Kumar became the first woman Speaker of the Lok Sabha in 2009; she was an MP from Sasaram, Bihar.",
      },
    },
    gk: [
      { hi: "वे भारतीय विदेश सेवा (IFS) की अधिकारी रहीं और स्पेन, ब्रिटेन तथा मॉरीशस में तैनात रहीं।", en: "She served in the Indian Foreign Service (IFS), with postings in Spain, the UK and Mauritius." },
      { hi: "उनके पिता बाबू जगजीवन राम भारत के उप-प्रधानमंत्री रह चुके हैं — पिता-पुत्री, दोनों शीर्ष संवैधानिक भूमिकाओं में।", en: "Her father, Babu Jagjivan Ram, was Deputy Prime Minister — father and daughter both in top constitutional roles." },
      { hi: "वे केंद्रीय सामाजिक न्याय एवं जल संसाधन मंत्री भी रहीं।", en: "She also served as Union Minister for Social Justice and for Water Resources." },
    ],
  },
];
