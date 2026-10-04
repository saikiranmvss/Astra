"use strict";
/* Display-name tables. The engine always returns canonical English
   transliterations; the UI translates them for display only. */

const LANGS = { en: "English", te: "తెలుగు", hi: "हिन्दी", sa: "संस्कृतम्" };

const EN = {
  rashi: ["Mesha", "Vrishabha", "Mithuna", "Karka", "Simha", "Kanya", "Tula", "Vrishchika", "Dhanu", "Makara", "Kumbha", "Meena"],
  nakshatra: ["Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra", "Punarvasu", "Pushya", "Ashlesha", "Magha",
    "Purva Phalguni", "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha", "Mula",
    "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishtha", "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati"],
  tithi: ["Pratipada", "Dvitiya", "Tritiya", "Chaturthi", "Panchami", "Shashthi", "Saptami", "Ashtami", "Navami", "Dashami",
    "Ekadashi", "Dvadashi", "Trayodashi", "Chaturdashi", "Purnima", "Amavasya"],
  yoga: ["Vishkambha", "Priti", "Ayushman", "Saubhagya", "Shobhana", "Atiganda", "Sukarma", "Dhriti", "Shula", "Ganda",
    "Vriddhi", "Dhruva", "Vyaghata", "Harshana", "Vajra", "Siddhi", "Vyatipata", "Variyan", "Parigha", "Shiva", "Siddha",
    "Sadhya", "Shubha", "Shukla", "Brahma", "Indra", "Vaidhriti"],
  karana: ["Bava", "Balava", "Kaulava", "Taitila", "Gara", "Vanija", "Vishti", "Shakuni", "Chatushpada", "Naga", "Kimstughna"],
  vara: ["Ravivara", "Somavara", "Mangalavara", "Budhavara", "Guruvara", "Shukravara", "Shanivara"],
  month: ["Chaitra", "Vaishakha", "Jyeshtha", "Ashadha", "Shravana", "Bhadrapada", "Ashvayuja", "Kartika", "Margashira", "Pushya", "Magha", "Phalguna"],
  graha: ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu", "Lagna"],
  paksha: ["Shukla", "Krishna"],
  ritu: ["Vasanta", "Grishma", "Varsha", "Sharad", "Hemanta", "Shishira"],
  chog: ["Amrit", "Shubh", "Labh", "Char", "Rog", "Kaal", "Udveg"],
  samvatsara: ["Prabhava", "Vibhava", "Shukla", "Pramoduta", "Prajotpatti", "Angirasa", "Shrimukha", "Bhava", "Yuva", "Dhatu",
    "Ishvara", "Bahudhanya", "Pramathi", "Vikrama", "Vrisha", "Chitrabhanu", "Svabhanu", "Tarana", "Parthiva", "Vyaya",
    "Sarvajit", "Sarvadhari", "Virodhi", "Vikriti", "Khara", "Nandana", "Vijaya", "Jaya", "Manmatha", "Durmukhi",
    "Hevilambi", "Vilambi", "Vikari", "Sharvari", "Plava", "Shubhakrit", "Shobhakrit", "Krodhi", "Vishvavasu", "Parabhava",
    "Plavanga", "Kilaka", "Saumya", "Sadharana", "Virodhikrit", "Paridhavi", "Pramadicha", "Ananda", "Rakshasa", "Nala",
    "Pingala", "Kalayukti", "Siddharthi", "Raudri", "Durmati", "Dundubhi", "Rudhirodgari", "Raktakshi", "Krodhana", "Akshaya"],
};

