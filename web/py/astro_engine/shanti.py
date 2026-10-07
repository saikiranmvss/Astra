"""Janana dosha: birth moments that traditionally call for a shanti.

Two views of the same rules:
  check_birth  - every rule tested against one birth instant
  day_windows  - the stretches of a panchanga day in which a birth would raise one

Rules follow common South Indian practice (Muhurta Chintamani, Jataka
Parijata and regional panchangams); a ghati is 24 minutes.  Traditions differ
on pada effects and on which yogas count, so every finding carries its rule.
Levels: "danger" (shanti normally prescribed), "warn" (commonly advised),
"info" (noted only).
"""
from . import tables as T
from .constants import NAKSHATRA_SPAN
from .panchanga import karana_name, tithi_name

GHATI_MIN = 24.0
JUNCTION_MIN = 2 * GHATI_MIN
SANKRANTI_MIN = 16 * GHATI_MIN
LAGNA_GANDANTA_DEG = 1.0

GANDAMOOLA = {0, 8, 9, 17, 18, 26}
FIRE_START = {0, 9, 18}      # Ashwini, Magha, Mula begin a fire sign
WATER_END = {8, 17, 26}      # Ashlesha, Jyeshtha, Revati end a water sign
JYESHTHA, MULA = 17, 18
TITHI_JUNCTION_END = {5, 10, 15, 20, 25, 30}
# traditional effect of each Gandamoola pada: (harmful?, effect)
GANDAMOOLA_PADA = {
    0: [(True, "trouble to the father"), (False, "comfort and luxury"),
        (False, "high position"), (False, "honour and fame")],
    8: [(False, "auspicious"), (True, "loss of wealth"),
        (True, "trouble to the mother"), (True, "trouble to the father")],
    9: [(True, "trouble to the mother"), (True, "trouble to the father"),
        (False, "happiness"), (False, "gain of wealth and learning")],
    17: [(True, "trouble to the elder brother"), (True, "trouble to the younger brother"),
         (True, "trouble to the mother"), (True, "trouble to the native")],
    18: [(True, "trouble to the father"), (True, "trouble to the mother"),
         (True, "loss of wealth"), (False, "auspicious")],
    26: [(False, "royal honour"), (False, "high position"),
         (False, "wealth and comfort"), (True, "many troubles")],
}
PADA_NEAR_MIN = 20.0
STRONG_YOGAS = {"Vyatipata", "Vaidhriti"}
MINOR_YOGAS = {"Vishkambha", "Atiganda", "Shula", "Ganda", "Vyaghata", "Vajra", "Parigha"}

RULES = {
    "gandamoola": "Gandamoola nakshatras: Ashwini, Ashlesha, Magha, Jyeshtha, Mula, Revati. Each pada "
                  "has its own effect; pada 1 of Ashwini/Magha/Mula and pada 4 of Ashlesha/Jyeshtha/"
                  "Revati sit on the water-fire junction and are the strongest. Favourable padas are "
                  "held free of dosha in most traditions, though some families still do a simple "
                  "shanti. Some traditions read Jyeshtha / Mula effects for a girl on the in-laws.",
    "gandanta": "Nakshatra gandanta: last 2 ghatis (48 min) of Revati, Ashlesha, Jyeshtha and first "
                "2 ghatis of Ashwini, Magha, Mula. Jyeshtha-Mula is Abhukta Mula.",
    "tithi_gandanta": "Tithi gandanta: 2 ghatis either side of the end of Panchami, Dashami, "
                      "Purnima and Amavasya (both pakshas).",
    "lagna_gandanta": "Lagna gandanta: ascendant within 1 deg of the Karka-Simha, "
                      "Vrishchika-Dhanu or Meena-Mesha boundary.",
    "amavasya": "Birth on Amavasya (Darsha).",
    "chaturdashi": "Krishna Chaturdashi is split into 6 parts; the first part is held harmless.",
    "vishti": "Vishti (Bhadra) karana at birth.",
    "yoga": "Vyatipata and Vaidhriti yogas call for shanti; Vishkambha, Atiganda, Shula, Ganda, "
            "Vyaghata, Vajra and Parigha are noted.",
    "varjyam": "Varjyam (Thyajyam) at birth, observed in Telugu / Andhra practice.",
    "sankranti": "Birth within 16 ghatis (6 h 24 min) of the Sun entering a sign.",
    "eclipse": "Birth while an eclipse is in progress and visible at the place.",
}
REMEDY = {
    "gandamoola": "Gandamoola nakshatra shanti, on the day the Moon returns to the birth nakshatra "
                  "(about 27 days after birth)",
    "gandanta": "Gandanta shanti together with the Gandamoola shanti",
    "tithi_gandanta": "Gandanta shanti",
    "lagna_gandanta": "Gandanta shanti",
    "amavasya": "Darsha (Amavasya) janana shanti",
    "chaturdashi": "Krishna Chaturdashi janana shanti",
    "vishti": "Vishti (Bhadra) janana shanti",
    "yoga": "Yoga janana shanti",
    "varjyam": "Thyajya (Varjyam) janana shanti where this is followed",
    "sankranti": "Sankranti janana shanti",
    "eclipse": "Grahana janana shanti",
}


