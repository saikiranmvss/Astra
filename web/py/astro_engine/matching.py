"""Marriage matching: Ashtakoota (36 gunas) and South Indian Dasha Porutham.

Inputs are the two charts' Moon nakshatras/rashis (from calculated charts).
All tables are TRADITIONAL; where regional variants exist the variant used
is named in the output.
"""
from . import tables as T
from .yogas import Chart, kuja_dosha

VARNA_OF_SIGN = [1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0]  # 0 Brahmin .. 3 Shudra (Karka=0)
VARNA_NAMES = ["Brahmin", "Kshatriya", "Vaishya", "Shudra"]
VARNA_RANK = {0: 3, 1: 2, 2: 1, 3: 0}
VASHYA_NAMES = ["Chatushpada", "Manava", "Jalachara", "Vanachara", "Keeta"]
VASHYA_TABLE = [
    [2, 1, 1, 0.5, 1],
    [1, 2, 0.5, 0, 1],
    [1, 0.5, 2, 1, 1],
    [0.5, 0, 1, 2, 0],
    [1, 1, 1, 0, 2],
]
YONI_OF_NAK = [0, 1, 2, 3, 3, 4, 5, 2, 5, 6, 6, 7, 8, 9, 8, 9, 10, 10, 4, 11, 12, 11, 13, 0,
               13, 7, 1]
YONI_NAMES = ["Horse", "Elephant", "Sheep", "Serpent", "Dog", "Cat", "Rat", "Cow", "Buffalo",
              "Tiger", "Deer", "Monkey", "Mongoose", "Lion"]
YONI_TABLE = [
    [4, 2, 2, 3, 2, 2, 2, 1, 0, 1, 3, 3, 2, 1],
    [2, 4, 3, 3, 2, 2, 2, 2, 3, 1, 2, 3, 2, 0],
    [2, 3, 4, 2, 1, 2, 1, 3, 3, 1, 2, 0, 3, 1],
    [3, 3, 2, 4, 2, 1, 1, 1, 1, 2, 2, 2, 0, 2],
    [2, 2, 1, 2, 4, 2, 1, 2, 2, 1, 0, 2, 1, 1],
    [2, 2, 2, 1, 2, 4, 0, 2, 2, 1, 3, 3, 2, 1],
    [2, 2, 1, 1, 1, 0, 4, 2, 2, 2, 2, 2, 1, 2],
    [1, 2, 3, 1, 2, 2, 2, 4, 3, 0, 3, 2, 2, 1],
    [0, 3, 3, 1, 2, 2, 2, 3, 4, 1, 2, 2, 2, 1],
    [1, 1, 1, 2, 1, 1, 2, 0, 1, 4, 1, 1, 2, 1],
    [3, 2, 2, 2, 0, 3, 2, 3, 2, 1, 4, 2, 2, 1],
    [3, 3, 0, 2, 2, 3, 2, 2, 2, 1, 2, 4, 3, 2],
    [2, 2, 3, 0, 1, 2, 1, 2, 2, 2, 2, 3, 4, 2],
    [1, 0, 1, 2, 1, 1, 2, 1, 1, 1, 1, 2, 2, 4],
]
GANA_OF_NAK = [0, 1, 2, 1, 0, 1, 0, 0, 2, 2, 1, 1, 0, 2, 0, 2, 0, 2, 2, 1, 1, 0, 2, 2, 1, 1, 0]
GANA_NAMES = ["Deva", "Manushya", "Rakshasa"]
GANA_TABLE = [[6, 6, 1], [5, 6, 0], [1, 0, 6]]  # [groom][bride]
NADI_OF_NAK = [0, 1, 2, 2, 1, 0, 0, 1, 2, 2, 1, 0, 0, 1, 2, 2, 1, 0, 0, 1, 2, 2, 1, 0, 0, 1, 2]
NADI_NAMES = ["Adi (Vata)", "Madhya (Pitta)", "Antya (Kapha)"]
RAJJU_OF_NAK = [0, 1, 2, 3, 4, 3, 2, 1, 0, 0, 1, 2, 3, 4, 3, 2, 1, 0, 0, 1, 2, 3, 4, 3, 2, 1, 0]
RAJJU_NAMES = ["Pada (feet)", "Kati (waist)", "Nabhi (navel)", "Kantha (neck)", "Shiro (head)"]
VEDHA_PAIRS = [(0, 17), (1, 16), (2, 15), (3, 14), (5, 21), (6, 20), (7, 19), (8, 18), (9, 26),
               (10, 25), (11, 24), (12, 23), (4, 13), (13, 22), (4, 22)]