const DEV = {
  rashi: ["मेष", "वृषभ", "मिथुन", "कर्क", "सिंह", "कन्या", "तुला", "वृश्चिक", "धनु", "मकर", "कुम्भ", "मीन"],
  nakshatra: ["अश्विनी", "भरणी", "कृत्तिका", "रोहिणी", "मृगशिरा", "आर्द्रा", "पुनर्वसु", "पुष्य", "आश्लेषा", "मघा",
    "पूर्वफाल्गुनी", "उत्तरफाल्गुनी", "हस्त", "चित्रा", "स्वाति", "विशाखा", "अनुराधा", "ज्येष्ठा", "मूल",
    "पूर्वाषाढा", "उत्तराषाढा", "श्रवण", "धनिष्ठा", "शतभिषा", "पूर्वभाद्रपदा", "उत्तरभाद्रपदा", "रेवती"],
  tithi: ["प्रतिपदा", "द्वितीया", "तृतीया", "चतुर्थी", "पंचमी", "षष्ठी", "सप्तमी", "अष्टमी", "नवमी", "दशमी",
    "एकादशी", "द्वादशी", "त्रयोदशी", "चतुर्दशी", "पूर्णिमा", "अमावस्या"],
  yoga: ["विष्कम्भ", "प्रीति", "आयुष्मान्", "सौभाग्य", "शोभन", "अतिगण्ड", "सुकर्मा", "धृति", "शूल", "गण्ड",
    "वृद्धि", "ध्रुव", "व्याघात", "हर्षण", "वज्र", "सिद्धि", "व्यतीपात", "वरीयान्", "परिघ", "शिव", "सिद्ध",
    "साध्य", "शुभ", "शुक्ल", "ब्रह्म", "इन्द्र", "वैधृति"],
  karana: ["बव", "बालव", "कौलव", "तैतिल", "गर", "वणिज", "विष्टि", "शकुनि", "चतुष्पद", "नाग", "किंस्तुघ्न"],
  vara: ["रविवार", "सोमवार", "मंगलवार", "बुधवार", "गुरुवार", "शुक्रवार", "शनिवार"],
  month: ["चैत्र", "वैशाख", "ज्येष्ठ", "आषाढ", "श्रावण", "भाद्रपद", "आश्विन", "कार्तिक", "मार्गशीर्ष", "पौष", "माघ", "फाल्गुन"],
  graha: ["सूर्य", "चन्द्र", "मंगल", "बुध", "गुरु", "शुक्र", "शनि", "राहु", "केतु", "लग्न"],
  paksha: ["शुक्ल", "कृष्ण"],
  ritu: ["वसन्त", "ग्रीष्म", "वर्षा", "शरद्", "हेमन्त", "शिशिर"],
  chog: ["अमृत", "शुभ", "लाभ", "चर", "रोग", "काल", "उद्वेग"],
  samvatsara: ["प्रभव", "विभव", "शुक्ल", "प्रमोदूत", "प्रजोत्पत्ति", "आङ्गिरस", "श्रीमुख", "भाव", "युवा", "धाता",
    "ईश्वर", "बहुधान्य", "प्रमाथी", "विक्रम", "वृष", "चित्रभानु", "स्वभानु", "तारण", "पार्थिव", "व्यय",
    "सर्वजित्", "सर्वधारी", "विरोधी", "विकृति", "खर", "नन्दन", "विजय", "जय", "मन्मथ", "दुर्मुखी",
    "हेविलम्बी", "विलम्बी", "विकारी", "शार्वरी", "प्लव", "शुभकृत्", "शोभकृत्", "क्रोधी", "विश्वावसु", "पराभव",
    "प्लवङ्ग", "कीलक", "सौम्य", "साधारण", "विरोधिकृत्", "परिधावी", "प्रमादी", "आनन्द", "राक्षस", "नल",
    "पिङ्गल", "कालयुक्त", "सिद्धार्थी", "रौद्र", "दुर्मति", "दुन्दुभि", "रुधिरोद्गारी", "रक्ताक्षी", "क्रोधन", "अक्षय"],
};

const SA = Object.assign({}, DEV, {
  tithi: ["प्रतिपत्", "द्वितीया", "तृतीया", "चतुर्थी", "पञ्चमी", "षष्ठी", "सप्तमी", "अष्टमी", "नवमी", "दशमी",
    "एकादशी", "द्वादशी", "त्रयोदशी", "चतुर्दशी", "पूर्णिमा", "अमावास्या"],
  vara: ["भानुवासरः", "सोमवासरः", "भौमवासरः", "सौम्यवासरः", "गुरुवासरः", "भृगुवासरः", "स्थिरवासरः"],
  month: ["चैत्रः", "वैशाखः", "ज्येष्ठः", "आषाढः", "श्रावणः", "भाद्रपदः", "आश्वयुजः", "कार्तिकः", "मार्गशीर्षः", "पौषः", "माघः", "फाल्गुनः"],
  graha: ["सूर्यः", "चन्द्रः", "कुजः", "बुधः", "गुरुः", "शुक्रः", "शनिः", "राहुः", "केतुः", "लग्नम्"],
});

