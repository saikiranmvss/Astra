"""Solar and lunar eclipses from the same apparent positions as everything else.

Lunar: Earth's shadow radii at the Moon's distance by the Danjon rule
(Earth radius enlarged 1%): umbra = 1.01*pi_M + pi_S - s_S,
penumbra = 1.01*pi_M + pi_S + s_S.  Contacts solve sep(t) = radius + s_M.
Solar (global): shadow axis Sun->Moon; gamma = distance of the axis from
Earth's centre in Earth radii; umbral/penumbral cone radii L1/L2 on the
fundamental plane decide partial / annular / total.
Solar (local): topocentric Sun-Moon separation vs. semidiameters for the
observer gives contacts, magnitude, obscuration and the Sun's altitude.
Screening uses mean syzygies (Meeus ch. 49/54): |sin F| > 0.36 -> none.
"""
import math
import time

from .chart import ChartContext
from .constants import DEG2RAD, ERAD_KM, MOON_RADIUS_KM, RAD2DEG, SUN_RADIUS_KM, AU_KM
from .localtime import LocalTime
from .panchanga import Engine
from .positions import apparent_gcrs, equatorial_of_date
from .rootfind import solve
from .timescale import Instant, julian_day
from .vec import dot, norm, scale, sub

SYNODIC = 29.530588861


def _ang(a, b):
    c = dot(a, b) / (norm(a) * norm(b))
    return math.acos(max(-1.0, min(1.0, c)))


def _golden(f, a, b, tol=0.2 / 86400.0):
    g = (math.sqrt(5.0) - 1.0) / 2.0
    c, d = b - g * (b - a), a + g * (b - a)
    fc, fd = f(c), f(d)
    while b - a > tol:
        if fc < fd:
            b, d, fd = d, c, fc
            c = b - g * (b - a)
            fc = f(c)
        else:
            a, c, fc = c, d, fd
            d = a + g * (b - a)
            fd = f(d)
    t = (a + b) / 2.0
    return t, f(t)


class _Geo(object):
    def __init__(self, ctx, site=None):
        self.ctx = ctx
        self.site = site
        self._c = {}

    def vecs(self, t, topo=False):
        key = (round(t * 864000), topo)
        v = self._c.get(key)
        if v is None:
            if len(self._c) > 3000:
                self._c.clear()
            inst = Instant.from_utc_jd(t)
            o = self.ctx.orient(inst)
            site = self.site if topo else None
            s = scale(apparent_gcrs("sun", inst, o, site=site), AU_KM)
            m = scale(apparent_gcrs("moon", inst, o, site=site), AU_KM)
            v = (s, m, o, inst)
            self._c[key] = v
        return v

    def altitude(self, body, t):
        s, m, o, inst = self.vecs(t, topo=True)
        vec = s if body == "sun" else m
        ra, dec, _ = equatorial_of_date(vec, o)
        last = (o.gast_hours * 15.0 + self.site[1]) % 360.0
        ha = (last - ra) * DEG2RAD
        phi, d = self.site[0] * DEG2RAD, dec * DEG2RAD
        return math.asin(math.sin(phi) * math.sin(d) + math.cos(phi) * math.cos(d) * math.cos(ha)) * RAD2DEG


def _lunar_geometry(geo, t):
    s, m, _o, _i = geo.vecs(t)
    ds, dm = norm(s), norm(m)
    theta = _ang(m, scale(s, -1.0))
    pi_m = math.asin(ERAD_KM / dm)
    pi_s = math.asin(ERAD_KM / ds)
    s_s = math.asin(SUN_RADIUS_KM / ds)
    s_m = math.asin(MOON_RADIUS_KM / dm)
    umbra = 1.01 * pi_m + pi_s - s_s
    pen = 1.01 * pi_m + pi_s + s_s
    return theta, umbra, pen, s_m


