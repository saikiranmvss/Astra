"""Yoga and dosha detection on the D1 chart.

Each rule reports existence with evidence (which planets, houses, signs).
Per the project manual, existence is separated from strength/activation:
no yoga is cancelled automatically; cancellation conditions are listed.
Houses are whole-sign from the lagna unless a rule says otherwise.
"""
from . import tables as T

KENDRA = {1, 4, 7, 10}
TRIKONA = {1, 5, 9}
DUSTHANA = {6, 8, 12}
BENEFICS = {"Jupiter", "Venus", "Mercury"}
MALEFICS = {"Sun", "Mars", "Saturn", "Rahu", "Ketu"}
SEVEN = T.SEVEN
SPECIAL_ASPECTS = {"Mars": (4, 7, 8), "Jupiter": (5, 7, 9), "Saturn": (3, 7, 10),
                   "Rahu": (5, 7, 9), "Ketu": (5, 7, 9)}


def house_from(ref_sign, sign):
    return (sign - ref_sign) % 12 + 1


def aspects(planet, from_sign, to_sign):
    h = house_from(from_sign, to_sign)
    return h in SPECIAL_ASPECTS.get(planet, (7,))


class Chart(object):
    def __init__(self, lons, lagna_lon, speeds=None):
        self.lon = dict(lons)
        self.sign = {p: int(v // 30.0) % 12 for p, v in lons.items()}
        self.lagna = int(lagna_lon // 30.0) % 12
        self.speeds = speeds or {}

    def house(self, p, ref=None):
        return house_from(self.lagna if ref is None else ref, self.sign[p])

    def lord(self, house, ref=None):
        return T.RASHI_LORD[((self.lagna if ref is None else ref) + house - 1) % 12]

    def in_house(self, h, ref=None, planets=SEVEN):
        return [p for p in planets if self.house(p, ref) == h]

    def dignity_sign(self, p):
        s = self.sign[p]
        if p in T.EXALTATION:
            if T.EXALTATION[p][0] == s:
                return "exalted"
            if (T.EXALTATION[p][0] + 6) % 12 == s:
                return "debilitated"
            if s in T.OWN_SIGNS[p]:
                return "own"
        return None

    def associated(self, a, b):
        """Conjunction, mutual aspect or sign exchange (Parashari)."""
        if a == b:
            return None
        sa, sb = self.sign[a], self.sign[b]
        if sa == sb:
            return "conjunction"
        if T.RASHI_LORD[sa] == b and T.RASHI_LORD[sb] == a:
            return "exchange"
        if aspects(a, sa, sb) and aspects(b, sb, sa):
            return "mutual aspect"
        return None


def _y(name, kind, present, evidence, note=None, cancel=None):
    d = {"name": name, "type": kind, "present": bool(present), "evidence": evidence}
    if note:
        d["note"] = note
    if cancel:
        d["cancellation_factors"] = cancel
    return d


def detect(lons, lagna_lon, speeds=None):
    c = Chart(lons, lagna_lon, speeds)
    out = []
    moon_s = c.sign["Moon"]
    sun_s = c.sign["Sun"]

    # Pancha Mahapurusha
    for p, nm in (("Mars", "Ruchaka"), ("Mercury", "Bhadra"), ("Jupiter", "Hamsa"),
                  ("Venus", "Malavya"), ("Saturn", "Shasha")):
        d = c.dignity_sign(p)
        h = c.house(p)
        if d in ("own", "exalted") and h in KENDRA:
            out.append(_y(nm + " (Pancha Mahapurusha)", "mahapurusha", True,
                          "%s %s in house %d (%s)" % (p, d, h, T.RASHIS[c.sign[p]])))
    # Gajakesari
    hj = house_from(moon_s, c.sign["Jupiter"])
    if hj in KENDRA:
        out.append(_y("Gajakesari", "lunar", True,
                      "Jupiter in house %d from the Moon" % hj,
                      cancel=["Jupiter debilitated"] if c.dignity_sign("Jupiter") == "debilitated" else None))
    # Budhaditya
    if c.sign["Mercury"] == sun_s:
        out.append(_y("Budhaditya", "solar", True, "Sun and Mercury in %s" % T.RASHIS[sun_s]))
    # Chandra-Mangala
    if c.sign["Mars"] == moon_s:
        out.append(_y("Chandra-Mangala", "lunar", True, "Moon and Mars in %s" % T.RASHIS[moon_s]))
    # lunar yogas: Sunapha / Anapha / Durudhara / Kemadruma
    tara = ["Mars", "Mercury", "Jupiter", "Venus", "Saturn"]
    second = [p for p in tara if house_from(moon_s, c.sign[p]) == 2]
    twelfth = [p for p in tara if house_from(moon_s, c.sign[p]) == 12]
    if second and twelfth:
        out.append(_y("Durudhara", "lunar", True,
                      "2nd from Moon: %s; 12th: %s" % (", ".join(second), ", ".join(twelfth))))
    elif second:
        out.append(_y("Sunapha", "lunar", True, "2nd from Moon: " + ", ".join(second)))
    elif twelfth:
        out.append(_y("Anapha", "lunar", True, "12th from Moon: " + ", ".join(twelfth)))
    else:
        kendra_any = [p for p in tara if c.house(p) in KENDRA]
        kendra_moon = [p for p in tara if house_from(moon_s, c.sign[p]) in KENDRA]
        cancel = []
        if kendra_any:
            cancel.append("planets in kendra from lagna: " + ", ".join(kendra_any))
        if kendra_moon:
            cancel.append("planets in kendra from Moon: " + ", ".join(kendra_moon))
        out.append(_y("Kemadruma", "dosha", True, "no planet (excl. Sun, nodes) in 2nd or 12th from Moon",
                      cancel=cancel or None))
    # solar yogas: Vesi / Vosi / Ubhayachari
    s2 = [p for p in tara if house_from(sun_s, c.sign[p]) == 2]
    s12 = [p for p in tara if house_from(sun_s, c.sign[p]) == 12]
    if s2 and s12:
        out.append(_y("Ubhayachari", "solar", True,
                      "2nd from Sun: %s; 12th: %s" % (", ".join(s2), ", ".join(s12))))
    elif s2:
        out.append(_y("Vesi", "solar", True, "2nd from Sun: " + ", ".join(s2)))
    elif s12:
        out.append(_y("Vosi", "solar", True, "12th from Sun: " + ", ".join(s12)))
    # Adhi yoga
    adhi = [p for p in BENEFICS if house_from(moon_s, c.sign[p]) in (6, 7, 8)]
    if len(adhi) >= 2:
        out.append(_y("Adhi", "lunar", True, "benefics in 6/7/8 from Moon: " + ", ".join(sorted(adhi))))
    # Amala
    am = [p for p in BENEFICS if c.house(p) == 10 or house_from(moon_s, c.sign[p]) == 10]
    if am:
        out.append(_y("Amala", "benefic", True, "benefic in 10th from lagna/Moon: " + ", ".join(sorted(am))))
    # Saraswati
    good = KENDRA | TRIKONA | {2}
    if all(c.house(p) in good for p in ("Jupiter", "Venus", "Mercury")):
        out.append(_y("Saraswati", "benefic", True, "Jupiter, Venus, Mercury in kendra/trikona/2nd",
                      note="classical rule also needs Jupiter strong (own/exalted/friend)"))
    # Lakshmi
    l9 = c.lord(9)
    if c.dignity_sign(l9) in ("own", "exalted") and c.house(l9) in (KENDRA | TRIKONA):
        out.append(_y("Lakshmi", "dhana", True, "9th lord %s %s in house %d" % (
            l9, c.dignity_sign(l9), c.house(l9))))
    # Shakata
    hm = house_from(c.sign["Jupiter"], moon_s)
    if hm in (6, 8, 12):
        out.append(_y("Shakata", "dosha", True, "Moon in house %d from Jupiter" % hm,
                      cancel=["Moon in kendra from lagna"] if c.house("Moon") in KENDRA else None))
    # Raja yogas: kendra lord + trikona lord association
    kl = {h: c.lord(h) for h in (1, 4, 7, 10)}
    tl = {h: c.lord(h) for h in (1, 5, 9)}
    seen = set()
    for hk, a in kl.items():
        for ht, b in tl.items():
            if a == b:
                if hk != 1 and ht != 1 and (a, "yk") not in seen:
                    seen.add((a, "yk"))
                    out.append(_y("Yogakaraka " + a, "raja", True,
                                  "%s rules kendra %d and trikona %d" % (a, hk, ht)))
                continue
            rel = c.associated(a, b)
            key = tuple(sorted((a, b)))
            if rel and key not in seen:
                seen.add(key)
                nm = "Dharma-Karmadhipati" if {hk, ht} == {10, 9} else "Raja"
                out.append(_y(nm + " yoga", "raja", True,
                              "lord %d (%s) and lord %d (%s): %s" % (hk, a, ht, b, rel)))
    # Dhana yogas: lords of 2, 5, 9, 11 (and 1) associated
    dl = {h: c.lord(h) for h in (1, 2, 5, 9, 11)}
    seen = set()
    for h1, a in dl.items():
        for h2, b in dl.items():
            if h1 >= h2 or a == b:
                continue
            rel = c.associated(a, b)
            key = tuple(sorted((a, b)))
            if rel and key not in seen and (2 in (h1, h2) or 11 in (h1, h2)):
                seen.add(key)
                out.append(_y("Dhana yoga", "dhana", True,
                              "lord %d (%s) and lord %d (%s): %s" % (h1, a, h2, b, rel)))
    # Viparita Raja
    for h, nm in ((6, "Harsha"), (8, "Sarala"), (12, "Vimala")):
        lord = c.lord(h)
        if c.house(lord) in DUSTHANA:
            out.append(_y(nm + " (Viparita Raja)", "raja", True,
                          "lord %d %s in house %d" % (h, lord, c.house(lord))))
    # Parivartana
    seen = set()
    for a in SEVEN:
        b = T.RASHI_LORD[c.sign[a]]
        if b != a and b in SEVEN and T.RASHI_LORD[c.sign[b]] == a:
            key = tuple(sorted((a, b)))
            if key in seen:
                continue
            seen.add(key)
            ha, hb = c.house(a), c.house(b)
            kind = "Dainya" if (ha in DUSTHANA or hb in DUSTHANA) else (
                "Khala" if 3 in (ha, hb) else "Maha")
            out.append(_y("%s Parivartana" % kind, "parivartana", True,
                          "%s in %s (house %d) <-> %s in %s (house %d)" % (
                              a, T.RASHIS[c.sign[a]], ha, b, T.RASHIS[c.sign[b]], hb)))
    # Neecha Bhanga
    for p in SEVEN:
        if c.dignity_sign(p) != "debilitated":
            continue
        s = c.sign[p]
        disp = T.RASHI_LORD[s]
        ex_lord = T.RASHI_LORD[(T.EXALTATION[p][0])]
        reasons = []
        for q, why in ((disp, "dispositor"), (ex_lord, "lord of exaltation sign")):
            if q in c.sign and (c.house(q) in KENDRA or house_from(moon_s, c.sign[q]) in KENDRA):
                reasons.append("%s %s in kendra" % (why, q))
        if reasons:
            out.append(_y("Neecha Bhanga Raja (%s)" % p, "raja", True, "; ".join(reasons)))
        else:
            out.append(_y("Debilitated %s" % p, "dosha", True, "%s in %s" % (p, T.RASHIS[s])))
    # Kala Sarpa
    r = lons["Rahu"]
    span = [((lons[p] - r) % 360.0) for p in SEVEN]
    if all(x < 180.0 for x in span) or all(x > 180.0 for x in span):
        out.append(_y("Kala Sarpa", "dosha", True,
                      "all seven planets on one side of the Rahu-Ketu axis",
                      note="not a classical BPHS yoga; modern usage"))
    # node conjunctions
    for a, b, nm in (("Sun", "Rahu", "Grahana (Sun-Rahu)"), ("Sun", "Ketu", "Grahana (Sun-Ketu)"),
                     ("Moon", "Rahu", "Grahana (Moon-Rahu)"), ("Moon", "Ketu", "Grahana (Moon-Ketu)"),
                     ("Jupiter", "Rahu", "Guru Chandala"), ("Mars", "Rahu", "Angaraka"),
                     ("Saturn", "Rahu", "Shrapit")):
        if c.sign[a] == c.sign[b]:
            out.append(_y(nm, "dosha", True, "%s and %s in %s" % (a, b, T.RASHIS[c.sign[a]]),
                          note="modern usage"))
    # Kuja (Manglik) dosha
    out.append(kuja_dosha(c))
    # Papakartari on lagna / Moon
    for ref, label in ((c.lagna, "lagna"), (moon_s, "Moon")):
        m2 = [p for p in MALEFICS if house_from(ref, c.sign[p]) == 2]
        m12 = [p for p in MALEFICS if house_from(ref, c.sign[p]) == 12]
        if m2 and m12:
            out.append(_y("Papakartari on " + label, "dosha", True,
                          "malefics in 2nd (%s) and 12th (%s)" % (", ".join(m2), ", ".join(m12))))
    return out


def kuja_dosha(c):
    """Mars in 1, 2, 4, 7, 8 or 12 from lagna, Moon or Venus."""
    houses = {1, 2, 4, 7, 8, 12}
    found = []
    for ref_name, ref in (("lagna", c.lagna), ("Moon", c.sign["Moon"]), ("Venus", c.sign["Venus"])):
        h = house_from(ref, c.sign["Mars"])
        if h in houses:
            found.append("house %d from %s" % (h, ref_name))
    cancel = []
    d = c.dignity_sign("Mars")
    if d in ("own", "exalted"):
        cancel.append("Mars in own/exaltation sign")
    if c.sign["Mars"] in (4, 10) and c.house("Mars") in (1, 7):
        cancel.append("Mars in Simha/Kumbha in 1st or 7th")
    if c.sign["Mars"] == c.sign["Jupiter"] or aspects("Jupiter", c.sign["Jupiter"], c.sign["Mars"]):
        cancel.append("Jupiter conjoins or aspects Mars")
    level = "from lagna" if any("lagna" in f for f in found) else ("other references only" if found else "")
    return _y("Kuja (Manglik) dosha", "dosha", bool(found),
              "; ".join(found) if found else "Mars not in 1/2/4/7/8/12 from lagna, Moon or Venus",
              note=level or None, cancel=cancel or None)