const TE = {
  rashi: ["మేషం", "వృషభం", "మిథునం", "కర్కాటకం", "సింహం", "కన్య", "తుల", "వృశ్చికం", "ధనుస్సు", "మకరం", "కుంభం", "మీనం"],
  nakshatra: ["అశ్విని", "భరణి", "కృత్తిక", "రోహిణి", "మృగశిర", "ఆర్ద్ర", "పునర్వసు", "పుష్యమి", "ఆశ్లేష", "మఖ",
    "పుబ్బ", "ఉత్తర", "హస్త", "చిత్త", "స్వాతి", "విశాఖ", "అనూరాధ", "జ్యేష్ఠ", "మూల",
    "పూర్వాషాఢ", "ఉత్తరాషాఢ", "శ్రవణం", "ధనిష్ఠ", "శతభిషం", "పూర్వాభాద్ర", "ఉత్తరాభాద్ర", "రేవతి"],
  tithi: ["పాడ్యమి", "విదియ", "తదియ", "చవితి", "పంచమి", "షష్ఠి", "సప్తమి", "అష్టమి", "నవమి", "దశమి",
    "ఏకాదశి", "ద్వాదశి", "త్రయోదశి", "చతుర్దశి", "పౌర్ణమి", "అమావాస్య"],
  yoga: ["విష్కంభం", "ప్రీతి", "ఆయుష్మాన్", "సౌభాగ్యం", "శోభనం", "అతిగండం", "సుకర్మ", "ధృతి", "శూలం", "గండం",
    "వృద్ధి", "ధ్రువం", "వ్యాఘాతం", "హర్షణం", "వజ్రం", "సిద్ధి", "వ్యతీపాతం", "వరీయాన్", "పరిఘం", "శివం", "సిద్ధం",
    "సాధ్యం", "శుభం", "శుక్లం", "బ్రహ్మం", "ఐంద్రం", "వైధృతి"],
  karana: ["బవ", "బాలవ", "కౌలవ", "తైతిల", "గరజ", "వణిజ", "విష్టి", "శకుని", "చతుష్పాత్", "నాగవం", "కింస్తుఘ్నం"],
  vara: ["ఆదివారం", "సోమవారం", "మంగళవారం", "బుధవారం", "గురువారం", "శుక్రవారం", "శనివారం"],
  month: ["చైత్రం", "వైశాఖం", "జ్యేష్ఠం", "ఆషాఢం", "శ్రావణం", "భాద్రపదం", "ఆశ్వయుజం", "కార్తీకం", "మార్గశిరం", "పుష్యం", "మాఘం", "ఫాల్గుణం"],
  graha: ["సూర్యుడు", "చంద్రుడు", "కుజుడు", "బుధుడు", "గురువు", "శుక్రుడు", "శని", "రాహువు", "కేతువు", "లగ్నం"],
  paksha: ["శుక్ల", "కృష్ణ"],
  ritu: ["వసంత", "గ్రీష్మ", "వర్ష", "శరద్", "హేమంత", "శిశిర"],
  chog: ["అమృత", "శుభ", "లాభ", "చర", "రోగ", "కాల", "ఉద్వేగ"],
  samvatsara: ["ప్రభవ", "విభవ", "శుక్ల", "ప్రమోదూత", "ప్రజోత్పత్తి", "ఆంగీరస", "శ్రీముఖ", "భావ", "యువ", "ధాత",
    "ఈశ్వర", "బహుధాన్య", "ప్రమాది", "విక్రమ", "వృష", "చిత్రభాను", "స్వభాను", "తారణ", "పార్థివ", "వ్యయ",
    "సర్వజిత్", "సర్వధారి", "విరోధి", "వికృతి", "ఖర", "నందన", "విజయ", "జయ", "మన్మథ", "దుర్ముఖి",
    "హేవళంబి", "విళంబి", "వికారి", "శార్వరి", "ప్లవ", "శుభకృత్", "శోభకృత్", "క్రోధి", "విశ్వావసు", "పరాభవ",
    "ప్లవంగ", "కీలక", "సౌమ్య", "సాధారణ", "విరోధికృత్", "పరీధావి", "ప్రమాదీచ", "ఆనంద", "రాక్షస", "నల",
    "పింగళ", "కాళయుక్తి", "సిద్ధార్థి", "రౌద్రి", "దుర్మతి", "దుందుభి", "రుధిరోద్గారి", "రక్తాక్షి", "క్రోధన", "అక్షయ"],
};

