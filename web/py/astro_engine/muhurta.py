"""Muhurta tables (Varjyam, Amrita kala, Durmuhurta, Choghadiya, Tara/Chandra
bala) and an activity-based muhurta finder.

The activity rules are TRADITIONAL (Muhurta Chintamani family, common South
Indian usage).  Every condition is reported, so a user can see exactly why a
window passed or failed, and can override the lists from the UI.
"""
import math
import time

from . import tables as T
from .constants import DEG2RAD, RAD2DEG
from .daycal import DayRange
from .panchanga import karana_name, tithi_name
from .rootfind import solve
from .timescale import Instant

# ghati (of 60 in the nakshatra) at which Varjyam / Amrita kala begins
VARJYAM_GHATI = [50, 24, 30, 40, 14, 21, 30, 20, 32, 30, 20, 18, 21, 20, 14, 14, 10, 14,
                 20, 24, 20, 10, 10, 18, 16, 24, 30]
AMRITA_GHATI = [42, 48, 54, 52, 38, 35, 54, 44, 56, 54, 44, 42, 45, 44, 38, 38, 34, 38,
                44, 48, 44, 34, 34, 42, 40, 48, 54]
WINDOW_GHATI = 4.0
# weekday -> list of (muhurta number 1..15, 'day'|'night')
DURMUHURTA = {
    0: [(14, "day")], 1: [(9, "day"), (12, "day")], 2: [(4, "day"), (7, "night")],
    3: [(8, "day")], 4: [(6, "day"), (12, "day")], 5: [(4, "day"), (9, "day")],
    6: [(1, "day"), (2, "day")],
}
CHOGHADIYA_OF = ["Udveg", "Amrit", "Rog", "Labh", "Shubh", "Char", "Kaal"]  # by weekday lord
CHOGHADIYA_QUALITY = {"Amrit": "good", "Shubh": "good", "Labh": "good", "Char": "neutral",
                      "Udveg": "bad", "Rog": "bad", "Kaal": "bad"}
TARAS = ["Janma", "Sampat", "Vipat", "Kshema", "Pratyak", "Sadhana", "Naidhana", "Mitra",
         "Parama Mitra"]
GOOD_TARA = {2, 4, 6, 8, 9}
GOOD_CHANDRA = {1, 3, 6, 7, 10, 11}
BAD_YOGAS = {"Vishkambha", "Atiganda", "Shula", "Ganda", "Vyaghata", "Vajra", "Vyatipata",
             "Parigha", "Vaidhriti"}
RIKTA = {4, 9, 14, 19, 24, 29}


def nak_windows(table, idx, start, end):
    if start is None or end is None:
        return None
    dur = end - start
    a = start + table[idx] / 60.0 * dur
    return a, a + WINDOW_GHATI / 60.0 * dur


def durmuhurtas(sunrise, sunset, next_sunrise, wd):
    out = []
    dm = (sunset - sunrise) / 15.0
    nm = (next_sunrise - sunset) / 15.0
    for n, part in DURMUHURTA[wd]:
        if part == "day":
            out.append((sunrise + (n - 1) * dm, sunrise + n * dm))
        else:
            out.append((sunset + (n - 1) * nm, sunset + n * nm))
    return out


def choghadiya(sunrise, sunset, next_sunrise, wd):
    day = (sunset - sunrise) / 8.0
    night = (next_sunrise - sunset) / 8.0
    out = []
    for i in range(8):
        lord = (wd + 5 * i) % 7
        nm = CHOGHADIYA_OF[lord]
        out.append({"name": nm, "quality": CHOGHADIYA_QUALITY[nm], "day": True,
                    "start": sunrise + i * day, "end": sunrise + (i + 1) * day})
    for i in range(8):
        lord = (wd + 4 + 4 * i) % 7
        nm = CHOGHADIYA_OF[lord]
        out.append({"name": nm, "quality": CHOGHADIYA_QUALITY[nm], "day": False,
                    "start": sunset + i * night, "end": sunset + (i + 1) * night})
    return out


