"""Vimshottari dasha: mahadasha, antardasha, pratyantardasha (and deeper)."""
from . import tables as T
from .constants import NAKSHATRA_SPAN
from .timescale import format_jd

YEAR_DAYS = {"julian": 365.25, "tropical": 365.242199, "savana": 360.0}
LEVEL_NAMES = ["mahadasha", "antardasha", "pratyantardasha", "sookshma", "prana"]


def _lord_index(name):
    for i, (n, _y) in enumerate(T.DASHA_ORDER):
        if n == name:
            return i
    raise KeyError(name)


def _children(start_jd, lord_i, years, depth, max_depth, year_days, tz_min, now_jd):
    out = []
    t = start_jd
    for k in range(9):
        li = (lord_i + k) % 9
        lord, ly = T.DASHA_ORDER[li]
        dur_years = years * ly / 120.0
        end = t + dur_years * year_days
        node = {
            "lord": lord,
            "start": format_jd(t + tz_min / 1440.0),
            "end": format_jd(end + tz_min / 1440.0),
            "start_jd": t,
            "end_jd": end,
            "years": dur_years,
        }
        if now_jd is not None:
            node["current"] = t <= now_jd < end
        if depth + 1 < max_depth:
            node["sub"] = _children(t, li, dur_years, depth + 1, max_depth, year_days,
                                    tz_min, now_jd)
        out.append(node)
        t = end
    return out


