"""Panchanga: tithi, nakshatra, yoga, karana, vara with exact boundaries,
sunrise/sunset/moonrise/moonset, muhurta windows, lunar month,
sankranti and samvatsara.
"""
import math

from . import tables as T
from .chart import ChartContext, norm360
from .constants import (DEG2RAD, MOON_RADIUS_KM, NAKSHATRA_SPAN, PADA_SPAN, RAD2DEG,
                        SUN_RADIUS_KM, AU_KM)
from .positions import apparent_gcrs, equatorial_of_date
from .rootfind import angle_crossing, secant_crossing, solve
from .timescale import Instant, calendar, format_jd, julian_day

REFRACTION_DEG = 34.0 / 60.0
SUNRISE_PROFILES = {
    "upper_limb_refraction": "upper limb touches horizon, 34' refraction",
    "center_refraction": "disc centre on horizon, 34' refraction",
    "center_geometric": "disc centre on geometric horizon, no refraction",
}
RAHU_SEGMENT = [8, 2, 7, 5, 6, 4, 3]
YAMAGANDA_SEGMENT = [5, 4, 3, 2, 1, 7, 6]
GULIKA_SEGMENT = [7, 6, 5, 4, 3, 2, 1]
CHALDEAN = ["Saturn", "Jupiter", "Mars", "Sun", "Venus", "Mercury", "Moon"]
SYNODIC_RATE = 360.0 / 29.530589
SOLAR_RATE = 0.9856474
# mean rates (deg/day) used only to seed the secant solver
RATES = {"elongation": SYNODIC_RATE, "moon_sid": 13.176358,
         "yoga_angle": 13.176358 + SOLAR_RATE, "sun_sid": SOLAR_RATE}


def karana_name(k):
    """k = 0..59 half-tithi index from the New Moon."""
    if k == 0:
        return "Kimstughna"
    if k >= 57:
        return ("Shakuni", "Chatushpada", "Naga")[k - 57]
    return T.KARANA_MOVABLE[(k - 1) % 7]


def tithi_name(i):
    """i = 0..29."""
    if i == 14:
        return "Purnima"
    if i == 29:
        return "Amavasya"
    return T.TITHIS[i % 15]