def tara(birth_nak_idx, day_nak_idx):
    count = (day_nak_idx - birth_nak_idx) % 27 + 1
    t = (count - 1) % 9 + 1
    return t, TARAS[t - 1], t in GOOD_TARA


def chandra_house(birth_moon_sign, moon_sign):
    return (moon_sign - birth_moon_sign) % 12 + 1


# --------------------------------------------------------------------------
N = {n: i for i, n in enumerate(T.NAKSHATRAS)}


def _naks(*names):
    return [N[n] + 1 for n in names]


ACTIVITIES = {
    "general": {
        "label": "Any auspicious work",
        "nakshatras": None, "weekdays": None,
        "avoid_tithis": sorted(RIKTA | {30}), "lagnas": None,
    },
    "marriage": {
        "label": "Marriage (Vivaha)",
        "nakshatras": _naks("Rohini", "Mrigashira", "Magha", "Uttara Phalguni", "Hasta", "Swati",
                            "Anuradha", "Mula", "Uttara Ashadha", "Uttara Bhadrapada", "Revati"),
        "weekdays": [1, 3, 4, 5],
        "avoid_tithis": sorted(RIKTA | {8, 23, 30}),
        "lagnas": [2, 3, 4, 6, 7, 9, 12],
        "avoid_months": ["Ashadha", "Bhadrapada", "Pushya", "Chaitra"],
    },
    "griha_pravesha": {
        "label": "House warming (Griha Pravesha)",
        "nakshatras": _naks("Rohini", "Mrigashira", "Uttara Phalguni", "Chitra", "Anuradha",
                            "Uttara Ashadha", "Dhanishtha", "Shatabhisha", "Uttara Bhadrapada",
                            "Revati"),
        "weekdays": [1, 3, 4, 5],
        "avoid_tithis": sorted(RIKTA | {1, 8, 23, 30}),
        "lagnas": [2, 5, 8, 11],
        "avoid_months": ["Ashadha", "Bhadrapada", "Ashvayuja", "Pushya", "Chaitra"],
    },
    "vehicle": {
        "label": "Vehicle purchase",
        "nakshatras": _naks("Ashwini", "Mrigashira", "Punarvasu", "Pushya", "Hasta", "Chitra",
                            "Swati", "Anuradha", "Shravana", "Dhanishtha", "Shatabhisha", "Revati"),
        "weekdays": [1, 3, 4, 5],
        "avoid_tithis": sorted(RIKTA | {30}),
        "lagnas": None,
    },
    "business": {
        "label": "Business / shop opening",
        "nakshatras": _naks("Ashwini", "Rohini", "Punarvasu", "Pushya", "Uttara Phalguni", "Hasta",
                            "Chitra", "Anuradha", "Uttara Ashadha", "Shravana", "Dhanishtha",
                            "Revati"),
        "weekdays": [1, 3, 4, 5],
        "avoid_tithis": sorted(RIKTA | {30}),
        "lagnas": [2, 5, 8, 11, 3, 6, 9, 12],
    },
    "property": {
        "label": "Property / land purchase",
        "nakshatras": _naks("Rohini", "Mrigashira", "Punarvasu", "Uttara Phalguni", "Anuradha",
                            "Mula", "Uttara Ashadha", "Uttara Bhadrapada", "Revati", "Magha",
                            "Vishakha"),
        "weekdays": [1, 4, 5],
        "avoid_tithis": sorted(RIKTA | {30}),
        "lagnas": [2, 5, 8, 11],
    },
    "travel": {
        "label": "Travel / journey start",
        "nakshatras": _naks("Ashwini", "Mrigashira", "Punarvasu", "Pushya", "Hasta", "Anuradha",
                            "Shravana", "Dhanishtha", "Revati"),
        "weekdays": [1, 3, 4, 5],
        "avoid_tithis": sorted(RIKTA | {30, 6, 8, 12, 21, 23, 27}),
        "lagnas": None,
    },
    "namakarana": {
        "label": "Naming ceremony (Namakarana)",
        "nakshatras": _naks("Ashwini", "Rohini", "Mrigashira", "Punarvasu", "Pushya",
                            "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Anuradha",
                            "Uttara Ashadha", "Shravana", "Dhanishtha", "Shatabhisha",
                            "Uttara Bhadrapada", "Revati"),
        "weekdays": [1, 3, 4, 5],
        "avoid_tithis": sorted(RIKTA | {8, 23, 30}),
        "lagnas": None,
    },
    "annaprashana": {
        "label": "First feeding (Annaprashana)",
        "nakshatras": _naks("Ashwini", "Rohini", "Mrigashira", "Punarvasu", "Pushya",
                            "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Anuradha",
                            "Uttara Ashadha", "Shravana", "Dhanishtha", "Shatabhisha",
                            "Uttara Bhadrapada", "Revati"),
        "weekdays": [1, 3, 4, 5],
        "avoid_tithis": sorted(RIKTA | {8, 23, 30, 12, 27}),
        "lagnas": None,
    },
    "vidyarambha": {
        "label": "Start of education (Vidyarambha / Aksharabhyasa)",
        "nakshatras": _naks("Ashwini", "Mrigashira", "Ardra", "Punarvasu", "Pushya", "Hasta",
                            "Chitra", "Swati", "Shravana", "Dhanishtha", "Shatabhisha", "Revati"),
        "weekdays": [0, 3, 4, 5],
        "avoid_tithis": sorted(RIKTA | {8, 23, 30}),
        "lagnas": None,
    },
    "upanayana": {
        "label": "Thread ceremony (Upanayana)",
        "nakshatras": _naks("Ashwini", "Mrigashira", "Punarvasu", "Pushya", "Uttara Phalguni",
                            "Hasta", "Chitra", "Swati", "Uttara Ashadha", "Shravana", "Dhanishtha",
                            "Shatabhisha", "Uttara Bhadrapada", "Revati"),
        "weekdays": [0, 1, 3, 4, 5],
        "avoid_tithis": sorted(RIKTA | {8, 23, 30} | set(range(16, 31))),
        "lagnas": None,
        "avoid_months": ["Ashadha", "Shravana", "Bhadrapada", "Ashvayuja", "Kartika",
                         "Margashira", "Pushya"],
    },
    "medical": {
        "label": "Start medical treatment",
        "nakshatras": _naks("Ashwini", "Punarvasu", "Pushya", "Hasta", "Swati", "Anuradha",
                            "Shravana", "Dhanishtha", "Shatabhisha", "Revati", "Mrigashira"),
        "weekdays": [0, 1, 3, 4, 5],
        "avoid_tithis": sorted(RIKTA | {30}),
        "lagnas": None,
    },
}