const NAMES = { en: EN, te: TE, hi: DEV, sa: SA };

/* festival names by id (Sanskrit uses the Devanagari list) */
const FEST = {
  te: {
    ugadi: "ఉగాది", chaitra_navratri: "వసంత నవరాత్రులు ప్రారంభం", rama_navami: "శ్రీరామ నవమి", mahavir_jayanti: "మహావీర్ జయంతి",
    hanuman_jayanti_n: "హనుమాన్ జయంతి (ఉత్తర భారతం)", akshaya_tritiya: "అక్షయ తృతీయ", shankara_jayanti: "ఆదిశంకర జయంతి",
    narasimha_jayanti: "నృసింహ జయంతి", buddha_purnima: "బుద్ధ పూర్ణిమ", hanuman_jayanti_te: "హనుమాన్ జయంతి",
    ganga_dussehra: "గంగా దశహరా", vat_purnima: "వట పూర్ణిమ", rath_yatra: "జగన్నాథ రథయాత్ర", toli_ekadashi: "తొలి ఏకాదశి",
    guru_purnima: "గురు పూర్ణిమ", naga_panchami: "నాగ పంచమి", varalakshmi: "వరలక్ష్మీ వ్రతం", raksha_bandhan: "రాఖీ పూర్ణిమ",
    janmashtami: "శ్రీకృష్ణ జన్మాష్టమి", vinayaka_chaturthi: "వినాయక చవితి", rishi_panchami: "ఋషి పంచమి",
    anant_chaturdashi: "అనంత చతుర్దశి", pitru_paksha: "పితృ పక్షం ప్రారంభం", mahalaya: "మహాలయ అమావాస్య",
    bathukamma_start: "ఎంగిలి పూల బతుకమ్మ", sharad_navratri: "శరన్నవరాత్రులు ప్రారంభం", durgashtami: "దుర్గాష్టమి",
    saddula_bathukamma: "సద్దుల బతుకమ్మ", maha_navami: "మహా నవమి", vijayadashami: "విజయదశమి (దసరా)",
    sharad_purnima: "శరత్ పూర్ణిమ", atla_taddi: "అట్లతద్ది", karva_chauth: "కర్వా చౌత్", dhanteras: "ధన త్రయోదశి",
    naraka_chaturdashi: "నరక చతుర్దశి", deepavali: "దీపావళి", govardhan: "బలి పాడ్యమి", bhai_dooj: "యమ ద్వితీయ",
    nagula_chavithi: "నాగుల చవితి", chhath: "ఛఠ్ పూజ", prabodhini: "ఉత్థాన ఏకాదశి", ksheerabdi_dvadashi: "క్షీరాబ్ధి ద్వాదశి",
    kartika_purnima: "కార్తీక పౌర్ణమి", subrahmanya_shashti: "సుబ్రహ్మణ్య షష్ఠి", gita_jayanti: "గీతా జయంతి",
    datta_jayanti: "దత్త జయంతి", vasant_panchami: "శ్రీ పంచమి", ratha_saptami: "రథ సప్తమి", bhishma_ashtami: "భీష్మాష్టమి",
    maha_shivaratri: "మహా శివరాత్రి", holika_dahan: "కామదహనం", holi: "హోలీ", makara_m1: "భోగి", makara_1: "కనుమ",
    makara_2: "ముక్కనుమ", masik_shivaratri: "మాస శివరాత్రి", sankashti: "సంకష్టహర చతుర్థి", vaikuntha_ekadashi: "వైకుంఠ ఏకాదశి",
  },
  hi: {
    ugadi: "युगादि / गुड़ी पड़वा", chaitra_navratri: "चैत्र नवरात्रि प्रारम्भ", rama_navami: "श्री राम नवमी", mahavir_jayanti: "महावीर जयन्ती",
    hanuman_jayanti_n: "हनुमान जयन्ती", akshaya_tritiya: "अक्षय तृतीया", shankara_jayanti: "आदि शंकराचार्य जयन्ती",
    narasimha_jayanti: "नृसिंह जयन्ती", buddha_purnima: "बुद्ध पूर्णिमा", hanuman_jayanti_te: "हनुमान जयन्ती (तेलुगु)",
    ganga_dussehra: "गंगा दशहरा", vat_purnima: "वट पूर्णिमा", rath_yatra: "जगन्नाथ रथयात्रा", toli_ekadashi: "देवशयनी एकादशी",
    guru_purnima: "गुरु पूर्णिमा", naga_panchami: "नाग पंचमी", varalakshmi: "वरलक्ष्मी व्रत", raksha_bandhan: "रक्षा बन्धन",
    janmashtami: "श्री कृष्ण जन्माष्टमी", vinayaka_chaturthi: "गणेश चतुर्थी", rishi_panchami: "ऋषि पंचमी",
    anant_chaturdashi: "अनन्त चतुर्दशी", pitru_paksha: "पितृ पक्ष प्रारम्भ", mahalaya: "महालय अमावस्या",
    bathukamma_start: "बतुकम्मा प्रारम्भ", sharad_navratri: "शारदीय नवरात्रि प्रारम्भ", durgashtami: "दुर्गाष्टमी",
    saddula_bathukamma: "सद्दुला बतुकम्मा", maha_navami: "महा नवमी", vijayadashami: "विजयादशमी (दशहरा)",
    sharad_purnima: "शरद पूर्णिमा", atla_taddi: "अट्ल तद्दि", karva_chauth: "करवा चौथ", dhanteras: "धनतेरस",
    naraka_chaturdashi: "नरक चतुर्दशी", deepavali: "दीपावली", govardhan: "गोवर्धन पूजा", bhai_dooj: "भाई दूज",
    nagula_chavithi: "नागुल चविति", chhath: "छठ पूजा", prabodhini: "देवउठनी एकादशी", ksheerabdi_dvadashi: "क्षीराब्धि द्वादशी",
    kartika_purnima: "कार्तिक पूर्णिमा", subrahmanya_shashti: "स्कन्द षष्ठी", gita_jayanti: "गीता जयन्ती",
    datta_jayanti: "दत्तात्रेय जयन्ती", vasant_panchami: "वसन्त पंचमी", ratha_saptami: "रथ सप्तमी", bhishma_ashtami: "भीष्म अष्टमी",
    maha_shivaratri: "महाशिवरात्रि", holika_dahan: "होलिका दहन", holi: "होली", makara_m1: "भोगी", makara_1: "कनुमा",
    makara_2: "मुक्कनुमा", masik_shivaratri: "मासिक शिवरात्रि", sankashti: "संकष्टी चतुर्थी", vaikuntha_ekadashi: "वैकुण्ठ एकादशी",
  },
};
FEST.sa = FEST.hi;

