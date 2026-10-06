"""Shadbala (BPHS ch. 27) in virupas (60 virupas = 1 rupa).

Components: Sthana (uchcha, saptavargaja, ojayugma, kendradi, drekkana),
Dig, Kala (nathonnatha, paksha, tribhaga, abda/masa/vara/hora, ayana,
yuddha), Cheshta, Naisargika, Drik.  Profile choices are listed in
PROFILE so results are reproducible and comparable with other software.
"""
import math

from . import tables as T
from .constants import DEG2RAD, RAD2DEG
from .suntimes import day_part
from .vargas import varga

PROFILE = {
    "saptavarga": "D1, D2, D3, D7, D9, D12, D30; moolatrikona only in D1",
    "kendradi": "Sripati bhava of the planet",
    "paksha": "Moon treated as benefic, its paksha bala doubled (Sripati)",
    "hora": "equal 60-minute horas from local sunrise",
    "ahargana": "civil days from the Kali epoch (Friday, JD 588465.5)",
    "cheshta": "BPHS cheshta kendra with modern mean heliocentric longitudes",
    "yuddha": "within 1 deg; northern planet wins the difference of sthana+dig+kala",
    "drik": "BPHS drishti curve with special aspects of Mars, Jupiter, Saturn; sum/4",
}
SEVEN = T.SEVEN
REQUIRED = {"Sun": 390, "Moon": 360, "Mars": 300, "Mercury": 420, "Jupiter": 390,
            "Venus": 330, "Saturn": 300}
CHALDEAN = ["Saturn", "Jupiter", "Mars", "Sun", "Venus", "Mercury", "Moon"]
KALI_EPOCH_JDN = 588466
COMPOUND_VALUE = {"great friend": 22.5, "friend": 15.0, "neutral": 7.5, "enemy": 3.75,
                  "great enemy": 1.875}
# mean heliocentric longitudes, mean equinox of date (Simon et al. 1994)
MEAN_HELIO = {"Mercury": (252.250906, 149472.6746358), "Venus": (181.979801, 58517.8156760),
              "Earth": (100.466457, 35999.3728565), "Mars": (355.433000, 19140.2993039),
              "Jupiter": (34.351519, 3034.9056606), "Saturn": (50.077444, 1222.1138488)}


def _wrap180(x):
    return (x + 180.0) % 360.0 - 180.0


def _natural(p, q):
    f, n, e = T.NATURAL_FRIENDS[p]
    return "friend" if q in f else ("enemy" if q in e else "neutral")


def compound_relation(p, q, signs):
    nat = _natural(p, q)
    h = (signs[q] - signs[p]) % 12 + 1
    temp_friend = h in (2, 3, 4, 10, 11, 12)
    table = {("friend", True): "great friend", ("neutral", True): "friend",
             ("enemy", True): "neutral", ("friend", False): "neutral",
             ("neutral", False): "enemy", ("enemy", False): "great enemy"}
    return table[(nat, temp_friend)]


def drishti_value(aspecting, d):
    d %= 360.0
    if d < 30:
        v = 0.0
    elif d < 60:
        v = (d - 30.0) / 2.0
    elif d < 90:
        v = d - 60.0 + 15.0
    elif d < 120:
        v = (120.0 - d) / 2.0 + 30.0
    elif d < 150:
        v = 150.0 - d
    elif d < 180:
        v = (d - 150.0) * 2.0
    elif d < 300:
        v = (300.0 - d) / 2.0
    else:
        v = 0.0
    if aspecting == "Mars" and (90 <= d < 120 or 210 <= d < 240):
        v += 15.0
    elif aspecting == "Jupiter" and (120 <= d < 150 or 240 <= d < 270):
        v += 30.0
    elif aspecting == "Saturn" and (60 <= d < 90 or 270 <= d < 300):
        v += 45.0
    return v


