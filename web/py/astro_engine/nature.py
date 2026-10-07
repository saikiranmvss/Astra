"""Nakshatra nature (janma nakshatra gunam): gana, gati, yoni, deity, nadi, varna.

Everything here is TRADITIONAL (Muhurta Chintamani gati classes, the Ashtakoota
gana / yoni / nadi / varna tables used by matching) applied to the CALCULATED
birth Moon. The trait lines are short summaries of the classical descriptions.
"""
from . import tables as T
from .matching import (GANA_OF_NAK, GANA_NAMES, YONI_OF_NAK, YONI_NAMES, NADI_OF_NAK,
                       NADI_NAMES, VARNA_OF_SIGN, VARNA_NAMES, VASHYA_NAMES, vashya_group)

NAK_SPAN = 360.0 / 27

GANA_TEXT = {
    "Deva": ("Divine", "Gentle, kind, generous and forgiving; devotional, prefers harmony and simple living."),
    "Manushya": ("Human", "Balanced and practical; ambitious, social and emotional; values family, comfort and status."),
    "Rakshasa": ("Fierce", "Strong-willed, independent, bold and outspoken; hard-working and protective, quick to anger. "
                 "It means intensity and self-will, not 'evil'."),
}
DEITY = ["Ashvini Kumaras", "Yama", "Agni", "Brahma (Prajapati)", "Soma", "Rudra", "Aditi", "Brihaspati",
         "Sarpas (Nagas)", "Pitris", "Bhaga", "Aryaman", "Savitr (Surya)", "Tvashtr (Vishvakarma)", "Vayu",
         "Indra-Agni", "Mitra", "Indra", "Nirriti", "Apas", "Vishvedevas", "Vishnu", "Vasus", "Varuna",
         "Aja Ekapada", "Ahir Budhnya", "Pushan"]
SYMBOL = ["Horse's head", "Yoni", "Razor / flame", "Chariot", "Deer's head", "Teardrop", "Bow and quiver",
          "Cow's udder", "Coiled serpent", "Throne", "Front legs of a cot", "Back legs of a cot", "Hand",
          "Bright jewel", "Young shoot", "Triumphal arch", "Lotus", "Earring / umbrella", "Tied roots",
          "Winnowing fan", "Elephant tusk", "Ear / three footprints", "Drum", "Empty circle",
          "Swords / front of a funeral cot", "Twins / back of a funeral cot", "Fish"]
GATI_OF_NAK = ["Kshipra", "Ugra", "Mishra", "Dhruva", "Mridu", "Tikshna", "Chara", "Kshipra", "Tikshna",
               "Ugra", "Ugra", "Dhruva", "Kshipra", "Mridu", "Chara", "Mishra", "Mridu", "Tikshna", "Tikshna",
               "Ugra", "Dhruva", "Chara", "Chara", "Chara", "Ugra", "Dhruva", "Mridu"]
GATI_TEXT = {
    "Dhruva": ("Fixed", "Steady, patient and dependable; resists sudden change."),
    "Chara": ("Movable", "Restless and adaptable; likes travel, change and new things."),
    "Ugra": ("Fierce", "Intense and courageous; can be harsh when crossed."),
    "Mishra": ("Mixed", "Both sharp and soft; versatile and fiery."),
    "Kshipra": ("Swift", "Quick, light and skilful; active and helpful."),
    "Mridu": ("Soft", "Gentle, artistic and affectionate."),
    "Tikshna": ("Sharp", "Penetrating and intense; investigative, can be severe."),
}
YONI_MALE = [1, 1, 0, 1, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0]
TRAITS = [
    "Quick, energetic and helpful; fond of healing and adventure; can be impatient.",
    "Determined and truthful; carries responsibility; strong desires, can be stubborn.",
    "Sharp-minded, brave, frank and ambitious; protective, can be short-tempered.",
    "Attractive, artistic, sweet-spoken and steady; loves comfort, can be possessive.",
    "Curious and gentle with a searching mind; fond of travel and learning; can be restless.",
    "Intelligent, intense and inquisitive; good at research; prone to mood swings.",
    "Kind, contented, generous and religious; bounces back from setbacks.",
    "Nurturing, disciplined, dutiful and wise; can be rigid.",
    "Shrewd, perceptive and persuasive with strong intuition; can be secretive or suspicious.",
    "Dignified and proud of tradition; generous, a natural leader; can be arrogant.",
    "Pleasant, charming and creative; enjoys life and comforts; can be lazy.",
    "Helpful, reliable and friendly; good at partnerships; seeks status.",
    "Skilful with the hands, clever and humorous; hard-working, can be restless.",
    "Creative and stylish; loves beauty and design; can be self-centred.",
    "Independent, polite and balanced; good in business; can be indecisive.",
    "Goal-oriented, determined and ambitious; can be jealous or impatient.",
    "Loyal, friendly and devoted; good at organising and teamwork.",
    "Responsible, protective and resourceful; can be proud or secretive.",
    "Probing and philosophical; gets to the root of things; can be blunt.",
    "Confident, persuasive and idealistic; can be stubborn.",
    "Righteous, patient and persistent; wins lasting success; can be rigid.",
    "A good listener, learned and organised; respects tradition.",
    "Musical, generous and adaptable; can be over-ambitious.",
    "Independent with a scientific, healing mind; can be reclusive.",
    "Intense, passionate and idealistic; spiritual, can go to extremes.",
    "Wise, calm, self-controlled and charitable; a deep thinker.",
    "Gentle, caring and imaginative; protective of others, can be over-sensitive.",
]


def of_nakshatra(nak, sign=None, deg=None):
    """Nature of nakshatra index `nak` (0-26); sign (0-11) and degree add varna / vashya."""
    gana = GANA_NAMES[GANA_OF_NAK[nak]]
    gati = GATI_OF_NAK[nak]
    out = {
        "nakshatra": T.NAKSHATRAS[nak],
        "gana": {"name": gana, "meaning": GANA_TEXT[gana][0], "text": GANA_TEXT[gana][1]},
        "gati": {"name": gati, "meaning": GATI_TEXT[gati][0], "text": GATI_TEXT[gati][1]},
        "yoni": {"animal": YONI_NAMES[YONI_OF_NAK[nak]], "gender": "male" if YONI_MALE[nak] else "female"},
        "deity": DEITY[nak],
        "symbol": SYMBOL[nak],
        "nadi": NADI_NAMES[NADI_OF_NAK[nak]],
        "lord": T.DASHA_ORDER[nak % 9][0],
        "traits": TRAITS[nak],
    }
    if sign is not None:
        out["varna"] = VARNA_NAMES[VARNA_OF_SIGN[sign]]
        out["vashya"] = VASHYA_NAMES[vashya_group(sign, deg or 0.0)]
        out["rashi"] = T.RASHIS[sign]
    return out


def for_moon(moon_lon):
    lon = moon_lon % 360.0
    out = of_nakshatra(int(lon // NAK_SPAN) % 27, int(lon // 30) % 12, lon % 30)
    out["status"] = "TRADITIONAL descriptions on the CALCULATED Moon nakshatra"
    out["note"] = ("General traits of the birth star from the classical texts. The full chart "
                   "(lagna, planets, dashas) modifies them; read as tendencies, not a verdict.")
    return out