def vimshottari(moon_sid, birth_jd_utc, year="julian", levels=3, tz_minutes=0,
                now_jd_utc=None):
    year_days = YEAR_DAYS[year]
    moon_sid %= 360.0
    nak = int(moon_sid // NAKSHATRA_SPAN) % 27
    into = moon_sid - nak * NAKSHATRA_SPAN
    f = into / NAKSHATRA_SPAN
    lord, total = T.DASHA_ORDER[nak % 9]
    lord_i = _lord_index(lord)
    elapsed_days = f * total * year_days
    virtual_start = birth_jd_utc - elapsed_days

    mahas = []
    t = virtual_start
    for k in range(9):
        li = (lord_i + k) % 9
        name, yrs = T.DASHA_ORDER[li]
        end = t + yrs * year_days
        node = {
            "lord": name,
            "start": format_jd(max(t, birth_jd_utc) + tz_minutes / 1440.0),
            "end": format_jd(end + tz_minutes / 1440.0),
            "start_jd": t,
            "end_jd": end,
            "years": yrs,
            "balance_at_birth": (end - birth_jd_utc) / year_days if k == 0 else None,
        }
        if now_jd_utc is not None:
            node["current"] = t <= now_jd_utc < end
        if levels > 1:
            node["sub"] = _children(t, li, yrs, 1, levels, year_days, tz_minutes, now_jd_utc)
        mahas.append(node)
        t = end

    current = []
    if now_jd_utc is not None:
        level = mahas
        while level:
            hit = next((n for n in level if n.get("current")), None)
            if not hit:
                break
            current.append({"lord": hit["lord"], "start": hit["start"], "end": hit["end"]})
            level = hit.get("sub")

    return {
        "system": "Vimshottari",
        "year_length_days": year_days,
        "year_profile": year,
        "birth_nakshatra": T.NAKSHATRAS[nak],
        "starting_lord": lord,
        "elapsed_fraction": f,
        "elapsed_arcmin": into * 60.0,
        "balance_years": total * (1.0 - f),
        "formula": "balance = Y * (1 - x/800'), x = Moon's arc inside the nakshatra",
        "mahadashas": mahas,
        "current": current,
        "levels": [LEVEL_NAMES[i] for i in range(levels)],
    }


# Yogini: (name, lord, years), 36-year cycle
YOGINI = [("Mangala", "Moon", 1), ("Pingala", "Sun", 2), ("Dhanya", "Jupiter", 3),
          ("Bhramari", "Mars", 4), ("Bhadrika", "Mercury", 5), ("Ulka", "Saturn", 6),
          ("Siddha", "Venus", 7), ("Sankata", "Rahu", 8)]
# Ashtottari: (name, lord, years), 108-year cycle, with the 27-nakshatra groups
ASHTOTTARI = [("Sun", "Sun", 6), ("Moon", "Moon", 15), ("Mars", "Mars", 8),
              ("Mercury", "Mercury", 17), ("Saturn", "Saturn", 10), ("Jupiter", "Jupiter", 19),
              ("Rahu", "Rahu", 12), ("Venus", "Venus", 21)]
ASHTOTTARI_GROUPS = [[5, 6, 7, 8], [9, 10, 11], [12, 13, 14, 15], [16, 17, 18], [19, 20, 21],
                     [22, 23, 24], [25, 26, 0, 1], [2, 3, 4]]


def _periodic(order, start_i, elapsed_frac, birth_jd, year_days, tz_minutes, now_jd,
              span_years=120.0):
    """Mahadashas (with antardashas) of a cyclic system starting part-way into order[start_i]."""
    total = float(sum(o[2] for o in order))
    n = len(order)
    fmt = lambda j: format_jd(j + tz_minutes / 1440.0)
    t = birth_jd - elapsed_frac * order[start_i][2] * year_days
    stop = birth_jd + span_years * year_days
    mahas, k = [], 0
    while t < stop:
        i = (start_i + k) % n
        name, lord, yrs = order[i]
        end = t + yrs * year_days
        subs, s = [], t
        for j in range(n):
            si = (i + j) % n
            sname, slord, sy = order[si]
            se = s + yrs * sy / total * year_days
            subs.append({"name": sname, "lord": slord, "start": fmt(max(s, birth_jd)), "end": fmt(se),
                         "start_jd": s, "end_jd": se,
                         "current": now_jd is not None and s <= now_jd < se})
            s = se
        mahas.append({"name": name, "lord": lord, "years": yrs, "start": fmt(max(t, birth_jd)),
                      "end": fmt(end), "start_jd": t, "end_jd": end,
                      "current": now_jd is not None and t <= now_jd < end,
                      "balance_at_birth": (end - birth_jd) / year_days if k == 0 else None,
                      "sub": [x for x in subs if x["end_jd"] > birth_jd]})
        t = end
        k += 1
    current = []
    for m in mahas:
        if m["current"]:
            current.append({"name": m["name"], "lord": m["lord"], "start": m["start"], "end": m["end"]})
            for s in m["sub"]:
                if s["current"]:
                    current.append({"name": s["name"], "lord": s["lord"], "start": s["start"], "end": s["end"]})
    return mahas, current


def yogini(moon_sid, birth_jd_utc, year="julian", tz_minutes=0, now_jd_utc=None):
    year_days = YEAR_DAYS[year]
    moon_sid %= 360.0
    nak = int(moon_sid // NAKSHATRA_SPAN) % 27
    f = (moon_sid - nak * NAKSHATRA_SPAN) / NAKSHATRA_SPAN
    r = (nak + 1 + 3) % 8
    start_i = (r if r else 8) - 1
    mahas, current = _periodic(YOGINI, start_i, f, birth_jd_utc, year_days, tz_minutes, now_jd_utc)
    return {"system": "Yogini", "cycle_years": 36, "birth_nakshatra": T.NAKSHATRAS[nak],
            "starting": YOGINI[start_i][0], "balance_years": YOGINI[start_i][2] * (1.0 - f),
            "rule": "start = (nakshatra number + 3) mod 8 (0 = Sankata); balance by the Moon's unelapsed arc",
            "mahadashas": mahas, "current": current, "year_length_days": year_days}


def ashtottari(moon_sid, birth_jd_utc, year="julian", tz_minutes=0, now_jd_utc=None):
    year_days = YEAR_DAYS[year]
    moon_sid %= 360.0
    nak = int(moon_sid // NAKSHATRA_SPAN) % 27
    f = (moon_sid - nak * NAKSHATRA_SPAN) / NAKSHATRA_SPAN
    gi = next(i for i, g in enumerate(ASHTOTTARI_GROUPS) if nak in g)
    group = ASHTOTTARI_GROUPS[gi]
    elapsed = (group.index(nak) + f) / len(group)
    mahas, current = _periodic(ASHTOTTARI, gi, elapsed, birth_jd_utc, year_days, tz_minutes, now_jd_utc)
    return {"system": "Ashtottari", "cycle_years": 108, "birth_nakshatra": T.NAKSHATRAS[nak],
            "starting": ASHTOTTARI[gi][0], "balance_years": ASHTOTTARI[gi][2] * (1.0 - elapsed),
            "rule": "27-nakshatra groups from Ardra (Abhijit not separated); balance over the lord's whole group. "
                    "Traditionally applied when Rahu is in a kendra/trikona from the lagna lord.",
            "mahadashas": mahas, "current": current, "year_length_days": year_days}