class Engine(object):
    def __init__(self, ayanamsa_model="lahiri", ctx=None):
        self.ctx = ctx or ChartContext(ayanamsa_model)
        self._sm = {}

    # ---- base angles (functions of UTC Julian Date) ----
    def sun_moon(self, jd):
        key = round(jd * 864000.0)
        v = self._sm.get(key)
        if v is None:
            if len(self._sm) > 5000:
                self._sm.clear()
            inst = Instant.from_utc_jd(jd)
            o = self.ctx.orient(inst)
            s = self.ctx.tropical("sun", inst)[0]
            m = self.ctx.tropical("moon", inst)[0]
            v = (s, m, o.ayan_true)
            self._sm[key] = v
        return v

    def elongation(self, jd):
        s, m, _ = self.sun_moon(jd)
        return norm360(m - s)

    def moon_sid(self, jd):
        _, m, a = self.sun_moon(jd)
        return norm360(m - a)

    def sun_sid(self, jd):
        s, _, a = self.sun_moon(jd)
        return norm360(s - a)

    def yoga_angle(self, jd):
        s, m, a = self.sun_moon(jd)
        return norm360(s + m - 2.0 * a)

    # ---- generic interval search ----
    def crossing(self, func, target, guess, rate, after=None, before=None, step=0.25):
        """Boundary time near `guess`; secant first, bracketing fallback."""
        t = secant_crossing(func, target, guess, rate)
        ok = t is not None
        if ok and after is not None and t < after - 1e-7:
            ok = False
        if ok and before is not None and t > before + 1e-7:
            ok = False
        if ok:
            return t
        if after is not None:
            return angle_crossing(func, target, after, step, direction=1)
        return angle_crossing(func, target, before, step, direction=-1)

    def interval(self, func, span, jd, step, rate=None):
        rate = rate or RATES.get(func.__name__, 12.19)
        q = func(jd)
        idx = int(q // span)
        lo = idx * span
        hi = ((idx + 1) * span) % 360.0
        start = self.crossing(func, lo, jd - (q - lo) / rate, rate, before=jd, step=step)
        end = self.crossing(func, hi, jd + ((idx + 1) * span - q) / rate, rate, after=jd,
                            step=step)
        return idx, start, end

    def intervals_between(self, func, span, t0, t1, step, count):
        rate = RATES.get(func.__name__, 12.19)
        out = []
        idx, start, end = self.interval(func, span, t0, step, rate)
        out.append((idx, start, end))
        guard = 0
        while end is not None and end < t1 and guard < 6:
            nxt = (idx + 1) % count
            target = ((nxt + 1) * span) % 360.0
            new_end = self.crossing(func, target, end + span / rate, rate, after=end + 1e-6,
                                    step=step)
            out.append((nxt, end, new_end))
            idx, end = nxt, new_end
            guard += 1
        return out

    # ---- horizon events ----
    def altitude(self, body, jd, site):
        inst = Instant.from_utc_jd(jd)
        o = self.ctx.orient(inst)
        vec = apparent_gcrs(body, inst, o, site=site)
        ra, dec, dist = equatorial_of_date(vec, o)
        last = (o.gast_hours * 15.0 + site[1]) % 360.0
        ha = (last - ra) * DEG2RAD
        phi = site[0] * DEG2RAD
        d = dec * DEG2RAD
        alt = math.asin(math.sin(phi) * math.sin(d) + math.cos(phi) * math.cos(d) * math.cos(ha))
        return alt * RAD2DEG, dist * AU_KM

    def threshold(self, body, dist_km, profile):
        radius = SUN_RADIUS_KM if body == "sun" else MOON_RADIUS_KM
        sd = math.asin(radius / dist_km) * RAD2DEG
        if profile == "center_geometric":
            return 0.0
        if profile == "center_refraction":
            return -REFRACTION_DEG
        return -REFRACTION_DEG - sd

    def horizon_events(self, body, jd0, jd1, site, profile, step=1.0 / 12.0):
        """All rise/set crossings in [jd0, jd1)."""
        def f(jd):
            alt, dist = self.altitude(body, jd, site)
            return alt - self.threshold(body, dist, profile)

        events = []
        t = jd0
        ft = f(t)
        while t < jd1:
            t2 = min(t + step, jd1)
            f2 = f(t2)
            if ft < 0.0 <= f2 or ft >= 0.0 > f2:
                root = solve(f, t, t2, ft, f2)
                events.append(("rise" if ft < 0.0 else "set", root))
            t, ft = t2, f2
        return events

    def first_event(self, body, kind, jd0, site, profile, span=1.0):
        for k, t in self.horizon_events(body, jd0, jd0 + span, site, profile):
            if k == kind:
                return t
        return None

    # ---- lunar month / year ----
    def new_moon_before(self, jd):
        e = self.elongation(jd)
        return self.crossing(self.elongation, 0.0, jd - e / SYNODIC_RATE, SYNODIC_RATE,
                             before=jd, step=1.0)

    def new_moon_after(self, jd):
        e = self.elongation(jd)
        return self.crossing(self.elongation, 0.0, jd + (360.0 - e) / SYNODIC_RATE,
                             SYNODIC_RATE, after=jd, step=1.0)

    def lunar_month(self, jd):
        start = self.new_moon_before(jd)
        end = self.new_moon_after(jd)
        s1 = int(self.sun_sid(start) // 30.0)
        s2 = int(self.sun_sid(end) // 30.0)
        name = T.LUNAR_MONTH_BY_SUN_SIGN[s1]
        return {
            "name": name,
            "adhika": s1 == s2,
            "kshaya_follows": (s2 - s1) % 12 == 2,
            "start_jd": start,
            "end_jd": end,
            "sun_sign_at_start": T.RASHIS[s1],
            "sun_sign_at_end": T.RASHIS[s2],
            "ritu": T.RITU_BY_MONTH[name],
        }

    def year_start(self, jd):
        """Start of the Chandramana year (first New Moon with the Sun in Meena)."""
        start = self.new_moon_before(jd)
        found = None
        for _ in range(14):
            s = int(self.sun_sid(start) // 30.0)
            if s == 11:
                found = start
            elif found is not None:
                return found
            start = self.new_moon_before(start - 0.01)
        return found

    def sankranti(self, jd, direction):
        sid = self.sun_sid(jd)
        k = int(sid // 30.0)
        if direction == 1:
            target = ((k + 1) * 30.0) % 360.0
            guess = jd + ((k + 1) * 30.0 - sid) / SOLAR_RATE
            t = self.crossing(self.sun_sid, target, guess, SOLAR_RATE, after=jd, step=2.0)
        else:
            target = k * 30.0
            guess = jd - (sid - target) / SOLAR_RATE
            t = self.crossing(self.sun_sid, target, guess, SOLAR_RATE, before=jd, step=2.0)
        return t, T.RASHIS[int(round(target / 30.0)) % 12]


def _local(jd, tz_min):
    return None if jd is None else format_jd(jd + tz_min / 1440.0)


def _windows(start, length, count):
    seg = length / count
    return [(start + i * seg, start + (i + 1) * seg) for i in range(count)], seg


def compute_panchanga(year, month, day, lat, lon, elev=0.0, tz_minutes=330,
                      ayanamsa_model="lahiri", sunrise_profile="upper_limb_refraction",
                      engine=None):
    eng = engine or Engine(ayanamsa_model)
    site = (lat, lon, elev)
    local_midnight = julian_day(year, month, day) - tz_minutes / 1440.0
    sunrise = eng.first_event("sun", "rise", local_midnight, site, sunrise_profile)
    sunset = eng.first_event("sun", "set", sunrise or local_midnight, site, sunrise_profile)
    next_sunrise = eng.first_event("sun", "rise", local_midnight + 1.0, site, sunrise_profile)
    moon_events = eng.horizon_events("moon", local_midnight, local_midnight + 1.0, site,
                                     sunrise_profile)
    moonrise = next((t for k, t in moon_events if k == "rise"), None)
    moonset = next((t for k, t in moon_events if k == "set"), None)

    ref = sunrise if sunrise is not None else local_midnight + 0.25
    day_end = next_sunrise if next_sunrise is not None else ref + 1.0

    def fmt_intervals(items, namer):
        return [{"index": i + 1, "name": namer(i), "start": _local(a, tz_minutes),
                 "end": _local(b, tz_minutes), "start_jd": a, "end_jd": b}
                for i, a, b in items]

    tithis = eng.intervals_between(eng.elongation, 12.0, ref, day_end, 0.25, 30)
    naks = eng.intervals_between(eng.moon_sid, NAKSHATRA_SPAN, ref, day_end, 0.25, 27)
    yogas = eng.intervals_between(eng.yoga_angle, NAKSHATRA_SPAN, ref, day_end, 0.25, 27)
    karanas = eng.intervals_between(eng.elongation, 6.0, ref, day_end, 0.125, 60)

    tithi_list = fmt_intervals(tithis, tithi_name)
    for t in tithi_list:
        t["paksha"] = "Shukla" if t["index"] <= 15 else "Krishna"
    nak_list = fmt_intervals(naks, lambda i: T.NAKSHATRAS[i])
    for n in nak_list:
        n["lord"] = T.nakshatra_lord(n["index"] - 1)
    yoga_list = fmt_intervals(yogas, lambda i: T.YOGAS[i])
    karana_list = fmt_intervals(karanas, karana_name)
    from . import namakshara
    padas = eng.intervals_between(eng.moon_sid, PADA_SPAN, ref, day_end, 0.25, 108)
    nama_list = namakshara.day_list(padas, lambda j: _local(j, tz_minutes))

    # weekday of the civil date (the Hindu day runs sunrise to sunrise)
    weekday = int(math.floor(julian_day(year, month, day) + 0.5) + 1) % 7

    lm = eng.lunar_month(ref)
    ys = eng.year_start(ref)
    ys_year = calendar(ys + tz_minutes / 1440.0)[0] if ys else year
    shaka = ys_year - 78
    samvatsara = T.SAMVATSARAS[(shaka + 11) % 60]
    sun_sid = eng.sun_sid(ref)
    moon_sid = eng.moon_sid(ref)
    prev_sk, prev_sk_sign = eng.sankranti(ref, -1)
    next_sk, next_sk_sign = eng.sankranti(ref, 1)

    muhurta = None
    if sunrise is not None and sunset is not None and next_sunrise is not None:
        day_len = sunset - sunrise
        night_len = next_sunrise - sunset
        eighths, _ = _windows(sunrise, day_len, 8)

        def pick(table):
            a, b = eighths[table[weekday] - 1]
            return {"start": _local(a, tz_minutes), "end": _local(b, tz_minutes)}

        day_muh = day_len / 15.0
        night_muh = night_len / 15.0
        horas = []
        lord_i = CHALDEAN.index(T.VARA_LORD[weekday])
        for i in range(24):
            if i < 12:
                a = sunrise + i * day_len / 12.0
                b = a + day_len / 12.0
            else:
                a = sunset + (i - 12) * night_len / 12.0
                b = a + night_len / 12.0
            horas.append({"lord": CHALDEAN[(lord_i + i) % 7], "start": _local(a, tz_minutes),
                          "end": _local(b, tz_minutes), "day": i < 12})
        muhurta = {
            "day_length_hours": day_len * 24.0,
            "night_length_hours": night_len * 24.0,
            "rahu_kala": pick(RAHU_SEGMENT),
            "yamaganda": pick(YAMAGANDA_SEGMENT),
            "gulika_kala": pick(GULIKA_SEGMENT),
            "abhijit": {"start": _local(sunrise + 7 * day_muh, tz_minutes),
                        "end": _local(sunrise + 8 * day_muh, tz_minutes)},
            "brahma_muhurta": {"start": _local(next_sunrise - 2 * night_muh, tz_minutes),
                               "end": _local(next_sunrise - night_muh, tz_minutes)},
            "madhyahna": _local(sunrise + day_len / 2.0, tz_minutes),
            "nishitha": _local(sunset + night_len / 2.0, tz_minutes),
            "pradosha": {"start": _local(sunset, tz_minutes),
                         "end": _local(sunset + 3 * night_muh, tz_minutes),
                         "rule": "3 night muhurtas after sunset"},
            "horas": horas,
        }
        from . import muhurta as MU

        def span(a, b, **kw):
            d = {"start": _local(a, tz_minutes), "end": _local(b, tz_minutes)}
            d.update(kw)
            return d
        muhurta["durmuhurta"] = [span(a, b) for a, b in MU.durmuhurtas(sunrise, sunset,
                                                                         next_sunrise, weekday)]
        varj, amr = [], []
        prev_naks = eng.interval(eng.moon_sid, NAKSHATRA_SPAN, ref - 1.0, 0.25)
        nak_spans = [(prev_naks[0], prev_naks[1], prev_naks[2])] + list(naks)
        seen = set()
        for k, a, b in nak_spans:
            if a is None or b is None or (k, round(a, 5)) in seen:
                continue
            seen.add((k, round(a, 5)))
            for table, dest in ((MU.VARJYAM_GHATI, varj), (MU.AMRITA_GHATI, amr)):
                w = MU.nak_windows(table, k, a, b)
                if w and w[1] > ref and w[0] < day_end:
                    dest.append(span(w[0], w[1], nakshatra=T.NAKSHATRAS[k]))
        muhurta["varjyam"] = varj
        muhurta["amrita_kala"] = amr
        muhurta["choghadiya"] = [dict(c, start=_local(c["start"], tz_minutes),
                                      end=_local(c["end"], tz_minutes))
                                 for c in MU.choghadiya(sunrise, sunset, next_sunrise, weekday)]

    return {
        "date": "%04d-%02d-%02d" % (year, month, day),
        "location": {"lat": lat, "lon": lon, "elevation_m": elev},
        "tz_minutes": tz_minutes,
        "sunrise_profile": sunrise_profile,
        "sunrise": _local(sunrise, tz_minutes),
        "sunset": _local(sunset, tz_minutes),
        "next_sunrise": _local(next_sunrise, tz_minutes),
        "moonrise": _local(moonrise, tz_minutes),
        "moonset": _local(moonset, tz_minutes),
        "vara": {"index": weekday, "name": T.VARAS[weekday], "lord": T.VARA_LORD[weekday]},
        "tithi": tithi_list,
        "nakshatra": nak_list,
        "yoga": yoga_list,
        "karana": karana_list,
        "namakshara": nama_list,
        "sun_sidereal_at_sunrise": sun_sid,
        "moon_sidereal_at_sunrise": moon_sid,
        "surya_rashi": T.RASHIS[int(sun_sid // 30.0)],
        "chandra_rashi": T.RASHIS[int(moon_sid // 30.0)],
        "ayana": "Uttarayana" if int(sun_sid // 30.0) in (9, 10, 11, 0, 1, 2) else "Dakshinayana",
        "lunar_month": {
            "name": lm["name"], "adhika": lm["adhika"], "ritu": lm["ritu"],
            "system": "Amanta",
            "start": _local(lm["start_jd"], tz_minutes), "end": _local(lm["end_jd"], tz_minutes),
            "paksha": tithi_list[0]["paksha"],
        },
        "year": {"shaka": shaka, "samvatsara": samvatsara,
                 "year_start_new_moon": _local(ys, tz_minutes)},
        "sankranti": {
            "previous": {"rashi": prev_sk_sign, "time": _local(prev_sk, tz_minutes)},
            "next": {"rashi": next_sk_sign, "time": _local(next_sk, tz_minutes)},
        },
        "muhurta": muhurta,
    }
