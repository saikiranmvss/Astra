"""Public entry points. Inputs and outputs are plain JSON-compatible dicts."""
import math
import time

from . import ENGINE_VERSION
from . import ashtakavarga, dasha, jaimini, vargas
from . import tables as T
from .chart import ChartContext, compute_chart, sign_of
from .constants import NAKSHATRA_SPAN
from .panchanga import Engine, compute_panchanga, karana_name, tithi_name
from .sidereal import LABELS
from .timescale import Instant, calendar, format_jd, julian_day

REPRODUCIBILITY = {
    "ephemeris": "JPL DE440s (Chebyshev records, unmodified)",
    "precession": "IAU 2006 (Capitaine et al. 2003)",
    "nutation": "IAU 2000A (1365 terms)",
    "frame": "ICRS -> frame bias -> true equator/ecliptic of date",
    "apparent": "light-time, solar light deflection, relativistic aberration",
    "time_scales": "UTC -> TAI (leap seconds) -> TT; UT1 = UTC from 1972; "
                   "Delta T polynomials (Espenak-Meeus) before 1972",
    "sidereal_time": "IAU 2006 GMST from Earth Rotation Angle + equation of equinoxes",
    "earth_model": "IERS 2010 ellipsoid",
}


def _parse_date(s):
    y, m, d = (int(x) for x in s.split("-"))
    return y, m, d


def _parse_time(s):
    parts = [float(x) for x in s.split(":")]
    while len(parts) < 3:
        parts.append(0.0)
    return parts