def compute(ch):
    """ch: dict with keys
    lons, trop, lats, speeds   {planet: deg}
    lagna, mc                  sidereal deg
    houses_sripati             {planet: 1..12}
    sun_hour_angle             deg (-180..180, 0 = upper culmination)
    birth, sunrise, sunset, next_sunrise, prev_sunset  (UTC JD)
    weekday                    Hindu weekday (0 = Sunday)
    civil_jdn                  JDN of the Hindu day of birth
    obliquity                  deg; ayan_mean deg; jd_tt
    """
    L = ch["lons"]
    signs = {p: int(L[p] // 30.0) % 12 for p in T.GRAHAS}
    elong = (L["Moon"] - L["Sun"]) % 360.0
    x = elong if elong <= 180.0 else 360.0 - elong
    mercury_malefic = any(signs["Mercury"] == signs[m] for m in ("Sun", "Mars", "Saturn"))
    benefic = {"Jupiter": True, "Venus": True, "Mercury": not mercury_malefic,
               "Moon": elong <= 180.0, "Sun": False, "Mars": False, "Saturn": False}
    res = {}

    # ---------------- Sthana ----------------
    for p in SEVEN:
        lon = L[p]
        ex_sign, ex_deg = T.EXALTATION[p]
        deb = (ex_sign * 30.0 + ex_deg + 180.0) % 360.0
        uchcha = abs(_wrap180(lon - deb)) / 3.0
        sapta = {}
        for n in (1, 2, 3, 7, 9, 12, 30):
            v = varga(n, lon)
            s = v["sign_index"] - 1
            lord = T.RASHI_LORD[s]
            mt = T.MOOLATRIKONA[p]
            if n == 1 and s == mt[0] and mt[1] <= lon % 30.0 < mt[2]:
                val, rel = 45.0, "moolatrikona"
            elif s in T.OWN_SIGNS[p]:
                val, rel = 30.0, "own"
            else:
                rel = compound_relation(p, lord, signs)
                val = COMPOUND_VALUE[rel]
            sapta["D%d" % n] = {"sign": T.RASHIS[s], "relation": rel, "value": val}
        sapta_total = sum(v["value"] for v in sapta.values())
        nav_sign = varga(9, lon)["sign_index"] - 1
        even_pref = p in ("Moon", "Venus")
        oja = 0.0
        for s in (signs[p], nav_sign):
            is_even = s % 2 == 1
            if is_even == even_pref:
                oja += 15.0
        h = ch["houses_sripati"][p]
        kendradi = 60.0 if h in (1, 4, 7, 10) else (30.0 if h in (2, 5, 8, 11) else 15.0)
        part = int((lon % 30.0) // 10.0)
        want = 0 if p in ("Sun", "Mars", "Jupiter") else (1 if p in ("Mercury", "Saturn") else 2)
        drek = 15.0 if part == want else 0.0
        res[p] = {"sthana": {"uchcha": uchcha, "saptavargaja": sapta_total, "ojayugma": oja,
                             "kendradi": kendradi, "drekkana": drek},
                  "saptavarga_detail": sapta}

    # ---------------- Dig ----------------
    asc, mc = ch["lagna"], ch["mc"]
    weak = {"Sun": mc + 180.0, "Mars": mc + 180.0, "Jupiter": asc + 180.0,
            "Mercury": asc + 180.0, "Moon": mc, "Venus": mc, "Saturn": asc}
    for p in SEVEN:
        res[p]["dig"] = abs(_wrap180(L[p] - weak[p])) / 3.0

    # ---------------- Kala ----------------
    H = ch["sun_hour_angle"]
    from_midnight = 180.0 - abs(H)
    birth, sr, ss, nsr, pss = (ch["birth"], ch["sunrise"], ch["sunset"], ch["next_sunrise"],
                               ch["prev_sunset"])
    part, start, end = day_part(birth, (sr, ss, nsr, pss), H)
    third = int(min(2, (birth - start) / ((end - start) / 3.0)))
    tri_lord = (("Mercury", "Sun", "Saturn") if part == "day" else ("Moon", "Venus", "Mars"))[third]
    A = ch["civil_jdn"] - KALI_EPOCH_JDN
    abda_lord = T.VARA_LORD[(5 + (A // 360) * 360) % 7]
    masa_lord = T.VARA_LORD[(5 + (A // 30) * 30) % 7]
    vara_lord = T.VARA_LORD[ch["weekday"]]
    hora_n = int(math.floor((birth - sr) * 24.0)) if (sr is not None and birth >= sr) else 0
    if sr is not None and birth < sr and pss is not None:
        hora_n = int(math.floor((birth - (sr - 1.0)) * 24.0)) % 24
    hora_lord = CHALDEAN[(CHALDEAN.index(vara_lord) + hora_n) % 7]
    eps = ch["obliquity"] * DEG2RAD
    for p in SEVEN:
        nat = from_midnight / 3.0 if p in ("Sun", "Jupiter", "Venus") else (
            abs(H) / 3.0 if p in ("Moon", "Mars", "Saturn") else 60.0)
        if p == "Moon":
            paksha = 2.0 * x / 3.0
        else:
            paksha = x / 3.0 if benefic[p] else 60.0 - x / 3.0
        tri = 60.0 if (p == "Jupiter" or p == tri_lord) else 0.0
        lords = (15.0 if p == abda_lord else 0.0) + (30.0 if p == masa_lord else 0.0) + \
                (45.0 if p == vara_lord else 0.0) + (60.0 if p == hora_lord else 0.0)
        dec = math.asin(math.sin(eps) * math.sin(ch["trop"][p] * DEG2RAD)) * RAD2DEG
        if p in ("Sun", "Mars", "Jupiter", "Venus"):
            ay = (24.0 + dec) / 48.0 * 60.0
        elif p in ("Moon", "Saturn"):
            ay = (24.0 - dec) / 48.0 * 60.0
        else:
            ay = (24.0 + abs(dec)) / 48.0 * 60.0
        if p == "Sun":
            ay *= 2.0
        res[p]["kala"] = {"nathonnatha": nat, "paksha": paksha, "tribhaga": tri,
                          "abda_masa_vara_hora": lords, "ayana": ay, "yuddha": 0.0}
        res[p]["declination"] = dec
    kala_info = {"day_birth": part == "day", "tribhaga_lord": tri_lord, "abda_lord": abda_lord,
                 "masa_lord": masa_lord, "vara_lord": vara_lord, "hora_lord": hora_lord,
                 "ahargana": A, "sun_hour_angle": H}

    # ---------------- Cheshta ----------------
    t = (ch["jd_tt"] - 2451545.0) / 36525.0
    mean = {k: (a + b * t) % 360.0 - ch["ayan_mean"] for k, (a, b) in MEAN_HELIO.items()}
    mean_sun = (mean["Earth"] + 180.0) % 360.0
    for p in SEVEN:
        if p == "Sun":
            ce = res[p]["kala"]["ayana"]
        elif p == "Moon":
            ce = x / 3.0
        else:
            if p in ("Mars", "Jupiter", "Saturn"):
                madhya, seeghra = mean[p], mean_sun
            else:
                madhya, seeghra = mean_sun, mean[p]
            avg = madhya + _wrap180(L[p] - madhya) / 2.0
            ck = (seeghra - avg) % 360.0
            if ck > 180.0:
                ck = 360.0 - ck
            ce = ck / 3.0
        res[p]["cheshta"] = ce

    # ---------------- Naisargika ----------------
    for p in SEVEN:
        res[p]["naisargika"] = T.NATURAL_STRENGTH[p]

    # ---------------- Drik ----------------
    for p in SEVEN:
        tot = 0.0
        detail = {}
        for q in SEVEN:
            if q == p:
                continue
            v = drishti_value(q, L[p] - L[q])
            if v:
                detail[q] = round(v if benefic[q] else -v, 2)
            tot += v if benefic[q] else -v
        res[p]["drik"] = tot / 4.0
        res[p]["drik_detail"] = detail

    # ---------------- Yuddha ----------------
    war = ["Mars", "Mercury", "Jupiter", "Venus", "Saturn"]
    wars = []
    for i, a in enumerate(war):
        for b in war[i + 1:]:
            if abs(_wrap180(L[a] - L[b])) < 1.0:
                def part(p):
                    return sum(res[p]["sthana"].values()) + res[p]["dig"] + sum(
                        v for k, v in res[p]["kala"].items() if k != "yuddha")
                winner, loser = (a, b) if ch["lats"][a] >= ch["lats"][b] else (b, a)
                diff = abs(part(a) - part(b))
                res[winner]["kala"]["yuddha"] += diff
                res[loser]["kala"]["yuddha"] -= diff
                wars.append({"winner": winner, "loser": loser, "value": diff})

    out = {}
    for p in SEVEN:
        r = res[p]
        sth = sum(r["sthana"].values())
        kal = sum(r["kala"].values())
        total = sth + r["dig"] + kal + r["cheshta"] + r["naisargika"] + r["drik"]
        out[p] = {
            "sthana": sth, "sthana_parts": r["sthana"], "saptavarga": r["saptavarga_detail"],
            "dig": r["dig"], "kala": kal, "kala_parts": r["kala"], "cheshta": r["cheshta"],
            "naisargika": r["naisargika"], "drik": r["drik"], "drik_detail": r["drik_detail"],
            "total_virupas": total, "total_rupas": total / 60.0,
            "required_rupas": REQUIRED[p] / 60.0, "ratio": total / REQUIRED[p],
        }
    ranking = sorted(SEVEN, key=lambda p: -out[p]["ratio"])
    return {"planets": out, "ranking": ranking, "kala_info": kala_info, "wars": wars,
            "profile": PROFILE}