def _item(key, name, level, detail, rule_key=None):
    rk = rule_key or key
    return {"key": key, "name": name, "level": level, "detail": detail,
            "remedy": REMEDY.get(rk), "rule": RULES.get(rk)}


def _hm(minutes):
    m = int(round(abs(minutes)))
    return "%d min" % m if m < 60 else "%d h %02d min" % (m // 60, m % 60)


def _pada(lon):
    nk = int(lon // NAKSHATRA_SPAN)
    return nk, min(4, int((lon - nk * NAKSHATRA_SPAN) // (NAKSHATRA_SPAN / 4.0)) + 1)


def gm_pada(nk, pada):
    """(level, effect, junction) of a Gandamoola pada; None outside Gandamoola."""
    if nk not in GANDAMOOLA:
        return None
    harmful, effect = GANDAMOOLA_PADA[nk][pada - 1]
    junction = (nk in FIRE_START and pada == 1) or (nk in WATER_END and pada == 4)
    return ("danger" if junction else "warn" if harmful else "info"), effect, junction


def _pada_table(nk, pada):
    return [{"pada": p, "level": gm_pada(nk, p)[0], "effect": gm_pada(nk, p)[1], "birth": p == pada}
            for p in (1, 2, 3, 4)]


def check_birth(eng, jd, tz, lat, lon, lagna_lon, fmt):
    """Every janana-dosha rule tested at the birth instant (UTC JD)."""
    from . import muhurta as MU
    items = []

    # nakshatra
    ms = eng.moon_sid(jd)
    nk, pada = _pada(ms)
    _, ns, ne = eng.interval(eng.moon_sid, NAKSHATRA_SPAN, jd, 0.25)
    name = T.NAKSHATRAS[nk]
    if nk in GANDAMOOLA:
        level, effect, junction = gm_pada(nk, pada)
        tail = (", the junction pada (strongest)" if junction else
                "; favourable pada, held free of dosha in most traditions" if level == "info" else "")
        it = _item("gandamoola", "Gandamoola nakshatra", level,
                   "%s pada %d: %s%s" % (name, pada, effect, tail))
        it["padas"] = _pada_table(nk, pada)
        items.append(it)
        _, pa, pb = eng.interval(eng.moon_sid, NAKSHATRA_SPAN / 4.0, jd, 0.1)
        for side, edge, other in (("began", pa, pada - 1), ("ends", pb, pada + 1)):
            if edge is None or not 1 <= other <= 4:
                continue
            mins = abs(jd - edge) * 1440.0
            if mins <= PADA_NEAR_MIN and gm_pada(nk, other)[0] != level:
                items.append(_item("pada_edge", "Close to a pada boundary", "warn",
                                   "Pada %d %s %s %s birth; pada %d (%s) would change the verdict. "
                                   "Confirm the exact birth time."
                                   % (pada, side, _hm(mins), "before" if side == "began" else "after",
                                      other, gm_pada(nk, other)[1])))
    junction = None
    if nk in FIRE_START and ns is not None and (jd - ns) * 1440.0 <= JUNCTION_MIN:
        junction = ((nk - 1) % 27, nk, (jd - ns) * 1440.0, "after %s began" % name)
    elif nk in WATER_END and ne is not None and (ne - jd) * 1440.0 <= JUNCTION_MIN:
        junction = (nk, (nk + 1) % 27, (ne - jd) * 1440.0, "before %s ends" % name)
    if junction:
        a, b, mins, where = junction
        abhukta = (a, b) == (JYESHTHA, MULA)
        items.append(_item("abhukta_mula" if abhukta else "nakshatra_gandanta",
                           "Abhukta Mula" if abhukta else "Nakshatra gandanta", "danger",
                           "%s %s (%s-%s junction)" % (_hm(mins), where, T.NAKSHATRAS[a],
                                                      T.NAKSHATRAS[b]), "gandanta"))

    # tithi
    e = eng.elongation(jd)
    ti, ts, te = eng.interval(eng.elongation, 12.0, jd, 0.25)
    t1 = ti + 1
    if t1 == 30:
        items.append(_item("amavasya", "Amavasya birth", "danger", "Born on Amavasya"))
    elif t1 == 29 and ts is not None and te is not None:
        part = min(6, int((jd - ts) / (te - ts) * 6.0) + 1)
        items.append(_item("chaturdashi", "Krishna Chaturdashi birth", "info" if part == 1 else "warn",
                           "Part %d of 6 of Krishna Chaturdashi%s"
                           % (part, " (first part, held harmless)" if part == 1 else "")))
    if te is not None and t1 in TITHI_JUNCTION_END and (te - jd) * 1440.0 <= JUNCTION_MIN:
        items.append(_item("tithi_gandanta", "Tithi gandanta", "warn",
                           "%s before %s ends" % (_hm((te - jd) * 1440.0), tithi_name(ti))))
    elif ts is not None and (t1 - 1 or 30) in TITHI_JUNCTION_END and (jd - ts) * 1440.0 <= JUNCTION_MIN:
        items.append(_item("tithi_gandanta", "Tithi gandanta", "warn",
                           "%s after %s began" % (_hm((jd - ts) * 1440.0), tithi_name(ti))))

    # karana and yoga
    if karana_name(int(e // 6.0)) == "Vishti":
        items.append(_item("vishti", "Vishti (Bhadra) karana", "warn", "Born in Vishti karana"))
    yname = T.YOGAS[int(eng.yoga_angle(jd) // NAKSHATRA_SPAN)]
    if yname in STRONG_YOGAS:
        items.append(_item("yoga", "%s yoga" % yname, "warn", "Born in %s yoga" % yname))
    elif yname in MINOR_YOGAS:
        items.append(_item("yoga", "%s yoga" % yname, "info", "Born in %s yoga (minor)" % yname))

    # lagna gandanta
    best = min((abs(((lagna_lon - b) + 180.0) % 360.0 - 180.0), b) for b in (0.0, 120.0, 240.0))
    if best[0] <= LAGNA_GANDANTA_DEG:
        k = int(best[1] // 30.0)
        items.append(_item("lagna_gandanta", "Lagna gandanta", "warn",
                           "Ascendant %.0f\u2032 from the %s-%s boundary"
                           % (best[0] * 60.0, T.RASHIS[(k - 1) % 12], T.RASHIS[k])))

    # varjyam (thyajyam)
    w = MU.nak_windows(MU.VARJYAM_GHATI, nk, ns, ne)
    if w and w[0] <= jd < w[1]:
        items.append(_item("varjyam", "Varjyam (Thyajyam)", "warn",
                           "Born inside Varjyam %s - %s" % (fmt(w[0])[11:16], fmt(w[1])[11:16])))

    # sankranti
    prev, prev_sign = eng.sankranti(jd, -1)
    nxt, nxt_sign = eng.sankranti(jd, 1)
    near = [(abs(jd - t) * 1440.0, t, s) for t, s in ((prev, prev_sign), (nxt, nxt_sign)) if t]
    if near:
        mins, t, sign = min(near)
        if mins <= SANKRANTI_MIN:
            items.append(_item("sankranti", "Sankranti birth", "warn",
                               "Sun entered %s %s %s birth" % (sign, _hm(mins),
                                                               "before" if t <= jd else "after")))

    # eclipse
    items.extend(_eclipse_items(jd, tz, lat, lon, fmt))

    order = {"danger": 0, "warn": 1, "info": 2}
    items.sort(key=lambda x: order[x["level"]])
    levels = {x["level"] for x in items}
    if "danger" in levels:
        verdict = ("danger", "Shanti advised")
    elif "warn" in levels:
        verdict = ("warn", "Shanti commonly advised")
    else:
        verdict = ("ok", "No janana dosha found" if not items else "No shanti needed (minor notes)")
    return {
        "level": verdict[0], "title": verdict[1], "items": items,
        "nakshatra": name, "pada": pada,
        "nakshatra_return": _return(eng, nk, ns, fmt),
        "not_checked": "Same nakshatra as the father, mother or a sibling (Eka-nakshatra janana): "
                       "compare their charts.",
        "status": "TRADITIONAL rules on the CALCULATED birth moment",
    }


def _return(eng, nk, ns, fmt):
    """Next stretch of the birth nakshatra, the usual day for the shanti."""
    if ns is None:
        return None
    for shift in (0.3, -0.3, 0.9):
        idx, a, b = eng.interval(eng.moon_sid, NAKSHATRA_SPAN, ns + 27.3217 + shift, 0.25)
        if idx == nk and a is not None:
            return {"nakshatra": T.NAKSHATRAS[nk], "start": fmt(a), "end": fmt(b)}
    return None


def _eclipse_items(jd, tz, lat, lon, fmt):
    from . import eclipses
    from .timescale import calendar
    d0 = calendar(jd + tz / 1440.0 - 1.0)[:3]
    d1 = calendar(jd + tz / 1440.0 + 1.0)[:3]
    res = eclipses.search({"start": "%04d-%02d-%02d" % d0, "end": "%04d-%02d-%02d" % d1,
                           "lat": lat, "lon": lon, "tz_minutes": tz})
    born = fmt(jd)
    out = []
    for ec in res["eclipses"]:
        if ec["type"] == "lunar":
            c = ec.get("contacts", {})
            a, b = (c.get("U1"), c.get("U4")) if ec["kind"] != "penumbral" else (c.get("P1"), c.get("P4"))
            visible = ec.get("visible_any", False) and ec["kind"] != "penumbral"
        else:
            loc = ec.get("local") or {}
            c = loc.get("contacts", {})
            a, b = c.get("C1"), c.get("C4")
            visible = loc.get("visible", False)
        label = "%s %s eclipse" % (ec["kind"].split(" ")[0].capitalize(), ec["type"])
        if a and b and a <= born <= b:
            out.append(_item("eclipse", "Born during an eclipse", "danger" if visible else "info",
                             "%s, %s - %s%s" % (label, a[11:16], b[11:16],
                                                "" if visible else " (not visible here)")))
        elif ec["max"][:10] == born[:10]:
            out.append(_item("eclipse", "Eclipse on the birth day", "info",
                             "%s at %s, not at the birth time" % (label, ec["max"][11:16])))
    return out


def day_windows(naks, tithis, yogas, karanas, varjyam, fmt, day_start, day_end, padas=()):
    """Stretches of a Hindu day (sunrise to next sunrise) in which a birth would
    need (or often get) a shanti.

    naks/tithis/yogas/karanas are panchanga interval lists (1-based index, name,
    start_jd, end_jd); varjyam is a list of (start_jd, end_jd, nakshatra); padas are
    exact Moon pada intervals (global pada 0-107, start_jd, end_jd)."""
    J = JUNCTION_MIN / 1440.0
    out = []

    def add(a, b, name, level, key, note=""):
        if a is None or b is None or b <= a or b <= day_start or a >= day_end:
            return
        out.append({"start": fmt(a), "end": fmt(b), "start_jd": a, "end_jd": b, "name": name,
                    "level": level, "key": key, "note": note, "remedy": REMEDY.get(key)})

    for x in naks:
        k, a, b = x["index"] - 1, x["start_jd"], x["end_jd"]
        if k not in GANDAMOOLA or a is None or b is None:
            continue
        nm = T.NAKSHATRAS[k]
        exact = {gp % 4 + 1: (pa, pb) for gp, pa, pb in padas if gp // 4 == k}
        q = (b - a) / 4.0
        for p in (1, 2, 3, 4):
            pa, pb = exact.get(p) or (None, None)
            if pa is None or pb is None:
                pa, pb = a + (p - 1) * q, a + p * q
            level, effect, junction = gm_pada(k, p)
            add(pa, pb, "%s pada %d" % (nm, p), level, "gandamoola",
                "Gandamoola: " + effect + (" (junction pada, strongest)" if junction else
                                           " (favourable, usually no shanti)" if level == "info" else ""))
        if k in FIRE_START:
            add(a, a + J, "Abhukta Mula" if k == MULA else "Gandanta: start of " + nm, "danger",
                "gandanta", "first 2 ghatis")
        else:
            add(b - J, b, "Abhukta Mula" if k == JYESHTHA else "Gandanta: end of " + nm, "danger",
                "gandanta", "last 2 ghatis")
    for x in tithis:
        i, a, b = x["index"], x["start_jd"], x["end_jd"]
        if i == 30:
            add(a, b, "Amavasya", "danger", "amavasya")
        elif i == 29 and a is not None and b is not None:
            add(a + (b - a) / 6.0, b, "Krishna Chaturdashi (parts 2-6)", "warn", "chaturdashi",
                "first sixth held harmless")
        if i in TITHI_JUNCTION_END and b is not None:
            add(b - J, b + J, "Tithi gandanta: %s ends" % tithi_name(i - 1), "warn", "tithi_gandanta")
    for x in yogas:
        if x["name"] in STRONG_YOGAS:
            add(x["start_jd"], x["end_jd"], x["name"] + " yoga", "warn", "yoga")
    for x in karanas:
        if x["name"] == "Vishti":
            add(x["start_jd"], x["end_jd"], "Vishti (Bhadra) karana", "warn", "vishti")
    for a, b, nak in varjyam:
        add(a, b, "Varjyam (Thyajyam)", "warn", "varjyam", nak)
    out.sort(key=lambda w: (w["start_jd"], 0 if w["level"] == "danger" else 1))
    merged = []
    for w in out:
        m = next((x for x in merged if x["name"] == w["name"] and abs(x["end_jd"] - w["start_jd"]) < 1e-6), None)
        if m:
            m.update(end=w["end"], end_jd=w["end_jd"], note="2 ghatis either side of the junction")
        else:
            merged.append(w)
    return merged