VASYA_RASI = {0: [4, 7], 1: [3, 6], 2: [5], 3: [7, 8], 4: [6], 5: [2, 11], 6: [5, 9], 7: [3],
              8: [11], 9: [0, 10], 10: [0], 11: [9]}


def vashya_group(sign, deg):
    if sign in (0, 1):
        return 0
    if sign == 8:
        return 0 if deg >= 15 else 1
    if sign == 9:
        return 0 if deg < 15 else 2
    if sign in (2, 5, 6, 10):
        return 1
    if sign in (3, 11):
        return 2
    if sign == 4:
        return 3
    return 4  # Vrishchika


def friendship(a, b):
    if a == b:
        return "same"
    f, n, e = T.NATURAL_FRIENDS[a]
    return "friend" if b in f else ("enemy" if b in e else "neutral")


def graha_maitri(l1, l2):
    r1, r2 = friendship(l1, l2), friendship(l2, l1)
    if r1 == "same":
        return 5.0
    s = {r1, r2}
    if s == {"friend"}:
        return 5.0
    if s == {"friend", "neutral"}:
        return 4.0
    if s == {"neutral"}:
        return 3.0
    if s == {"friend", "enemy"}:
        return 1.0
    if s == {"neutral", "enemy"}:
        return 0.5
    return 0.0


def _person(c):
    moon = c["chart"]["grahas"]["Moon"]
    nak = moon["nakshatra"]["index"] - 1
    sign = moon["rashi"]["index"] - 1
    return {"nak": nak, "sign": sign, "deg": moon["rashi"]["degrees_in_sign"],
            "pada": moon["nakshatra"]["pada"]}


def ashtakoota(g, b):
    """g = groom, b = bride (dicts from _person)."""
    out = []
    vg, vb = VARNA_OF_SIGN[g["sign"]], VARNA_OF_SIGN[b["sign"]]
    out.append(("Varna", 1, 1.0 if VARNA_RANK[vg] >= VARNA_RANK[vb] else 0.0,
                "%s / %s" % (VARNA_NAMES[vg], VARNA_NAMES[vb])))
    wg, wb = vashya_group(g["sign"], g["deg"]), vashya_group(b["sign"], b["deg"])
    out.append(("Vashya", 2, float(VASHYA_TABLE[wg][wb]),
                "%s / %s" % (VASHYA_NAMES[wg], VASHYA_NAMES[wb])))
    c1 = (g["nak"] - b["nak"]) % 27 + 1
    c2 = (b["nak"] - g["nak"]) % 27 + 1
    t1, t2 = (c1 - 1) % 9 + 1, (c2 - 1) % 9 + 1
    tara = (0.0 if t1 in (3, 5, 7) else 1.5) + (0.0 if t2 in (3, 5, 7) else 1.5)
    out.append(("Tara", 3, tara, "count bride->groom %d (tara %d), groom->bride %d (tara %d)" % (
        c1, t1, c2, t2)))
    yg, yb = YONI_OF_NAK[g["nak"]], YONI_OF_NAK[b["nak"]]
    out.append(("Yoni", 4, float(YONI_TABLE[yg][yb]), "%s / %s" % (YONI_NAMES[yg], YONI_NAMES[yb])))
    lg, lb = T.RASHI_LORD[g["sign"]], T.RASHI_LORD[b["sign"]]
    out.append(("Graha Maitri", 5, graha_maitri(lg, lb), "%s / %s" % (lg, lb)))
    gg, gb = GANA_OF_NAK[g["nak"]], GANA_OF_NAK[b["nak"]]
    out.append(("Gana", 6, float(GANA_TABLE[gg][gb]), "%s / %s" % (GANA_NAMES[gg], GANA_NAMES[gb])))
    d = (g["sign"] - b["sign"]) % 12 + 1
    pair = tuple(sorted((d, (b["sign"] - g["sign"]) % 12 + 1)))
    bad = pair in ((2, 12), (5, 9), (6, 8))
    out.append(("Bhakoot", 7, 0.0 if bad else 7.0, "signs %d/%d apart%s" % (
        pair[0], pair[1], " (dosha)" if bad else "")))
    ng, nb = NADI_OF_NAK[g["nak"]], NADI_OF_NAK[b["nak"]]
    out.append(("Nadi", 8, 0.0 if ng == nb else 8.0, "%s / %s%s" % (
        NADI_NAMES[ng], NADI_NAMES[nb], " (dosha)" if ng == nb else "")))
    total = sum(x[2] for x in out)
    notes = []
    if ng == nb:
        if g["nak"] == b["nak"] and g["pada"] != b["pada"]:
            notes.append("Nadi dosha relaxed: same nakshatra, different pada")
        elif g["sign"] == b["sign"] and g["nak"] != b["nak"]:
            notes.append("Nadi dosha relaxed: same rashi, different nakshatra")
    if bad and (lg == lb or graha_maitri(lg, lb) >= 4):
        notes.append("Bhakoot dosha relaxed: rashi lords same or friendly")
    return {"kootas": [{"name": n, "max": m, "score": s, "detail": dtl} for n, m, s, dtl in out],
            "total": total, "max": 36, "notes": notes,
            "verdict": "excellent" if total >= 28 else ("good" if total >= 18 else "below the customary 18")}


