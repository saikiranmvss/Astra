"""Jaimini Chara dasha (K. N. Rao / Jaimini Sutra profile).

Direction: zodiacal if the 9th sign from the lagna is Mesha, Vrishabha,
Mithuna, Tula, Vrishchika or Dhanu ("savya" group), otherwise reverse.
Years of a sign: count from the sign to its lord (forward for savya signs,
backward for the others), minus one; lord in the sign itself = 12 years;
+1 if the lord is exalted, -1 if debilitated.  Vrishchika (Mars/Ketu) and
Kumbha (Saturn/Rahu) take the stronger lord: if one lord occupies the sign
the other is used; else the one with more planets; else the exalted one;
else the higher longitude within its sign.  Second cycle: 12 - first.
Antardashas: 12 equal parts starting from the next sign in the dasha
direction, the dasha sign itself last.
"""
from . import tables as T
from .timescale import format_jd

SAVYA = {0, 1, 2, 6, 7, 8}
CO_LORD = {7: ("Mars", "Ketu"), 10: ("Saturn", "Rahu")}
YEAR_DAYS = 365.2425


def _lord_of(sign, signs, lons):
    if sign not in CO_LORD:
        return T.RASHI_LORD[sign]
    a, b = CO_LORD[sign]
    in_a, in_b = signs[a] == sign, signs[b] == sign
    if in_a and in_b:
        return a
    if in_a:
        return b
    if in_b:
        return a
    count = lambda p: sum(1 for q, s in signs.items() if s == signs[p] and q != p)
    if count(a) != count(b):
        return a if count(a) > count(b) else b
    ex = lambda p: p in T.EXALTATION and T.EXALTATION[p][0] == signs[p]
    if ex(a) != ex(b):
        return a if ex(a) else b
    return a if (lons[a] % 30.0) >= (lons[b] % 30.0) else b


def sign_years(sign, signs, lons):
    lord = _lord_of(sign, signs, lons)
    ls = signs[lord]
    if ls == sign:
        years = 12
    else:
        if sign in SAVYA:
            n = (ls - sign) % 12 + 1
        else:
            n = (sign - ls) % 12 + 1
        years = n - 1
    if lord in T.EXALTATION:
        ex_sign = T.EXALTATION[lord][0]
        if ls == ex_sign:
            years += 1
        elif ls == (ex_sign + 6) % 12:
            years -= 1
    return max(years, 0), lord


def compute(lagna_sign, lons, birth_jd_utc, tz_minutes, now_jd_utc=None, cycles=2):
    signs = {p: int(lons[p] // 30.0) % 12 for p in T.GRAHAS}
    ninth = (lagna_sign + 8) % 12
    direction = 1 if ninth in SAVYA else -1
    seq = [(lagna_sign + direction * i) % 12 for i in range(12)]
    first = {}
    for s in seq:
        first[s] = sign_years(s, signs, lons)
    out = []
    t = birth_jd_utc
    current = []
    loc = lambda jd: format_jd(jd + tz_minutes / 1440.0)
    for cyc in range(cycles):
        for s in seq:
            y1, lord = first[s]
            years = y1 if cyc == 0 else 12 - y1
            if years <= 0:
                continue
            length = years * YEAR_DAYS
            sub = []
            sub_len = length / 12.0
            for j in range(12):
                ss = (s + direction * (j + 1)) % 12
                a = t + j * sub_len
                sub.append({"sign": T.RASHIS[ss], "start": loc(a), "end": loc(a + sub_len),
                            "current": bool(now_jd_utc and a <= now_jd_utc < a + sub_len)})
            node = {"sign": T.RASHIS[s], "lord": lord, "years": years, "cycle": cyc + 1,
                    "start": loc(t), "end": loc(t + length), "sub": sub,
                    "current": bool(now_jd_utc and t <= now_jd_utc < t + length)}
            if node["current"]:
                current = [node["sign"]] + [x["sign"] for x in sub if x["current"]]
            out.append(node)
            t += length
    return {"direction": "zodiacal" if direction == 1 else "reverse",
            "ninth_sign": T.RASHIS[ninth],
            "years_first_cycle": {T.RASHIS[s]: first[s][0] for s in seq},
            "dashas": out, "current": current,
            "profile": "K. N. Rao (Jaimini Sutra); year = 365.2425 days"}
