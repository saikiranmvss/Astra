"""Event search over a date range: panchanga element changes, lunations,
sankrantis, planetary ingresses, stations, combustion and conjunctions."""
import time

from . import tables as T
from .constants import NAKSHATRA_SPAN
from .localtime import LocalTime
from .panchanga import karana_name, tithi_name
from .rootfind import solve, wrap180
from .series import MonthIndex, Series, crossings, scan_times, stations
LUNAR_CATS = ("tithi", "nakshatra", "yoga", "karana", "lunation", "moon_sign")
PLANETS = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu",
           "Uranus", "Neptune", "Pluto"]
STATION_BODIES = ["Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"]
COMBUST_BODIES = ["Mercury", "Venus", "Mars", "Jupiter", "Saturn"]
PHASES = ["New Moon (Amavasya)", "First quarter", "Full Moon (Purnima)", "Last quarter"]
MAX_LUNAR_DAYS = 3 * 366 + 1
MAX_PLANET_DAYS = 60 * 366


def _intervals(found, t0, t1, first_index, count):
    """Turn boundary crossings into (index, start, end) intervals."""
    out = []
    prev_t, prev_k = None, first_index
    for t, k, _d in found:
        out.append((prev_k % count, prev_t, t))
        prev_t, prev_k = t, k
    out.append((prev_k % count, prev_t, None))
    return out


