"""Namakshara: the starting syllable of a name, from the Moon's nakshatra pada.

The sidereal Moon longitude gives nakshatra = floor(lon / 13deg20') and
pada = floor((lon mod 13deg20') / 3deg20'); each of the 108 padas carries one
syllable (Avakahada chakra). Rashi letters are the 9 padas inside the Moon's sign.
"""
from . import tables as T
from .constants import NAKSHATRA_SPAN, PADA_SPAN

# (latin, devanagari, telugu) for padas 1-4 of each nakshatra
SYLLABLES = [
    [("Chu", "चु", "చు"), ("Che", "चे", "చే"), ("Cho", "चो", "చో"), ("La", "ला", "లా")],      # Ashwini
    [("Li", "ली", "లీ"), ("Lu", "लू", "లూ"), ("Le", "ले", "లే"), ("Lo", "लो", "లో")],         # Bharani
    [("A", "अ", "అ"), ("I", "ई", "ఈ"), ("U", "ऊ", "ఊ"), ("E", "ए", "ఏ")],                     # Krittika
    [("O", "ओ", "ఓ"), ("Va", "वा", "వా"), ("Vi", "वी", "వీ"), ("Vu", "वू", "వూ")],            # Rohini
    [("Ve", "वे", "వే"), ("Vo", "वो", "వో"), ("Ka", "का", "కా"), ("Ki", "की", "కీ")],         # Mrigashira
    [("Ku", "कू", "కూ"), ("Gha", "घ", "ఘ"), ("Nga", "ङ", "ఙ"), ("Chha", "छ", "ఛ")],          # Ardra
    [("Ke", "के", "కే"), ("Ko", "को", "కో"), ("Ha", "हा", "హా"), ("Hi", "ही", "హీ")],         # Punarvasu
    [("Hu", "हू", "హూ"), ("He", "हे", "హే"), ("Ho", "हो", "హో"), ("Da", "डा", "డా")],         # Pushya
    [("Di", "डी", "డీ"), ("Du", "डू", "డూ"), ("De", "डे", "డే"), ("Do", "डो", "డో")],         # Ashlesha
    [("Ma", "मा", "మా"), ("Mi", "मी", "మీ"), ("Mu", "मू", "మూ"), ("Me", "मे", "మే")],         # Magha
    [("Mo", "मो", "మో"), ("Ta", "टा", "టా"), ("Ti", "टी", "టీ"), ("Tu", "टू", "టూ")],         # Purva Phalguni
    [("Te", "टे", "టే"), ("To", "टो", "టో"), ("Pa", "पा", "పా"), ("Pi", "पी", "పీ")],         # Uttara Phalguni
    [("Pu", "पू", "పూ"), ("Sha", "ष", "ష"), ("Na", "ण", "ణ"), ("Tha", "ठ", "ఠ")],             # Hasta
    [("Pe", "पे", "పే"), ("Po", "पो", "పో"), ("Ra", "रा", "రా"), ("Ri", "री", "రీ")],         # Chitra
    [("Ru", "रू", "రూ"), ("Re", "रे", "రే"), ("Ro", "रो", "రో"), ("Ta", "ता", "తా")],        # Swati
    [("Ti", "ती", "తీ"), ("Tu", "तू", "తూ"), ("Te", "ते", "తే"), ("To", "तो", "తో")],     # Vishakha
    [("Na", "ना", "నా"), ("Ni", "नी", "నీ"), ("Nu", "नू", "నూ"), ("Ne", "ने", "నే")],        # Anuradha
    [("No", "नो", "నో"), ("Ya", "या", "యా"), ("Yi", "यी", "యీ"), ("Yu", "यू", "యూ")],         # Jyeshtha
    [("Ye", "ये", "యే"), ("Yo", "यो", "యో"), ("Bha", "भा", "భా"), ("Bhi", "भी", "భీ")],       # Mula
    [("Bhu", "भू", "భూ"), ("Dha", "धा", "ధా"), ("Pha", "फा", "ఫా"), ("Dha", "ढा", "ఢా")],    # Purva Ashadha
    [("Bhe", "भे", "భే"), ("Bho", "भो", "భో"), ("Ja", "जा", "జా"), ("Ji", "जी", "జీ")],       # Uttara Ashadha
    [("Ju", "जू", "జూ"), ("Je", "जे", "జే"), ("Jo", "जो", "జో"), ("Kha", "खा", "ఖా")],        # Shravana
    [("Ga", "गा", "గా"), ("Gi", "गी", "గీ"), ("Gu", "गू", "గూ"), ("Ge", "गे", "గే")],         # Dhanishtha
    [("Go", "गो", "గో"), ("Sa", "सा", "సా"), ("Si", "सी", "సీ"), ("Su", "सू", "సూ")],         # Shatabhisha
    [("Se", "से", "సే"), ("So", "सो", "సో"), ("Da", "दा", "దా"), ("Di", "दी", "దీ")],       # Purva Bhadrapada
    [("Du", "दू", "దూ"), ("Tha", "थ", "థ"), ("Jha", "झ", "ఝ"), ("Na", "ञ", "ఞ")],         # Uttara Bhadrapada
    [("De", "दे", "దే"), ("Do", "दो", "దో"), ("Cha", "चा", "చా"), ("Chi", "ची", "చీ")],     # Revati
]