class FastLagna(object):
    """Sidereal ascendant within one day with frozen precession/nutation.

    GAST advances at 1.00273781191 sidereal days per UT1 day; over a day the
    ignored change of nutation shifts the lagna by well under 1 arcsec.
    """

    def __init__(self, ctx, t_ref, lat, lon):
        inst = Instant.from_utc_jd(t_ref)
        self.o = ctx.orient(inst)
        self.t_ref = t_ref
        self.gast0 = self.o.gast_hours
        self.lat, self.lon = lat, lon
        self.ayan = self.o.ayan_true

    def sid(self, t):
        gast = (self.gast0 + 24.0 * 1.00273781191135448 * (t - self.t_ref)) % 24.0
        ramc = (gast * 15.0 + self.lon) % 360.0
        th = ramc * DEG2RAD
        eps = self.o.true_eps
        phi = self.lat * DEG2RAD
        asc = math.atan2(math.cos(th), -(math.sin(th) * math.cos(eps) + math.tan(phi) * math.sin(eps)))
        return (asc * RAD2DEG - self.ayan) % 360.0

    def sign_changes(self, a, b, step=10.0 / 1440.0):
        out = []
        n = max(1, int(math.ceil((b - a) / step)))
        pt = a
        ps = int(self.sid(a) // 30.0)
        for i in range(1, n + 1):
            t = a + (b - a) * i / n
            s = int(self.sid(t) // 30.0)
            if s != ps:
                target = (s * 30.0) % 360.0

                def g(x, target=target):
                    return (self.sid(x) - target + 180.0) % 360.0 - 180.0
                out.append(solve(g, pt, t, tol_days=1.0 / 86400.0))
            pt, ps = t, s
        return out


def find(p):
    """Muhurta windows for an activity over a date range."""
    started = time.time()
    first = tuple(int(x) for x in p["start"].split("-"))
    last = tuple(int(x) for x in p["end"].split("-"))
    act = ACTIVITIES.get(p.get("activity", "general"), ACTIVITIES["general"])
    rules = dict(act)
    for key in ("nakshatras", "weekdays", "avoid_tithis", "lagnas", "avoid_months"):
        if key in p and p[key] is not None:
            rules[key] = p[key]
    include_night = bool(p.get("include_night", False))
    min_minutes = float(p.get("min_minutes", 24))
    birth_nak = p.get("birth_nakshatra")      # 1..27
    birth_rashi = p.get("birth_rashi")        # 1..12
    dr = DayRange(p, first, last)
    if len(dr.dates) > 190:
        raise ValueError("Muhurta search is limited to about 6 months per query.")
    lat, lon = dr.site[0], dr.site[1]
    results = []
    for i, rec in enumerate(dr.days):
        r, s_, nr = dr.rises[i], dr.sets[i], dr.rises[i + 1]
        if r is None or s_ is None or nr is None:
            continue
        wd = rec["weekday"]
        a, b = r, (nr if include_night else s_)
        cuts = {a, b}
        blocks = []
        for key in ("rahu_kala", "yamaganda", "gulika"):
            if key in rec:
                blocks.append((key.replace("_", " "), rec[key][0], rec[key][1]))
        for x, y in durmuhurtas(r, s_, nr, wd):
            blocks.append(("durmuhurta", x, y))
        amrita = []
        for k, ns, ne in dr.nak.between(a - 1.5, b):
            w = nak_windows(VARJYAM_GHATI, k, ns, ne)
            if w:
                blocks.append(("varjyam", w[0], w[1]))
            w = nak_windows(AMRITA_GHATI, k, ns, ne)
            if w:
                amrita.append(w)
        for _, x, y in blocks:
            cuts.update([x, y])
        for bnd in (dr.tithi, dr.nak, dr.yoga, dr.karana, dr.moon_sign):
            for _k, x, y in bnd.between(a, b):
                if x is not None:
                    cuts.add(x)
                if y is not None:
                    cuts.add(y)
        fl = FastLagna(dr.series.ctx, r, lat, lon)
        cuts.update(fl.sign_changes(a, b))
        pts = sorted(t for t in cuts if a <= t <= b)
        month = rec["month"]
        segs = []
        for x, y in zip(pts[:-1], pts[1:]):
            if y - x < 1e-6:
                continue
            mid = (x + y) / 2.0
            ti = dr.tithi.at(mid)[0]
            ni = dr.nak.at(mid)[0]
            yi = dr.yoga.at(mid)[0]
            kn = karana_name(dr.karana.at(mid)[0])
            mi = dr.moon_sign.at(mid)[0]
            li = int(fl.sid(mid) // 30.0)
            fails = []
            if rules.get("nakshatras") and (ni + 1) not in rules["nakshatras"]:
                fails.append("nakshatra")
            if rules.get("weekdays") is not None and wd not in rules["weekdays"]:
                fails.append("weekday")
            if (ti + 1) in (rules.get("avoid_tithis") or []):
                fails.append("tithi")
            if T.YOGAS[yi] in BAD_YOGAS:
                fails.append("yoga")
            if kn == "Vishti":
                fails.append("vishti karana")
            if month and (month["adhika"] or month["name"] in (rules.get("avoid_months") or [])):
                fails.append("month")
            if rules.get("lagnas") and (li + 1) not in rules["lagnas"]:
                fails.append("lagna")
            for nm, bx, by in blocks:
                if bx <= mid < by:
                    fails.append(nm)
            tb = cb = None
            if birth_nak:
                tnum, tname, good = tara(int(birth_nak) - 1, ni)
                tb = tname
                if not good:
                    fails.append("tarabala")
            if birth_rashi:
                h = chandra_house(int(birth_rashi) - 1, mi)
                cb = h
                if h not in GOOD_CHANDRA:
                    fails.append("chandrabala")
            segs.append({"a": x, "b": y, "ok": not fails, "fails": fails, "tithi": ti,
                         "nak": ni, "yoga": yi, "karana": kn, "lagna": li, "moon": mi,
                         "tara": tb, "chandra": cb,
                         "amrita": any(u <= mid < v for u, v in amrita)})
        # merge passing segments
        run = None
        for sg in segs + [None]:
            if sg is not None and sg["ok"]:
                if run is None:
                    run = {"start": sg["a"], "end": sg["b"], "parts": [sg]}
                else:
                    run["end"] = sg["b"]
                    run["parts"].append(sg)
                continue
            if run is not None:
                if (run["end"] - run["start"]) * 1440.0 >= min_minutes:
                    results.append(_window(dr, i, rec, run))
                run = None
    return {
        "kind": "muhurta",
        "activity": p.get("activity", "general"),
        "label": act["label"],
        "rules": {k: rules.get(k) for k in ("nakshatras", "weekdays", "avoid_tithis", "lagnas",
                                            "avoid_months")},
        "always_avoided": ["Rahu kala", "Yamaganda", "Gulika kala", "Durmuhurta", "Varjyam",
                           "Vishti (Bhadra) karana", "inauspicious yogas", "adhika masa"],
        "count": len(results),
        "windows": results,
        "compute_seconds": round(time.time() - started, 3),
        "status": "TRADITIONAL rules on CALCULATED panchanga",
    }


def _window(dr, i, rec, run):
    parts = run["parts"]
    lagnas = []
    for sg in parts:
        nm = T.RASHIS[sg["lagna"]]
        if not lagnas or lagnas[-1] != nm:
            lagnas.append(nm)
    first = parts[0]
    score = 0
    reasons = []
    if any(sg["amrita"] for sg in parts):
        score += 2
        reasons.append("overlaps Amrita kala")
    if first["tithi"] < 15:
        score += 1
        reasons.append("Shukla paksha")
    if first["lagna"] in (1, 4, 7, 10):
        reasons.append("fixed lagna")
    r, s_ = dr.rises[i], dr.sets[i]
    if r is not None and s_ is not None:
        day = s_ - r
        ab = (r + 7 * day / 15.0, r + 8 * day / 15.0)
        if run["start"] < ab[1] and run["end"] > ab[0] and rec["weekday"] != 3:
            score += 2
            reasons.append("includes Abhijit muhurta")
    return {
        "date": rec["date"], "vara": rec["vara"], "weekday": rec["weekday"],
        "start": dr.fmt(run["start"]), "end": dr.fmt(run["end"]),
        "minutes": round((run["end"] - run["start"]) * 1440.0, 1),
        "tithi": ("Shukla " if first["tithi"] < 15 else "Krishna ") + tithi_name(first["tithi"]),
        "nakshatras": sorted(set(T.NAKSHATRAS[sg["nak"]] for sg in parts),
                             key=lambda n: T.NAKSHATRAS.index(n)),
        "yoga": T.YOGAS[first["yoga"]],
        "karana": first["karana"],
        "lagnas": lagnas,
        "tarabala": first["tara"], "chandrabala_house": first["chandra"],
        "month": rec["month"]["name"] if rec["month"] else None,
        "score": score, "reasons": reasons,
    }