def _birth_panchanga(eng, jd, site, tz, profile):
    e = eng.elongation(jd)
    ti = int(e // 12.0)
    ki = int(e // 6.0)
    ms = eng.moon_sid(jd)
    ys = eng.yoga_angle(jd)
    y, mo, d = calendar(jd + tz / 1440.0)[:3]
    midnight = julian_day(y, mo, d) - tz / 1440.0
    sunrise = eng.first_event("sun", "rise", midnight, site, profile)
    civil_wd = int(math.floor(julian_day(y, mo, d) + 0.5) + 1) % 7
    wd = civil_wd if (sunrise is None or jd >= sunrise) else (civil_wd - 1) % 7
    tithi_iv = eng.interval(eng.elongation, 12.0, jd, 0.25)
    nak_iv = eng.interval(eng.moon_sid, NAKSHATRA_SPAN, jd, 0.25)
    return {
        "tithi": {"index": ti + 1, "name": tithi_name(ti),
                  "paksha": "Shukla" if ti < 15 else "Krishna",
                  "start": format_jd(tithi_iv[1] + tz / 1440.0),
                  "end": format_jd(tithi_iv[2] + tz / 1440.0),
                  "elongation": e},
        "nakshatra": {"index": int(ms // NAKSHATRA_SPAN) + 1,
                      "name": T.NAKSHATRAS[int(ms // NAKSHATRA_SPAN)],
                      "start": format_jd(nak_iv[1] + tz / 1440.0),
                      "end": format_jd(nak_iv[2] + tz / 1440.0)},
        "yoga": {"index": int(ys // NAKSHATRA_SPAN) + 1,
                 "name": T.YOGAS[int(ys // NAKSHATRA_SPAN)]},
        "karana": {"index": ki + 1, "name": karana_name(ki)},
        "vara": {"name": T.VARAS[wd], "lord": T.VARA_LORD[wd],
                 "rule": "Hindu day begins at local sunrise"},
        "sunrise_on_birth_date": format_jd(sunrise + tz / 1440.0) if sunrise else None,
        "lunar_month": None,
    }


def birth_chart(p):
    t_start = time.time()
    y, m, d = _parse_date(p["date"])
    hh, mm, ss = _parse_time(p.get("time", "12:00"))
    tz = float(p.get("tz_minutes", 330))
    lat = float(p["lat"])
    lon = float(p["lon"])
    elev = float(p.get("elevation", 0.0))
    model = p.get("ayanamsa", "lahiri")
    node = p.get("node", "true")
    year_profile = p.get("dasha_year", "julian")
    levels = int(p.get("dasha_levels", 3))
    profile = p.get("sunrise_profile", "upper_limb_refraction")

    jd_utc = julian_day(y, m, d, hh, mm, ss) - tz / 1440.0
    inst = Instant.from_utc_jd(jd_utc)
    ctx = ChartContext(model)
    chart = compute_chart(inst, lat, lon, elev, model, node, ctx=ctx)

    sid = {k: g["longitude"] for k, g in chart["grahas"].items()}
    sid_points = dict((k, sid[k]) for k in T.GRAHAS)
    sid_points["Lagna"] = chart["lagna"]["longitude"]

    now_jd = p.get("now_jd_utc")
    if now_jd is None:
        now_jd = time.time() / 86400.0 + 2440587.5
    dashas = dasha.vimshottari(sid["Moon"], jd_utc, year=year_profile, levels=levels,
                               tz_minutes=tz, now_jd_utc=now_jd)

    signs = {k: sign_of(sid[k]) for k in T.SEVEN}
    signs["Lagna"] = sign_of(sid_points["Lagna"])
    av = ashtakavarga.compute(signs)

    planet_signs = {k: sign_of(sid[k]) for k in T.GRAHAS}
    jm = {
        "chara_karakas_8": jaimini.chara_karakas(sid, 8),
        "chara_karakas_7": jaimini.chara_karakas(sid, 7),
        "arudha_padas": jaimini.arudha_padas(signs["Lagna"], planet_signs),
        "rashi_drishti": jaimini.rashi_drishti(),
    }

    eng = Engine(model, ctx=ctx)
    site = (lat, lon, elev)
    bp = _birth_panchanga(eng, jd_utc, site, tz, profile)
    lm = eng.lunar_month(jd_utc)
    bp["lunar_month"] = {"name": lm["name"], "adhika": lm["adhika"], "system": "Amanta"}

    # sun times around the birth (Hindu day runs sunrise to sunrise)
    ly, lmo, ld = calendar(jd_utc + tz / 1440.0)[:3]
    midnight = julian_day(ly, lmo, ld) - tz / 1440.0
    sr = eng.first_event("sun", "rise", midnight, site, profile)
    ss = eng.first_event("sun", "set", sr or midnight, site, profile)
    nsr = eng.first_event("sun", "rise", midnight + 1.0, site, profile)
    pss = eng.first_event("sun", "set", midnight - 1.0, site, profile)
    civil_wd = int(math.floor(julian_day(ly, lmo, ld) + 0.5) + 1) % 7
    before_sunrise = sr is not None and jd_utc < sr
    hindu_wd = (civil_wd - 1) % 7 if before_sunrise else civil_wd
    civil_jdn = int(math.floor(julian_day(ly, lmo, ld) + 0.5)) - (1 if before_sunrise else 0)
    fmt_local = lambda j: format_jd(j + tz / 1440.0) if j is not None else None

    from . import chara_dasha, shadbala, upagraha, yogas
    from .positions import apparent_gcrs, equatorial_of_date
    o = ctx.orient(inst)
    ra = equatorial_of_date(apparent_gcrs("sun", inst, o), o)[0]
    sun_ha = ((o.gast_hours * 15.0 + lon - ra) + 180.0) % 360.0 - 180.0
    g = chart["grahas"]
    sb = shadbala.compute({
        "lons": sid, "trop": {k: g[k]["tropical_longitude"] for k in g},
        "lats": {k: g[k]["latitude"] for k in g},
        "speeds": {k: g[k]["speed_deg_per_day"] for k in g},
        "lagna": chart["lagna"]["longitude"], "mc": chart["mc"]["longitude"],
        "houses_sripati": {k: g[k]["house_sripati"] for k in g},
        "sun_hour_angle": sun_ha, "birth": jd_utc, "sunrise": sr, "sunset": ss,
        "next_sunrise": nsr, "prev_sunset": pss, "weekday": hindu_wd, "civil_jdn": civil_jdn,
        "obliquity": chart["obliquity_true"], "ayan_mean": chart["ayanamsa"]["mean"],
        "jd_tt": inst.tt,
    })
    yg = yogas.detect(sid, chart["lagna"]["longitude"],
                      {k: g[k]["speed_deg_per_day"] for k in g})
    cd = chara_dasha.compute(sign_of(chart["lagna"]["longitude"]), sid, jd_utc, tz, now_jd)
    up = upagraha.compute(ctx, chart, jd_utc, (sr, ss, nsr, pss), hindu_wd, lat, lon, fmt_local)

    return {
        "engine": "astro_engine " + ENGINE_VERSION,
        "kind": "birth_chart",
        "input": {"date": p["date"], "time": p.get("time"), "tz_minutes": tz,
                  "lat": lat, "lon": lon, "elevation": elev},
        "profile": {"ayanamsa": LABELS[model], "node": node, "houses": "whole sign + Sripati",
                    "dasha_year": year_profile, "sunrise": profile,
                    "vargas": "Parashari (BPHS)"},
        "reproducibility": REPRODUCIBILITY,
        "chart": chart,
        "vargas": vargas.all_vargas(sid_points),
        "dasha": dashas,
        "chara_dasha": cd,
        "yogini_dasha": dasha.yogini(sid["Moon"], jd_utc, year=year_profile, tz_minutes=tz, now_jd_utc=now_jd),
        "ashtottari_dasha": dasha.ashtottari(sid["Moon"], jd_utc, year=year_profile, tz_minutes=tz,
                                             now_jd_utc=now_jd),
        "ashtakavarga": av,
        "jaimini": jm,
        "shadbala": sb,
        "yogas": yg,
        "upagrahas": up,
        "birth_panchanga": bp,
        "sun_times": {"sunrise": fmt_local(sr), "sunset": fmt_local(ss),
                      "next_sunrise": fmt_local(nsr), "previous_sunset": fmt_local(pss),
                      "hindu_weekday": T.VARAS[hindu_wd]},
        "compute_seconds": round(time.time() - t_start, 3),
        "status": {
            "positions": "CALCULATED",
            "lagna": "CALCULATED",
            "vargas": "DERIVED (BPHS rules)",
            "dasha": "DERIVED",
            "chara_dasha": "DERIVED (K. N. Rao profile)",
            "ashtakavarga": "TRADITIONAL rule, raw bindus",
            "shadbala": "DERIVED (BPHS; profile listed)",
            "yogas": "TRADITIONAL rules; existence only",
            "upagrahas": "DERIVED (BPHS / Phaladeepika profiles)",
            "dignity_combustion": "TRADITIONAL",
        },
    }


def panchanga(p):
    t_start = time.time()
    y, m, d = _parse_date(p["date"])
    out = compute_panchanga(
        y, m, d, float(p["lat"]), float(p["lon"]), float(p.get("elevation", 0.0)),
        float(p.get("tz_minutes", 330)), p.get("ayanamsa", "lahiri"),
        p.get("sunrise_profile", "upper_limb_refraction"),
    )
    out["engine"] = "astro_engine " + ENGINE_VERSION
    out["kind"] = "panchanga"
    out["reproducibility"] = REPRODUCIBILITY
    out["compute_seconds"] = round(time.time() - t_start, 3)
    return out


def month_calendar(p):
    from . import festivals
    from .daycal import localize_day
    t_start = time.time()
    y, m = int(p["year"]), int(p["month"])
    ny, nm = (y + 1, 1) if m == 12 else (y, m + 1)
    last_day = int(round(julian_day(ny, nm, 1) - julian_day(y, m, 1)))
    dr, fest = festivals.festivals_for_range(p, (y, m, 1), (y, m, last_day))
    by_date = {}
    for f in fest:
        by_date.setdefault(f["date"], []).append(f)
    days = []
    prefix = "%04d-%02d-" % (y, m)
    for i, rec in enumerate(dr.days):
        if not rec["date"].startswith(prefix):
            continue
        d = localize_day(dr, rec, moon=True, i=i)
        d["festivals"] = by_date.get(rec["date"], [])
        days.append(d)
    return {"kind": "calendar", "year": y, "month": m, "days": days,
            "profile": {"months": "Amanta", "sunrise": dr.profile, "ayanamsa": dr.model},
            "compute_seconds": round(time.time() - t_start, 3)}


def upcoming(p):
    """Festivals from `start` for `days` days (default 45)."""
    from . import festivals
    t_start = time.time()
    y, m, d = (int(x) for x in p["start"].split("-"))
    days = int(p.get("days", 45))
    jd0 = julian_day(y, m, d)
    ey, em, ed = calendar(jd0 + days)[:3]
    _, fest = festivals.festivals_for_range(p, (y, m, d), (int(ey), int(em), int(ed)))
    start = "%04d-%02d-%02d" % (y, m, d)
    fest = sorted((f for f in fest if f["date"] >= start), key=lambda f: f["date"])
    return {"kind": "upcoming", "start": start, "days": days, "festivals": fest,
            "compute_seconds": round(time.time() - t_start, 3)}


def match(p):
    from . import matching
    out = {}
    for who in ("groom", "bride"):
        q = p[who]
        y, m, d = _parse_date(q["date"])
        hh, mm, ss = _parse_time(q.get("time", "12:00"))
        tz = float(q.get("tz_minutes", 330))
        inst = Instant.from_utc_jd(julian_day(y, m, d, hh, mm, ss) - tz / 1440.0)
        out[who] = {"chart": compute_chart(inst, float(q["lat"]), float(q["lon"]), 0.0,
                                           p.get("ayanamsa", "lahiri"), p.get("node", "true"))}
    r = matching.match(out["groom"], out["bride"])
    r["kind"] = "match"
    return r


def dispatch(kind, params):
    if kind == "chart":
        return birth_chart(params)
    if kind == "panchanga":
        return panchanga(params)
    if kind == "calendar":
        return month_calendar(params)
    if kind == "festivals":
        from . import festivals
        return festivals.festival_year(params)
    if kind == "search":
        from . import events
        return events.search(params)
    if kind == "transits":
        from . import transits
        return transits.compute(params)
    if kind == "match":
        return match(params)
    if kind == "muhurta":
        from . import muhurta
        return muhurta.find(params)
    if kind == "eclipses":
        from . import eclipses
        return eclipses.search(params)
    if kind == "upcoming":
        return upcoming(params)
    raise ValueError("unknown request kind: %s" % kind)
