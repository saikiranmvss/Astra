"""Civil-day panchanga over a date range (month calendar, festival engine).

Every day is anchored on its own local sunrise (Hindu day = sunrise to next
sunrise).  Element boundaries come from a Series (root-solved, ~1 s), and
sunrise/sunset are solved exactly for the observer each day.
"""
import bisect

from . import tables as T
from .constants import NAKSHATRA_SPAN
from .localtime import LocalTime, weekday
from .panchanga import (GULIKA_SEGMENT, RAHU_SEGMENT, YAMAGANDA_SEGMENT, Engine,
                        karana_name, tithi_name)
from .rootfind import solve
from .series import MonthIndex, Series, crossings
from .timescale import calendar, julian_day

ARUNODAYA_DAYS = 96.0 / 1440.0  # 4 ghatis before sunrise


class Boundaries(object):
    """Segment index as a function of time from a sorted crossing list."""

    def __init__(self, fn, span, count, a, b, scan=0.5):
        found = crossings(fn, span, a, b, scan)
        self.times = [t for t, _k, _d in found]
        self.idx = [k % count for _t, k, _d in found]
        self.first = int(fn(a) // span) % count

    def at(self, t):
        i = bisect.bisect_right(self.times, t)
        idx = self.first if i == 0 else self.idx[i - 1]
        start = self.times[i - 1] if i > 0 else None
        end = self.times[i] if i < len(self.times) else None
        return idx, start, end

    def between(self, a, b):
        out = []
        i = bisect.bisect_right(self.times, a)
        idx = self.first if i == 0 else self.idx[i - 1]
        start = self.times[i - 1] if i > 0 else None
        while True:
            end = self.times[i] if i < len(self.times) else None
            out.append((idx, start, end))
            if end is None or end >= b:
                break
            idx, start = self.idx[i], end
            i += 1
        return out

    def intervals(self):
        """Complete intervals (index, start, end)."""
        return [(self.idx[i], self.times[i], self.times[i + 1])
                for i in range(len(self.times) - 1)]


class DayRange(object):
    def __init__(self, p, first, last, model=None):
        """first/last are (y, m, d) local civil dates, inclusive."""
        self.lt = LocalTime.from_params(p)
        self.site = (float(p["lat"]), float(p["lon"]), float(p.get("elevation", 0.0)))
        self.profile = p.get("sunrise_profile", "upper_limb_refraction")
        self.model = model or p.get("ayanamsa", "lahiri")
        jd_first = julian_day(*first)
        jd_last = julian_day(*last)
        self.dates = []
        j = jd_first
        while j <= jd_last + 1e-9:
            self.dates.append(calendar(j)[:3])
            j += 1.0
        ta = self.lt.midnight(*first)
        tb = self.lt.midnight(*last) + 2.0
        pad = 35.0
        s = Series(ta - pad, tb + pad, ["Sun", "Moon"], step=1.0, model=self.model)
        self.series = s
        self.eng = Engine(self.model, ctx=s.ctx)
        self.months = MonthIndex(s, ta - pad + 1, tb + pad - 1, T.LUNAR_MONTH_BY_SUN_SIGN)
        a, b = ta - 3.0, tb + 3.0
        self.tithi = Boundaries(s.elongation, 12.0, 30, a, b)
        self.nak = Boundaries(lambda t: s.lon("Moon", t), NAKSHATRA_SPAN, 27, a, b)
        self.yoga = Boundaries(s.yoga_sum, NAKSHATRA_SPAN, 27, a, b)
        self.karana = Boundaries(s.elongation, 6.0, 60, a, b, scan=0.25)
        self.moon_sign = Boundaries(lambda t: s.lon("Moon", t), 30.0, 12, a, b)
        self.sun_sign = Boundaries(lambda t: s.lon("Sun", t), 30.0, 12, a, b, scan=1.0)
        self._rise_set()
        self.days = [self._day(i) for i in range(len(self.dates))]

    # ---- horizon ----
    def _f(self, body, t):
        alt, dist = self.eng.altitude(body, t, self.site)
        return alt - self.eng.threshold(body, dist, self.profile)

    def _near(self, body, kind, guess, half):
        a, b = guess - half, guess + half
        fa, fb = self._f(body, a), self._f(body, b)
        if (kind == "rise" and fa < 0.0 <= fb) or (kind == "set" and fa >= 0.0 > fb):
            return solve(lambda t: self._f(body, t), a, b, fa, fb, tol_days=0.5 / 86400.0)
        return None

    def _event(self, body, kind, start, prev):
        if prev is not None:
            t = self._near(body, kind, prev + 1.0, 0.03)
            if t is not None and start <= t < start + 1.0:
                return t
        return self.eng.first_event(body, kind, start, self.site, self.profile)

    def _rise_set(self):
        n = len(self.dates)
        self.midnights = [self.lt.midnight(*d) for d in self.dates]
        nxt = calendar(julian_day(*self.dates[-1]) + 1.0)[:3]
        self.midnights.append(self.lt.midnight(*nxt))
        # sun events from local mean (solar) midnight, as in suntimes.day_sun_times
        anchors = [julian_day(*d) - self.site[1] / 360.0 for d in self.dates + [nxt]]
        self.rises, self.sets = [], []
        pr = ps = None
        for i in range(n + 1):
            m = anchors[i]
            r = self._event("sun", "rise", m, pr)
            s_ = self._event("sun", "set", r if r is not None else m, ps)
            self.rises.append(r)
            self.sets.append(s_)
            pr = r if r is not None else pr
            ps = s_ if s_ is not None else ps

    def moonrise(self, i):
        m = self.midnights[i]
        for kind, t in self.eng.horizon_events("moon", m, m + 1.0, self.site, self.profile):
            if kind == "rise":
                return t
        return None

    def moon_events(self, i):
        m = self.midnights[i]
        ev = self.eng.horizon_events("moon", m, m + 1.0, self.site, self.profile)
        rise = next((t for k, t in ev if k == "rise"), None)
        set_ = next((t for k, t in ev if k == "set"), None)
        return rise, set_

    # ---- day record ----
    def windows(self, i):
        """Classical day/night divisions as (start, end) UTC JD."""
        r, s_, nr = self.rises[i], self.sets[i], self.rises[i + 1]
        if r is None or s_ is None or nr is None:
            return None
        day = s_ - r
        night = nr - s_
        fifth = day / 5.0
        return {
            "sunrise": (r, r),
            "arunodaya": (r - ARUNODAYA_DAYS, r - ARUNODAYA_DAYS),
            "pratah": (r, r + fifth),
            "purvahna": (r, r + 2 * fifth),
            "madhyahna": (r + 2 * fifth, r + 3 * fifth),
            "aparahna": (r + 3 * fifth, r + 4 * fifth),
            "sayahna": (r + 4 * fifth, s_),
            "pradosha": (s_, s_ + 3.0 * night / 15.0),
            "nishitha": (s_ + 7.0 * night / 15.0, s_ + 8.0 * night / 15.0),
            "day": (r, nr),
        }

    def _day(self, i):
        y, m, d = self.dates[i]
        r, s_, nr = self.rises[i], self.sets[i], self.rises[i + 1]
        ref = r if r is not None else self.midnights[i] + 0.25
        wd = weekday(y, m, d)
        ti, ts, te = self.tithi.at(ref)
        ni, ns, ne = self.nak.at(ref)
        yi, _ys, ye = self.yoga.at(ref)
        ki, _ks, ke = self.karana.at(ref)
        mi, _ms, me = self.moon_sign.at(ref)
        si = self.sun_sign.at(ref)[0]
        month = self.months.at(ref)
        rec = {
            "date": "%04d-%02d-%02d" % (y, m, d),
            "weekday": wd,
            "vara": T.VARAS[wd],
            "sunrise_jd": r, "sunset_jd": s_, "next_sunrise_jd": nr,
            "tithi": {"index": ti + 1, "name": tithi_name(ti),
                      "paksha": "Shukla" if ti < 15 else "Krishna", "end_jd": te},
            "nakshatra": {"index": ni + 1, "name": T.NAKSHATRAS[ni], "end_jd": ne,
                          "start_jd": ns},
            "yoga": {"index": yi + 1, "name": T.YOGAS[yi], "end_jd": ye},
            "karana": {"index": ki + 1, "name": karana_name(ki), "end_jd": ke},
            "moon_sign": {"index": mi + 1, "name": T.RASHIS[mi], "end_jd": me},
            "sun_sign": {"index": si + 1, "name": T.RASHIS[si]},
            "month": {"name": month["name"], "adhika": month["adhika"]} if month else None,
        }
        # tithis touching this Hindu day (kshaya detection)
        if r is not None and nr is not None:
            rec["tithis"] = [{"index": k + 1, "name": tithi_name(k), "start_jd": a, "end_jd": b}
                             for k, a, b in self.tithi.between(r, nr)]
            day_len = s_ - r if s_ is not None else None
            if day_len:
                seg = day_len / 8.0
                rec["rahu_kala"] = (r + (RAHU_SEGMENT[wd] - 1) * seg, r + RAHU_SEGMENT[wd] * seg)
                rec["yamaganda"] = (r + (YAMAGANDA_SEGMENT[wd] - 1) * seg,
                                    r + YAMAGANDA_SEGMENT[wd] * seg)
                rec["gulika"] = (r + (GULIKA_SEGMENT[wd] - 1) * seg, r + GULIKA_SEGMENT[wd] * seg)
        return rec

    def day_index_of(self, t):
        """Index of the Hindu day (sunrise..next sunrise) containing t."""
        for i in range(len(self.dates)):
            r, nr = self.rises[i], self.rises[i + 1]
            if r is not None and nr is not None and r <= t < nr:
                return i
        return None

    def fmt(self, jd):
        return self.lt.iso(jd)


def localize_day(dr, rec, moon=False, i=None):
    """JSON-friendly copy with local ISO times."""
    f = dr.fmt
    out = dict(rec)
    out["sunrise"] = f(rec["sunrise_jd"])
    out["sunset"] = f(rec["sunset_jd"])
    for key in ("tithi", "nakshatra", "yoga", "karana", "moon_sign"):
        el = dict(rec[key])
        el["end"] = f(el.get("end_jd"))
        out[key] = el
    if "tithis" in rec:
        out["tithis"] = [dict(x, start=f(x["start_jd"]), end=f(x["end_jd"])) for x in rec["tithis"]]
    for key in ("rahu_kala", "yamaganda", "gulika"):
        if key in rec:
            out[key] = {"start": f(rec[key][0]), "end": f(rec[key][1])}
    if moon and i is not None:
        mr, ms = dr.moon_events(i)
        out["moonrise"] = f(mr)
        out["moonset"] = f(ms)
    return out