def lunar(geo, t_full, lt):
    f = lambda t: _lunar_geometry(geo, t)[0]
    tm, th = _golden(f, t_full - 0.25, t_full + 0.25)
    _, umbra, pen, s_m = _lunar_geometry(geo, tm)
    pen_mag = (pen + s_m - th) / (2.0 * s_m)
    if pen_mag <= 0.0:
        return None
    umb_mag = (umbra + s_m - th) / (2.0 * s_m)
    kind = "total" if umb_mag >= 1.0 else ("partial" if umb_mag > 0.0 else "penumbral")

    def contact(which, sign):
        def g(t):
            theta, u, p, sm = _lunar_geometry(geo, t)
            r = {"P": p + sm, "U": u + sm, "T": u - sm}[which]
            return theta - r
        lo, hi = (tm - 0.3, tm) if sign < 0 else (tm, tm + 0.3)
        glo, ghi = g(lo), g(hi)
        if glo * ghi > 0:
            return None
        return solve(g, lo, hi, glo, ghi, tol_days=0.5 / 86400.0)

    names = [("P1", "P", -1), ("U1", "U", -1), ("U2", "T", -1), ("U3", "T", 1), ("U4", "U", 1),
             ("P4", "P", 1)]
    contacts = {}
    for nm, w, sg in names:
        if w == "U" and kind == "penumbral":
            continue
        if w == "T" and kind != "total":
            continue
        t = contact(w, sg)
        if t is not None:
            contacts[nm] = t
    contacts["max"] = tm
    out = {"type": "lunar", "kind": kind, "max": lt.iso(tm), "max_jd": tm,
           "umbral_magnitude": round(umb_mag, 4), "penumbral_magnitude": round(pen_mag, 4),
           "contacts": {k: lt.iso(v) for k, v in contacts.items()}}
    if geo.site:
        vis = {k: round(geo.altitude("moon", v), 2) for k, v in contacts.items()}
        out["moon_altitude"] = vis
        out["visible_at_max"] = vis["max"] > -0.5
        out["visible_any"] = any(a > -0.5 for a in vis.values())
        p1 = contacts.get("P1", tm - 0.1)
        p4 = contacts.get("P4", tm + 0.1)
        out["duration_minutes"] = round((p4 - p1) * 1440.0, 1)
    return out


def _solar_global(geo, t):
    s, m, _o, _i = geo.vecs(t)
    sm = sub(m, s)
    dsm = norm(sm)
    u = scale(sm, 1.0 / dsm)
    mu = dot(m, u)
    p = sub(m, scale(u, mu))
    gamma = norm(p) / ERAD_KM * (1.0 if p[2] >= 0 else -1.0)
    delta = -mu
    f1 = math.asin((SUN_RADIUS_KM + MOON_RADIUS_KM) / dsm)
    f2 = math.asin((SUN_RADIUS_KM - MOON_RADIUS_KM) / dsm)
    l1 = MOON_RADIUS_KM / math.cos(f1) + delta * math.tan(f1)
    l2 = MOON_RADIUS_KM / math.cos(f2) - delta * math.tan(f2)
    return gamma, l1, l2


def _overlap_fraction(rs, rm, d):
    if d >= rs + rm:
        return 0.0
    if d <= abs(rm - rs):
        return 1.0 if rm >= rs else (rm * rm) / (rs * rs)
    a = rs * rs * math.acos((d * d + rs * rs - rm * rm) / (2 * d * rs))
    b = rm * rm * math.acos((d * d + rm * rm - rs * rs) / (2 * d * rm))
    c = 0.5 * math.sqrt((-d + rs + rm) * (d + rs - rm) * (d - rs + rm) * (d + rs + rm))
    return (a + b - c) / (math.pi * rs * rs)


def solar(geo, t_new, lt):
    f = lambda t: abs(_solar_global(geo, t)[0])
    tg, ag = _golden(f, t_new - 0.25, t_new + 0.25)
    gamma, l1, l2 = _solar_global(geo, tg)
    if abs(gamma) * ERAD_KM > l1 + ERAD_KM:
        return None
    # l2 > 0: the umbra cone still has positive radius at the fundamental
    # plane (vertex beyond Earth's centre) -> total; l2 < 0 -> antumbra.
    if abs(gamma) < 0.9972:
        kind = "total" if l2 > 0 else "annular"
        if abs(l2) < 15.0:
            kind = "hybrid (annular-total)"
    elif abs(gamma) < 0.9972 + abs(l2) / ERAD_KM:
        kind = ("total" if l2 > 0 else "annular") + " (non-central)"
    else:
        kind = "partial"
    out = {"type": "solar", "kind": kind, "max": lt.iso(tg), "max_jd": tg,
           "gamma": round(gamma, 4),
           "global_magnitude": round((l1 - (abs(gamma) - 1.0) * ERAD_KM) / (l1 - l2), 4)
           if kind == "partial" else None}
    if geo.site:
        out["local"] = _solar_local(geo, tg, lt)
    return out