def porutham(g, b):
    out = []
    cnt = (g["nak"] - b["nak"]) % 27 + 1   # bride's star to groom's star
    out.append(("Dina", cnt % 9 in (2, 4, 6, 8, 0), "count %d" % cnt))
    gg, gb = GANA_OF_NAK[g["nak"]], GANA_OF_NAK[b["nak"]]
    gana_ok = gg == gb or (gg == 0 and gb == 1) or (gg == 1 and gb == 0)
    out.append(("Gana", gana_ok, "%s / %s" % (GANA_NAMES[gg], GANA_NAMES[gb])))
    out.append(("Mahendra", cnt in (4, 7, 10, 13, 16, 19, 22, 25), "count %d" % cnt))
    out.append(("Stree Deergha", cnt > 13, "count %d (needs > 13)" % cnt))
    yg, yb = YONI_OF_NAK[g["nak"]], YONI_OF_NAK[b["nak"]]
    out.append(("Yoni", YONI_TABLE[yg][yb] >= 2, "%s / %s" % (YONI_NAMES[yg], YONI_NAMES[yb])))
    rd = (g["sign"] - b["sign"]) % 12 + 1
    out.append(("Rasi", rd not in (2, 6, 8, 12) or g["sign"] == b["sign"],
                "groom's rashi is %d from bride's" % rd))
    lg, lb = T.RASHI_LORD[g["sign"]], T.RASHI_LORD[b["sign"]]
    out.append(("Rasi Adhipati", "enemy" not in (friendship(lg, lb), friendship(lb, lg)),
                "%s / %s" % (lg, lb)))
    vas = g["sign"] in VASYA_RASI.get(b["sign"], []) or b["sign"] in VASYA_RASI.get(g["sign"], [])
    out.append(("Vasya", vas, "%s / %s" % (T.RASHIS[g["sign"]], T.RASHIS[b["sign"]])))
    rj = RAJJU_OF_NAK[g["nak"]] != RAJJU_OF_NAK[b["nak"]]
    out.append(("Rajju", rj, "%s / %s" % (RAJJU_NAMES[RAJJU_OF_NAK[g["nak"]]],
                                          RAJJU_NAMES[RAJJU_OF_NAK[b["nak"]]])))
    vedha = any({g["nak"], b["nak"]} == {x, y} for x, y in VEDHA_PAIRS)
    out.append(("Vedha", not vedha, "vedha pair" if vedha else "no vedha"))
    n_ok = sum(1 for _n, ok, _d in out if ok)
    return {"poruthams": [{"name": n, "ok": bool(ok), "detail": d} for n, ok, d in out],
            "matched": n_ok, "of": 10,
            "critical": [n for n, ok, _d in out if not ok and n in ("Rajju", "Vedha")],
            "variant": "Tamil/Telugu common rules; Stree Deergha > 13"}


def match(groom_chart, bride_chart):
    g, b = _person(groom_chart), _person(bride_chart)

    def kd(ch):
        c = Chart({k: v["longitude"] for k, v in ch["chart"]["grahas"].items()},
                  ch["chart"]["lagna"]["longitude"])
        return kuja_dosha(c)
    kg, kb = kd(groom_chart), kd(bride_chart)
    return {
        "groom": {"nakshatra": T.NAKSHATRAS[g["nak"]], "pada": g["pada"],
                  "rashi": T.RASHIS[g["sign"]]},
        "bride": {"nakshatra": T.NAKSHATRAS[b["nak"]], "pada": b["pada"],
                  "rashi": T.RASHIS[b["sign"]]},
        "ashtakoota": ashtakoota(g, b),
        "porutham": porutham(g, b),
        "kuja_dosha": {"groom": kg, "bride": kb,
                       "balanced": kg["present"] == kb["present"]},
        "status": "TRADITIONAL tables on CALCULATED Moon positions",
    }