# padas whose syllable differs between regional tables: (nakshatra 0-based, pada 0-based)
ALTERNATES = {
    (21, 0): [("Khi", "खी", "ఖీ", "North Indian tables (Abhijit counted separately)")],
    (21, 1): [("Khu", "खू", "ఖూ", "North Indian tables (Abhijit counted separately)")],
    (21, 2): [("Khe", "खे", "ఖే", "North Indian tables (Abhijit counted separately)")],
    (21, 3): [("Kho", "खो", "ఖో", "North Indian tables (Abhijit counted separately)")],
    (5, 2): [("Na", "न", "న", "used where the nasal Nga is not written")],
    (25, 3): [("Gya", "ज्ञ", "జ్ఞ", "common reading of the nasal Nya")],
}

RULE = ("Moon's sidereal nakshatra pada at the birth moment; each of the 27 x 4 = 108 padas "
        "carries one syllable (Avakahada chakra)")


def _entry(n, p):
    lat, deva, tel = SYLLABLES[n][p]
    e = {"latin": lat, "devanagari": deva, "telugu": tel}
    alt = ALTERNATES.get((n, p))
    if alt:
        e["alternates"] = [{"latin": a, "devanagari": d, "telugu": t, "note": note} for a, d, t, note in alt]
    return e


def of_index(gp):
    """Syllable record for global pada index 0..107."""
    gp %= 108
    n, p = divmod(gp, 4)
    e = _entry(n, p)
    e.update({"nakshatra": T.NAKSHATRAS[n], "nakshatra_index": n + 1, "pada": p + 1,
              "rashi": T.RASHIS[gp // 9], "rashi_index": gp // 9 + 1})
    return e


def lookup(lon):
    """Syllable for a sidereal Moon longitude, with the nakshatra and rashi syllable sets."""
    lon %= 360.0
    n = int(lon // NAKSHATRA_SPAN)
    p = min(3, int((lon - n * NAKSHATRA_SPAN) // PADA_SPAN))
    gp = n * 4 + p
    out = of_index(gp)
    sign = gp // 9
    out["moon_longitude"] = lon
    out["degrees_into_pada"] = lon - gp * PADA_SPAN
    out["nakshatra_syllables"] = [_entry(n, k) for k in range(4)]
    out["rashi_syllables"] = [dict(_entry(*divmod(k, 4)), nakshatra=T.NAKSHATRAS[k // 4], pada=k % 4 + 1)
                              for k in range(sign * 9, sign * 9 + 9)]
    return out


def for_birth(moon_lon, jd, pada_start, pada_end, fmt, near_minutes=30.0):
    """Birth syllable plus the pada's time span and a note when birth is close to a pada edge."""
    out = lookup(moon_lon)
    gp = (out["nakshatra_index"] - 1) * 4 + out["pada"] - 1
    out["pada_start"] = fmt(pada_start) if pada_start is not None else None
    out["pada_end"] = fmt(pada_end) if pada_end is not None else None
    after = (jd - pada_start) * 1440.0 if pada_start is not None else None
    before = (pada_end - jd) * 1440.0 if pada_end is not None else None
    out["minutes_after_start"] = round(after, 1) if after is not None else None
    out["minutes_before_end"] = round(before, 1) if before is not None else None
    neighbour = None
    if after is not None and after < near_minutes:
        neighbour = dict(of_index(gp - 1), side="previous", minutes=round(after, 1))
    elif before is not None and before < near_minutes:
        neighbour = dict(of_index(gp + 1), side="next", minutes=round(before, 1))
    out["near_boundary"] = neighbour is not None
    out["neighbour"] = neighbour
    out["rule"] = RULE
    return out


def day_list(intervals, fmt):
    """Syllable windows for pada intervals [(global_pada, start_jd, end_jd), ...]."""
    out = []
    for gp, a, b in intervals:
        e = of_index(gp)
        e["start"] = fmt(a) if a is not None else None
        e["end"] = fmt(b) if b is not None else None
        out.append(e)
    return out