/* words used to build generated festival names (Ekadashi, Pradosha, Sankranti...) */
const WORDS = {
  te: { Ekadashi: "ఏకాదశి", Pradosha: "ప్రదోషం", Sankranti: "సంక్రాంతి", Purnima: "పౌర్ణమి", Amavasya: "అమావాస్య",
    Ravi: "రవి", Soma: "సోమ", Bhauma: "భౌమ", Budha: "బుధ", Guru: "గురు", Shukra: "శుక్ర", Shani: "శని",
    Angaraki: "అంగారక", Sankashti: "సంకష్టహర", Chaturthi: "చతుర్థి", Adhika: "అధిక" },
  hi: { Ekadashi: "एकादशी", Pradosha: "प्रदोष", Sankranti: "संक्रान्ति", Purnima: "पूर्णिमा", Amavasya: "अमावस्या",
    Ravi: "रवि", Soma: "सोम", Bhauma: "भौम", Budha: "बुध", Guru: "गुरु", Shukra: "शुक्र", Shani: "शनि",
    Angaraki: "अंगारकी", Sankashti: "संकष्टी", Chaturthi: "चतुर्थी", Adhika: "अधिक" },
};
WORDS.sa = WORDS.hi;

/* UI labels */
const UI = {
  en: {},
  te: {
    tab_chart: "జాతకం", tab_panchanga: "పంచాంగం", tab_calendar: "మాస క్యాలెండర్", tab_festivals: "పండుగలు",
    tab_search: "సంఘటనల శోధన", tab_transits: "గోచారం", tab_match: "వివాహ పొంతన", tab_muhurta: "ముహూర్తం",
    tab_eclipses: "గ్రహణాలు", tab_profiles: "ప్రొఫైళ్లు", tab_method: "పద్ధతి",
    tab_dashboard: "డాష్‌బోర్డ్", tab_dashas: "దశలు", tab_vargas: "వర్గ చక్రాలు", tab_yogas: "యోగాలు & బలం",
    tab_reports: "నివేదికలు", tab_settings: "సెట్టింగ్‌లు", tab_saved: "సేవ్ చేసిన జాతకాలు",
    Date: "తేదీ", Time: "సమయం", Place: "ప్రదేశం", Coordinates: "అక్షాంశ, రేఖాంశాలు", "Time zone": "కాల మండలం",
    Calculate: "లెక్కించు", From: "నుండి", To: "వరకు", Categories: "వర్గాలు", Name: "పేరు", Save: "సేవ్",
    Tithi: "తిథి", Nakshatra: "నక్షత్రం", Yoga: "యోగం", Karana: "కరణం", Vara: "వారం", Month: "మాసం",
    Sunrise: "సూర్యోదయం", Sunset: "సూర్యాస్తమయం", Moonrise: "చంద్రోదయం", Moonset: "చంద్రాస్తమయం",
    Lagna: "లగ్నం", Rashi: "రాశి", Festivals: "పండుగలు", Activity: "కార్యం", Groom: "వరుడు", Bride: "వధువు",
    "Rahu kala": "రాహుకాలం", Yamaganda: "యమగండం", Gulika: "గుళిక", Durmuhurta: "దుర్ముహూర్తం", Varjyam: "వర్జ్యం",
    "Amrita kala": "అమృత ఘడియలు", Abhijit: "అభిజిత్", Samvatsara: "సంవత్సరం", Paksha: "పక్షం", Ritu: "ఋతువు",
    Language: "భాష", "Use my location": "నా ప్రదేశం", "Save profile": "ప్రొఫైల్ సేవ్", "Saved profiles": "సేవ్ చేసిన ప్రొఫైళ్లు",
    Planet: "గ్రహం", House: "భావం", Score: "స్కోరు", Total: "మొత్తం", Today: "ఈరోజు",
  },
  hi: {
    tab_chart: "जन्म कुण्डली", tab_panchanga: "पंचांग", tab_calendar: "मासिक पंचांग", tab_festivals: "त्योहार",
    tab_search: "घटना खोज", tab_transits: "गोचर", tab_match: "कुण्डली मिलान", tab_muhurta: "मुहूर्त",
    tab_eclipses: "ग्रहण", tab_profiles: "प्रोफ़ाइल", tab_method: "पद्धति",
    tab_dashboard: "डैशबोर्ड", tab_dashas: "दशाएँ", tab_vargas: "वर्ग कुण्डली", tab_yogas: "योग और बल",
    tab_reports: "रिपोर्ट", tab_settings: "सेटिंग्स", tab_saved: "सहेजी कुण्डलियाँ",
    Date: "तिथि (दिनांक)", Time: "समय", Place: "स्थान", Coordinates: "अक्षांश, देशान्तर", "Time zone": "समय क्षेत्र",
    Calculate: "गणना करें", From: "से", To: "तक", Categories: "श्रेणियाँ", Name: "नाम", Save: "सहेजें",
    Tithi: "तिथि", Nakshatra: "नक्षत्र", Yoga: "योग", Karana: "करण", Vara: "वार", Month: "मास",
    Sunrise: "सूर्योदय", Sunset: "सूर्यास्त", Moonrise: "चन्द्रोदय", Moonset: "चन्द्रास्त",
    Lagna: "लग्न", Rashi: "राशि", Festivals: "त्योहार", Activity: "कार्य", Groom: "वर", Bride: "वधू",
    "Rahu kala": "राहुकाल", Yamaganda: "यमगण्ड", Gulika: "गुलिक", Durmuhurta: "दुर्मुहूर्त", Varjyam: "वर्ज्य",
    "Amrita kala": "अमृत काल", Abhijit: "अभिजित्", Samvatsara: "संवत्सर", Paksha: "पक्ष", Ritu: "ऋतु",
    Language: "भाषा", "Use my location": "मेरा स्थान", "Save profile": "प्रोफ़ाइल सहेजें", "Saved profiles": "सहेजी प्रोफ़ाइल",
    Planet: "ग्रह", House: "भाव", Score: "अंक", Total: "कुल", Today: "आज",
  },
  sa: {
    tab_chart: "जन्मपत्रिका", tab_panchanga: "पञ्चाङ्गम्", tab_calendar: "मासपञ्चाङ्गम्", tab_festivals: "उत्सवाः",
    tab_search: "घटनान्वेषणम्", tab_transits: "गोचरः", tab_match: "मेलापकः", tab_muhurta: "मुहूर्तः",
    tab_eclipses: "ग्रहणानि", tab_profiles: "विवरणानि", tab_method: "पद्धतिः",
    tab_dashboard: "मुखपृष्ठम्", tab_dashas: "दशाः", tab_vargas: "वर्गचक्राणि", tab_yogas: "योगाः बलं च",
    tab_reports: "विवरणपत्राणि", tab_settings: "विन्यासाः", tab_saved: "रक्षितपत्रिकाः",
    Date: "दिनाङ्कः", Time: "समयः", Place: "स्थानम्", Coordinates: "अक्षांशः, रेखांशः", "Time zone": "कालमण्डलम्",
    Calculate: "गणयतु", From: "आरभ्य", To: "पर्यन्तम्", Categories: "वर्गाः", Name: "नाम", Save: "रक्षतु",
    Tithi: "तिथिः", Nakshatra: "नक्षत्रम्", Yoga: "योगः", Karana: "करणम्", Vara: "वासरः", Month: "मासः",
    Sunrise: "सूर्योदयः", Sunset: "सूर्यास्तः", Moonrise: "चन्द्रोदयः", Moonset: "चन्द्रास्तः",
    Lagna: "लग्नम्", Rashi: "राशिः", Festivals: "उत्सवाः", Activity: "कार्यम्", Groom: "वरः", Bride: "वधूः",
    "Rahu kala": "राहुकालः", Yamaganda: "यमगण्डः", Gulika: "गुलिकः", Durmuhurta: "दुर्मुहूर्तः", Varjyam: "वर्ज्यम्",
    "Amrita kala": "अमृतकालः", Abhijit: "अभिजित्", Samvatsara: "संवत्सरः", Paksha: "पक्षः", Ritu: "ऋतुः",
    Language: "भाषा", "Use my location": "मम स्थानम्", "Save profile": "विवरणं रक्षतु", "Saved profiles": "रक्षितानि विवरणानि",
    Planet: "ग्रहः", House: "भावः", Score: "अङ्काः", Total: "आहत्य", Today: "अद्य",
  },
};

