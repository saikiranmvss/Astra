"""Traditional reference tables (names, lords, dignities)."""

RASHIS = [
    "Mesha", "Vrishabha", "Mithuna", "Karka", "Simha", "Kanya",
    "Tula", "Vrishchika", "Dhanu", "Makara", "Kumbha", "Meena",
]
RASHI_LORD = [
    "Mars", "Venus", "Mercury", "Moon", "Sun", "Mercury",
    "Venus", "Mars", "Jupiter", "Saturn", "Saturn", "Jupiter",
]
NAKSHATRAS = [
    "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
    "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni",
    "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha",
    "Jyeshtha", "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana",
    "Dhanishtha", "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada",
    "Revati",
]
DASHA_ORDER = [
    ("Ketu", 7), ("Venus", 20), ("Sun", 6), ("Moon", 10), ("Mars", 7),
    ("Rahu", 18), ("Jupiter", 16), ("Saturn", 19), ("Mercury", 17),
]
TITHIS = [
    "Pratipada", "Dvitiya", "Tritiya", "Chaturthi", "Panchami", "Shashthi",
    "Saptami", "Ashtami", "Navami", "Dashami", "Ekadashi", "Dvadashi",
    "Trayodashi", "Chaturdashi",
]
YOGAS = [
    "Vishkambha", "Priti", "Ayushman", "Saubhagya", "Shobhana", "Atiganda",
    "Sukarma", "Dhriti", "Shula", "Ganda", "Vriddhi", "Dhruva", "Vyaghata",
    "Harshana", "Vajra", "Siddhi", "Vyatipata", "Variyan", "Parigha",
    "Shiva", "Siddha", "Sadhya", "Shubha", "Shukla", "Brahma", "Indra",
    "Vaidhriti",
]
KARANA_MOVABLE = ["Bava", "Balava", "Kaulava", "Taitila", "Gara", "Vanija", "Vishti"]
VARAS = ["Ravivara", "Somavara", "Mangalavara", "Budhavara", "Guruvara",
         "Shukravara", "Shanivara"]
VARA_LORD = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"]
# Amanta month named by the Sun's sidereal sign at the starting New Moon
LUNAR_MONTH_BY_SUN_SIGN = [
    "Vaishakha", "Jyeshtha", "Ashadha", "Shravana", "Bhadrapada",
    "Ashvayuja", "Kartika", "Margashira", "Pushya", "Magha", "Phalguna",
    "Chaitra",
]
RITU_BY_MONTH = {
    "Chaitra": "Vasanta", "Vaishakha": "Vasanta", "Jyeshtha": "Grishma",
    "Ashadha": "Grishma", "Shravana": "Varsha", "Bhadrapada": "Varsha",
    "Ashvayuja": "Sharad", "Kartika": "Sharad", "Margashira": "Hemanta",
    "Pushya": "Hemanta", "Magha": "Shishira", "Phalguna": "Shishira",
}
SAMVATSARAS = [
    "Prabhava", "Vibhava", "Shukla", "Pramoduta", "Prajotpatti", "Angirasa",
    "Shrimukha", "Bhava", "Yuva", "Dhatu", "Ishvara", "Bahudhanya",
    "Pramathi", "Vikrama", "Vrisha", "Chitrabhanu", "Svabhanu", "Tarana",
    "Parthiva", "Vyaya", "Sarvajit", "Sarvadhari", "Virodhi", "Vikriti",
    "Khara", "Nandana", "Vijaya", "Jaya", "Manmatha", "Durmukhi",
    "Hevilambi", "Vilambi", "Vikari", "Sharvari", "Plava", "Shubhakrit",
    "Shobhakrit", "Krodhi", "Vishvavasu", "Parabhava", "Plavanga", "Kilaka",
    "Saumya", "Sadharana", "Virodhikrit", "Paridhavi", "Pramadicha",
    "Ananda", "Rakshasa", "Nala", "Pingala", "Kalayukti", "Siddharthi",
    "Raudri", "Durmati", "Dundubhi", "Rudhirodgari", "Raktakshi",
    "Krodhana", "Akshaya",
]

GRAHAS = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn",
          "Rahu", "Ketu"]
SEVEN = GRAHAS[:7]

EXALTATION = {"Sun": (0, 10), "Moon": (1, 3), "Mars": (9, 28), "Mercury": (5, 15),
              "Jupiter": (3, 5), "Venus": (11, 27), "Saturn": (6, 20)}
OWN_SIGNS = {"Sun": (4,), "Moon": (3,), "Mars": (0, 7), "Mercury": (2, 5),
             "Jupiter": (8, 11), "Venus": (1, 6), "Saturn": (9, 10)}
# BPHS moolatrikona: sign, start deg, end deg
MOOLATRIKONA = {"Sun": (4, 0, 20), "Moon": (1, 3, 30), "Mars": (0, 0, 12),
                "Mercury": (5, 15, 20), "Jupiter": (8, 0, 10), "Venus": (6, 0, 15),
                "Saturn": (10, 0, 20)}
NATURAL_FRIENDS = {
    "Sun": ({"Moon", "Mars", "Jupiter"}, {"Mercury"}, {"Venus", "Saturn"}),
    "Moon": ({"Sun", "Mercury"}, {"Mars", "Jupiter", "Venus", "Saturn"}, set()),
    "Mars": ({"Sun", "Moon", "Jupiter"}, {"Venus", "Saturn"}, {"Mercury"}),
    "Mercury": ({"Sun", "Venus"}, {"Mars", "Jupiter", "Saturn"}, {"Moon"}),
    "Jupiter": ({"Sun", "Moon", "Mars"}, {"Saturn"}, {"Mercury", "Venus"}),
    "Venus": ({"Mercury", "Saturn"}, {"Mars", "Jupiter"}, {"Sun", "Moon"}),
    "Saturn": ({"Mercury", "Venus"}, {"Jupiter"}, {"Sun", "Moon", "Mars"}),
}
# combustion orbs in degrees (direct, retrograde)
COMBUSTION = {"Moon": (12, 12), "Mars": (17, 17), "Mercury": (14, 12),
              "Jupiter": (11, 11), "Venus": (10, 8), "Saturn": (15, 15)}
NATURAL_STRENGTH = {"Sun": 60.0, "Moon": 360.0 / 7, "Venus": 300.0 / 7,
                    "Jupiter": 240.0 / 7, "Mercury": 180.0 / 7, "Mars": 120.0 / 7,
                    "Saturn": 60.0 / 7}


def nakshatra_lord(index0):
    return DASHA_ORDER[index0 % 9][0]