def _solar_local(geo, tg, lt):
    def geom(t):
        s, m, _o, _i = geo.vecs(t, topo=True)
        th = _ang(s, m)
        return th, math.asin(SUN_RADIUS_KM / norm(s)), math.asin(MOON_RADIUS_KM / norm(m))
    tm, th = _golden(lambda t: geom(t)[0], tg - 0.2, tg + 0.2)
    _, ss, sm = geom(tm)
    if th >= ss + sm:
        return {"visible": False, "reason": "no eclipse at this location"}
    mag = (ss + sm - th) / (2.0 * ss)
    obs = _overlap_fraction(ss, sm, th)

    def contact(kind, sign):
        def g(t):
            a, s1, m1 = geom(t)
            return a - (s1 + m1 if kind == "outer" else abs(m1 - s1))
        lo, hi = (tm - 0.2, tm) if sign < 0 else (tm, tm + 0.2)
        glo, ghi = g(lo), g(hi)
        if glo * ghi > 0:
            return None
        return solve(g, lo, hi, glo, ghi, tol_days=0.5 / 86400.0)
    c = {"C1": contact("outer", -1), "max": tm, "C4": contact("outer", 1)}
    central = th < abs(sm - ss)
    if central:
        c["C2"] = contact("inner", -1)
        c["C3"] = contact("inner", 1)
    alts = {k: round(geo.altitude("sun", v), 2) for k, v in c.items() if v is not None}
    local_kind = ("total" if sm > ss else "annular") if central else "partial"
    return {"visible": any(a > -0.5 for a in alts.values()), "kind": local_kind,
            "magnitude": round(mag, 4), "obscuration": round(obs, 4),
            "contacts": {k: lt.iso(v) for k, v in c.items() if v is not None},
            "sun_altitude": alts,
            "duration_minutes": round((c["C4"] - c["C1"]) * 1440.0, 1)
            if c["C1"] and c["C4"] else None}


def search(p):
    started = time.time()
    lt = LocalTime.from_params(p)
    y0, m0, d0 = (int(x) for x in p["start"].split("-"))
    y1, m1, d1 = (int(x) for x in p["end"].split("-"))
    t0, t1 = lt.midnight(y0, m0, d0), lt.midnight(y1, m1, d1) + 1.0
    if t1 - t0 > 25 * 366:
        raise ValueError("Eclipse search is limited to 25 years per query.")
    site = None
    if p.get("lat") is not None and p.get("lon") is not None:
        site = (float(p["lat"]), float(p["lon"]), float(p.get("elevation", 0.0)))
    ctx = ChartContext(p.get("ayanamsa", "lahiri"))
    geo = _Geo(ctx, site)
    eng = Engine(ctx=ctx)
    kinds = set(p.get("kinds") or ["solar", "lunar"])
    k0 = math.floor((t0 - 2451550.09766) / SYNODIC) - 1
    k1 = math.ceil((t1 - 2451550.09766) / SYNODIC) + 1
    out = []
    k = k0
    while k <= k1:
        for half, kind in ((0.0, "solar"), (0.5, "lunar")):
            if kind not in kinds:
                continue
            kk = k + half
            F = (160.7108 + 390.67050284 * kk) * DEG2RAD
            if abs(math.sin(F)) > 0.36:
                continue
            jde = 2451550.09766 + SYNODIC * kk
            target = 0.0 if kind == "solar" else 180.0
            t = eng.crossing(eng.elongation, target, jde - 69.0 / 86400.0, 360.0 / SYNODIC,
                             after=jde - 2.0, step=0.5)
            if t is None or not (t0 - 0.3 <= t < t1 + 0.3):
                continue
            e = solar(geo, t, lt) if kind == "solar" else lunar(geo, t, lt)
            if e and t0 <= e["max_jd"] < t1:
                e["syzygy"] = lt.iso(t)
                sid = eng.moon_sid(t)
                from . import tables as T
                e["moon_nakshatra"] = T.NAKSHATRAS[int(sid // (360.0 / 27.0))]
                e["moon_rashi"] = T.RASHIS[int(sid // 30.0)]
                e["sun_rashi"] = T.RASHIS[int(eng.sun_sid(t) // 30.0)]
                out.append(e)
        k += 1
    out.sort(key=lambda e: e["max_jd"])
    return {"kind": "eclipses", "count": len(out), "eclipses": out,
            "method": {"lunar": "Danjon shadow (Earth radius +1%)",
                       "solar": "shadow-axis gamma with umbral/penumbral cones; topocentric local circumstances"},
            "compute_seconds": round(time.time() - started, 3)}