let LANG = localStorage.getItem("astro.lang") || "en";
if (!LANGS[LANG]) LANG = "en";

const _index = {};
for (const cat of Object.keys(EN)) {
  _index[cat] = {};
  EN[cat].forEach((n, i) => { _index[cat][n] = i; });
}
/* nakshatra/month/yoga spellings that differ elsewhere in the engine */
_index.month.Ashvina = 6;
_index.graha.Asc = 9;

/** translate a canonical name of a category ("rashi", "nakshatra", ...) */
function tr(cat, name) {
  if (name == null || LANG === "en") return name ?? "";
  const i = _index[cat] && _index[cat][name];
  if (i === undefined) return name;
  return NAMES[LANG][cat][i] || name;
}
/** translate a "Shukla Navami" style tithi label */
function trTithi(paksha, name) {
  if (LANG === "en") return (paksha ? paksha + " " : "") + name;
  return (paksha ? tr("paksha", paksha) + " " : "") + tr("tithi", name);
}
/** translate a "Adhika Shravana" style month label */
function trMonth(label) {
  if (!label || LANG === "en") return label ?? "";
  const ad = label.startsWith("Adhika ");
  const m = ad ? label.slice(7) : label;
  return (ad ? WORDS[LANG].Adhika + " " : "") + tr("month", m);
}
/** translate a festival record */
function trFest(f) {
  if (LANG === "en") return f.name;
  const id = f.id === "makara_-1" ? "makara_m1" : f.id;
  if (FEST[LANG][id]) return FEST[LANG][id];
  let s = f.name;
  for (const [cat, list] of [["rashi", EN.rashi], ["month", EN.month]]) {
    for (const n of list) s = s.replace(new RegExp("\\b" + n + "\\b"), tr(cat, n));
  }
  for (const [w, v] of Object.entries(WORDS[LANG])) s = s.replace(new RegExp("\\b" + w + "\\b", "g"), v);
  return s;
}
/** UI label */
function t(key) {
  return (UI[LANG] && UI[LANG][key]) || key;
}
function applyI18n(root) {
  (root || document).querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    if (!el.dataset.en) el.dataset.en = el.textContent;
    el.textContent = LANG === "en" ? el.dataset.en : t(key) === key ? el.dataset.en : t(key);
  });
  document.documentElement.lang = LANG;
}
