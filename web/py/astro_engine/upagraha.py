"""Upagrahas (special points).

Sun-based chain (BPHS ch. 3): Dhuma = Sun + 133deg20', Vyatipata = 360 - Dhuma,
Parivesha = Vyatipata + 180, Indrachapa = 360 - Parivesha,
Upaketu = Indrachapa + 16deg40' (= Sun - 30).

Time-based (Kalavelas): the day (or night) is cut into 8 equal parts ruled
from the weekday lord (night: from the lord of the 5th weekday); the 8th
part has no lord.  Each upagraha is the sidereal lagna rising at the START
of its lord's part (Gulika at the start of Saturn's part).  Mandi is given
at the MIDDLE of Saturn's part (Phaladeepika / Kerala usage) as a separate
profile so the two are never silently merged.
"""
from . import tables as T
from .chart import ascendant_tropical, nakshatra_info, norm360, rashi_info
from .timescale import Instant

KALAVELA = {"Sun": "Kala", "Mars": "Mrityu", "Mercury": "Ardhaprahara",
            "Jupiter": "Yamaghantaka", "Saturn": "Gulika"}
ORDER = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"]


def sun_chain(sun_sid):
    dhuma = norm360(sun_sid + 133.0 + 20.0 / 60.0)
    vyat = norm360(360.0 - dhuma)
    pari = norm360(vyat + 180.0)
    indra = norm360(360.0 - pari)
    upak = norm360(indra + 16.0 + 40.0 / 60.0)
    return {"Dhuma": dhuma, "Vyatipata": vyat, "Parivesha": pari, "Indrachapa": indra,
            "Upaketu": upak}


def _lagna_at(ctx, t, lat, lon):
    inst = Instant.from_utc_jd(t)
    o = ctx.orient(inst)
    return norm360(ascendant_tropical(o, lat, lon)[0] - o.ayan_true)


def kalavelas(ctx, birth_jd, sunrise, sunset, next_sunrise, prev_sunset, weekday, lat, lon,
              fmt):
    """weekday = lord index (0=Sun) of the Hindu day containing the birth."""
    if sunrise is not None and sunset is not None and sunrise <= birth_jd < sunset:
        start, length, first_lord, part = sunrise, sunset - sunrise, weekday, "day"
    elif sunset is not None and next_sunrise is not None and birth_jd >= sunset:
        start, length, first_lord, part = sunset, next_sunrise - sunset, (weekday + 4) % 7, "night"
    else:
        start, length, first_lord, part = prev_sunset, sunrise - prev_sunset, (weekday + 4) % 7, "night"
    seg = length / 8.0
    out = {}
    lords = [T.VARA_LORD[(first_lord + i) % 7] for i in range(7)]
    for i, lord in enumerate(lords):
        if lord in KALAVELA:
            t = start + i * seg
            out[KALAVELA[lord]] = {"longitude": _lagna_at(ctx, t, lat, lon), "time": fmt(t),
                                   "segment": i + 1, "rule": "lagna at start of %s's part" % lord}
        if lord == "Saturn":
            t = start + (i + 0.5) * seg
            out["Mandi"] = {"longitude": _lagna_at(ctx, t, lat, lon), "time": fmt(t),
                            "segment": i + 1, "rule": "lagna at middle of Saturn's part"}
    return part, out


def compute(ctx, chart, birth_jd, sun_times, weekday, lat, lon, fmt):
    sun = chart["grahas"]["Sun"]["longitude"]
    asc_sign = int(chart["lagna"]["longitude"] // 30.0)
    pts = {}
    for k, v in sun_chain(sun).items():
        pts[k] = {"longitude": v, "rule": "Sun-based (BPHS)"}
    sunrise, sunset, next_sunrise, prev_sunset = sun_times
    part, kv = kalavelas(ctx, birth_jd, sunrise, sunset, next_sunrise, prev_sunset, weekday,
                         lat, lon, fmt)
    pts.update(kv)
    for k, v in pts.items():
        lon_ = v["longitude"]
        v["rashi"] = rashi_info(lon_)
        v["nakshatra"] = nakshatra_info(lon_)
        v["house_whole_sign"] = (int(lon_ // 30.0) - asc_sign) % 12 + 1
    return {"birth_in": part, "points": pts}