def _lunar_month_at(series, t):
    return T.LUNAR_MONTH_BY_SUN_SIGN[int(series.sid("Sun", t) // 30.0) % 12]


def search(p):
    started = time.time()
    lt = LocalTime.from_params(p)
    y0, m0, d0 = (int(x) for x in p["start"].split("-"))
    y1, m1, d1 = (int(x) for x in p["end"].split("-"))
    t0 = lt.midnight(y0, m0, d0)
    t1 = lt.midnight(y1, m1, d1) + 1.0
    if t1 <= t0:
        raise ValueError("End date must be after start date.")
    cats = set(p.get("categories") or ["tithi", "nakshatra", "lunation", "sankranti"])
    planets = [x for x in (p.get("planets") or PLANETS) if x in PLANETS]
    filt = p.get("filters") or {}
    model = p.get("ayanamsa", "lahiri")
    node = p.get("node", "true")
    span_days = t1 - t0
    lunar = bool(cats & set(LUNAR_CATS)) or ("Moon" in planets and cats & {
        "ingress", "nakshatra_ingress", "conjunction"})
    if lunar and span_days > MAX_LUNAR_DAYS:
        raise ValueError("Moon-based searches are limited to 3 years per query.")
    if span_days > MAX_PLANET_DAYS:
        raise ValueError("Planetary searches are limited to 60 years per query.")

    bodies = set()
    if lunar or "sankranti" in cats:
        bodies.update(["Sun", "Moon"] if lunar else ["Sun"])
    if cats & {"ingress", "nakshatra_ingress", "conjunction"}:
        bodies.update(planets)
    if "station" in cats:
        bodies.update(x for x in planets if x in STATION_BODIES)
    if "combustion" in cats:
        bodies.add("Sun")
        bodies.update(x for x in planets if x in COMBUST_BODIES)
    if not lunar:
        bodies.discard("Moon")
    bodies = [b for b in PLANETS if b in bodies]
    if not bodies:
        return {"kind": "search", "events": [], "count": 0}

    step = 1.0 if (lunar or span_days <= MAX_LUNAR_DAYS) else 4.0
    if step > 1.0 and node == "true":
        node = "mean"  # the osculating node wobbles with a ~14-day period
    pad = 35.0 if lunar else 0.0
    s = Series(t0 - pad, t1 + pad, bodies, step=step, model=model, node=node)
    scan = 0.5 if step == 1.0 else step
    months = MonthIndex(s, t0 - pad, t1 + pad, T.LUNAR_MONTH_BY_SUN_SIGN) if lunar else None

    def month_label(t):
        m = months.at(t) if months else None
        if not m:
            return None
        return ("Adhika " if m["adhika"] else "") + m["name"]
    precision = "about 1 s" if step == 1.0 else "minutes (mean-equinox long-range scan)"

    events = []

    def add(cat, t, title, **kw):
        if t is None or t < t0 or t >= t1:
            return
        e = {"category": cat, "jd": t, "time": lt.iso(t), "title": title}
        e.update(kw)
        events.append(e)

    def add_interval(cat, idx, start, end, title, **kw):
        if start is not None and start >= t1:
            return
        if end is not None and end < t0:
            return
        e = {"category": cat, "jd": start if start is not None else t0,
             "time": lt.iso(start), "end": lt.iso(end), "end_jd": end, "title": title,
             "index": idx + 1}
        e.update(kw)
        events.append(e)

    def allowed(key, idx):
        f = filt.get(key)
        return not f or (idx + 1) in f

    if "tithi" in cats:
        found = crossings(s.elongation, 12.0, t0, t1, scan)
        k0 = int(s.elongation(t0) // 12.0)
        for idx, a, b in _intervals(found, t0, t1, k0, 30):
            if allowed("tithi", idx):
                paksha = "Shukla" if idx < 15 else "Krishna"
                add_interval("tithi", idx, a, b, "%s %s" % (paksha, tithi_name(idx)),
                             name=tithi_name(idx), paksha=paksha,
                             month=month_label(a if a else t0))
    if "nakshatra" in cats:
        f = lambda t: s.lon("Moon", t)
        found = crossings(f, NAKSHATRA_SPAN, t0, t1, scan)
        for idx, a, b in _intervals(found, t0, t1, int(f(t0) // NAKSHATRA_SPAN), 27):
            if allowed("nakshatra", idx):
                add_interval("nakshatra", idx, a, b, "Moon in " + T.NAKSHATRAS[idx],
                             name=T.NAKSHATRAS[idx], lord=T.nakshatra_lord(idx))
    if "yoga" in cats:
        found = crossings(s.yoga_sum, NAKSHATRA_SPAN, t0, t1, scan)
        for idx, a, b in _intervals(found, t0, t1, int(s.yoga_sum(t0) // NAKSHATRA_SPAN), 27):
            if allowed("yoga", idx):
                add_interval("yoga", idx, a, b, T.YOGAS[idx] + " yoga", name=T.YOGAS[idx])
    if "karana" in cats:
        found = crossings(s.elongation, 6.0, t0, t1, scan)
        names = filt.get("karana_names")
        for idx, a, b in _intervals(found, t0, t1, int(s.elongation(t0) // 6.0), 60):
            nm = karana_name(idx)
            if not names or nm in names:
                add_interval("karana", idx, a, b, nm + " karana" + (" (Bhadra)" if nm == "Vishti" else ""),
                             name=nm)
    if "moon_sign" in cats:
        f = lambda t: s.lon("Moon", t)
        found = crossings(f, 30.0, t0, t1, scan)
        for idx, a, b in _intervals(found, t0, t1, int(f(t0) // 30.0), 12):
            if allowed("rashi", idx):
                add_interval("moon_sign", idx, a, b, "Moon in " + T.RASHIS[idx], name=T.RASHIS[idx])
    if "lunation" in cats:
        want = set(filt.get("phases") or [0, 1, 2, 3])
        for t, k, _d in crossings(s.elongation, 90.0, t0, t1, scan):
            ph = k % 4
            if ph in want:
                kw = {"phase": ph}
                if ph == 0:
                    kw["month_begins"] = month_label(t + 1e-3) or _lunar_month_at(s, t)
                    kw["detail"] = "Amanta month %s begins" % kw["month_begins"]
                elif ph == 2:
                    kw["month"] = month_label(t)
                add("lunation", t, PHASES[ph], **kw)
    if "sankranti" in cats:
        f = lambda t: s.lon("Sun", t)
        for t, k, _d in crossings(f, 30.0, t0, t1, scan):
            sign = k % 12
            if allowed("rashi_sun", sign):
                add("sankranti", t, T.RASHIS[sign] + " Sankranti", name=T.RASHIS[sign],
                    detail="Sun enters " + T.RASHIS[sign])

    if "ingress" in cats:
        for b in planets:
            if b == "Moon" and "moon_sign" in cats:
                continue
            f = (lambda t, b=b: s.lon(b, t))
            for t, k, d in crossings(f, 30.0, t0, t1, scan):
                add("ingress", t, "%s enters %s%s" % (b, T.RASHIS[k % 12],
                                                       " (retrograde)" if d < 0 and b not in ("Rahu", "Ketu") else ""),
                    body=b, name=T.RASHIS[k % 12], direction=d)
    if "nakshatra_ingress" in cats:
        for b in planets:
            if b == "Moon":
                continue
            f = (lambda t, b=b: s.lon(b, t))
            for t, k, d in crossings(f, NAKSHATRA_SPAN, t0, t1, scan):
                idx = k % 27
                add("nakshatra_ingress", t, "%s enters %s" % (b, T.NAKSHATRAS[idx]),
                    body=b, name=T.NAKSHATRAS[idx], direction=d)
    if "station" in cats:
        for b in planets:
            if b not in STATION_BODIES:
                continue
            for t, kind in stations(s, b, t0, t1, scan=1.0 if step == 1.0 else step):
                add("station", t, "%s stations %s" % (b, kind), body=b, name=kind,
                    detail="at %s %.2f deg" % (T.RASHIS[int(s.sid(b, t) // 30) % 12],
                                               s.sid(b, t) % 30.0))
    if "combustion" in cats:
        for b in planets:
            if b not in COMBUST_BODIES:
                continue

            def g(t, b=b):
                retro = s.speed(b, t) < 0.0
                orb = T.COMBUSTION[b][1 if retro else 0]
                return abs(wrap180(s.lon(b, t) - s.lon("Sun", t))) - orb

            ts = scan_times(t0, t1, scan)
            pt, pg = ts[0], g(ts[0])
            for t in ts[1:]:
                gv = g(t)
                if (pg < 0.0) != (gv < 0.0):
                    r = solve(g, pt, t, pg, gv, tol_days=10.0 / 86400.0)
                    add("combustion", r, "%s %s combustion" % (b, "enters" if gv < 0 else "leaves"),
                        body=b, name="begin" if gv < 0 else "end",
                        detail="separation from Sun = orb (modern diagnostic, not heliacal visibility)")
                pt, pg = t, gv
    if "conjunction" in cats:
        cands = [b for b in planets if b not in ("Ketu",)]
        for i, a in enumerate(cands):
            for b in cands[i + 1:]:
                if (a, b) in (("Rahu", "Ketu"),):
                    continue
                f = (lambda t, a=a, b=b: s.lon(a, t) - s.lon(b, t))
                for t, k, d in crossings(f, 360.0, t0, t1, scan):
                    add("conjunction", t, "%s conjoins %s" % (a, b), body=a, other=b,
                        name=T.RASHIS[int(s.sid(a, t) // 30) % 12],
                        detail="in %s %.2f deg" % (T.RASHIS[int(s.sid(a, t) // 30) % 12],
                                                   s.sid(a, t) % 30.0))

    events.sort(key=lambda e: e["jd"])
    limit = int(p.get("limit", 5000))
    return {
        "kind": "search",
        "start": p["start"], "end": p["end"],
        "categories": sorted(cats),
        "count": len(events),
        "truncated": len(events) > limit,
        "events": events[:limit],
        "precision": precision,
        "compute_seconds": round(time.time() - started, 3),
    }
