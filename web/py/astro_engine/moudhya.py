"""Moudhyami (maudhya / asta): Guru (Jupiter) and Shukra (Venus) combust.

A planet is combust while its longitude is within the classical orb of the
Sun (Surya Siddhanta / Phaladeepika: Jupiter 11 deg, Venus 10 deg direct and
8 deg retrograde).  Start and end are the root-solved instants where the
Sun-planet separation equals the orb, so a period is a CALCULATED interval,
not a copied table.  Ceremonies such as marriage, upanayana and griha
pravesha are traditionally not held while either planet is combust.

Optional balya/vriddha padding (days added before and after) follows the
user's tradition; the default is none.
"""
from . import tables as T
from .rootfind import solve, wrap180
from .series import Series, scan_times

BODIES = ("Jupiter", "Venus")
NAMES = {"Jupiter": "Guru moudhyami", "Venus": "Shukra moudhyami"}
SHORT = {"Jupiter": "Guru", "Venus": "Shukra"}
PAD_SPAN = 120.0  # days searched beyond the range so periods overlapping it are complete


def _orb(body, retro):
    return T.COMBUSTION[body][1 if retro else 0]


def periods(t0, t1, model="lahiri", pad_days=0.0, fmt=None, series=None):
    """Combustion periods of Jupiter and Venus overlapping [t0, t1] (UTC JD)."""
    a, b = t0 - PAD_SPAN, t1 + PAD_SPAN
    s = series or Series(a, b, ["Sun", "Jupiter", "Venus"], step=2.0, model=model)
    out = []
    for body in BODIES:
        def sep(t, body=body):
            return wrap180(s.lon(body, t) - s.lon("Sun", t))

        def g(t, body=body):
            return abs(sep(t)) - _orb(body, s.speed(body, t) < 0.0)

        ts = scan_times(a, b, 0.5)
        pt, pg = ts[0], g(ts[0])
        start = pt if pg < 0.0 else None
        for t in ts[1:]:
            gv = g(t)
            if (pg < 0.0) != (gv < 0.0):
                r = solve(g, pt, t, pg, gv, tol_days=30.0 / 86400.0)
                if gv < 0.0:
                    start = r
                else:
                    if start is not None:
                        out.append(_period(s, body, start, r, sep, pad_days, fmt, a, b))
                    start = None
            pt, pg = t, gv
        if start is not None:
            out.append(_period(s, body, start, None, sep, pad_days, fmt, a, b))
    out = [p for p in out
           if (p["end_jd"] is None or p["end_jd"] >= t0) and (p["start_jd"] is None or p["start_jd"] <= t1)]
    out.sort(key=lambda p: p["start_jd"] or t0)
    return out


def _period(s, body, start, end, sep, pad_days, fmt, a, b):
    lo, hi = start, end if end is not None else b
    # moment of conjunction: separation crosses zero inside the period
    conj = None
    n = 40
    prev_t, prev_v = lo, sep(lo)
    for i in range(1, n + 1):
        t = lo + (hi - lo) * i / n
        v = sep(t)
        if (prev_v < 0.0) != (v < 0.0) and abs(prev_v - v) < 180.0:
            conj = solve(sep, prev_t, t, prev_v, v, tol_days=60.0 / 86400.0)
            break
        prev_t, prev_v = t, v
    retro = conj is not None and s.speed(body, conj) < 0.0
    ps = start - pad_days if (start is not None and start > a + 1) else None
    pe = end + pad_days if end is not None else None
    rec = {
        "planet": body,
        "name": NAMES[body],
        "short": SHORT[body],
        "start_jd": ps, "end_jd": pe,
        "start": fmt(ps) if fmt and ps is not None else None,
        "end": fmt(pe) if fmt and pe is not None else None,
        "days": round(pe - ps, 1) if (ps is not None and pe is not None) else None,
        "conjunction": fmt(conj) if fmt and conj is not None else None,
        "conjunction_jd": conj,
        "type": ("inferior (retrograde)" if retro else "superior") if body == "Venus" else "conjunction",
        "orb_deg": _orb(body, retro),
        "padding_days": pad_days,
    }
    return rec


def blocked(periods_list, t):
    """Names of the moudhyami periods active at t."""
    out = []
    for p in periods_list:
        if (p["start_jd"] is None or p["start_jd"] <= t) and (p["end_jd"] is None or t < p["end_jd"]):
            out.append(p["name"])
    return out


def status(periods_list, t, s=None):
    """Per-planet state at t: combust now?, current or next period."""
    res = {}
    for body in BODIES:
        mine = [p for p in periods_list if p["planet"] == body]
        cur = next((p for p in mine if (p["start_jd"] is None or p["start_jd"] <= t)
                    and (p["end_jd"] is None or t < p["end_jd"])), None)
        nxt = next((p for p in mine if p["start_jd"] is not None and p["start_jd"] > t), None)
        row = {"name": NAMES[body], "short": SHORT[body], "combust": cur is not None,
               "current": _strip(cur), "next": _strip(nxt)}
        if s is not None:
            sep = wrap180(s.lon(body, t) - s.lon("Sun", t))
            row["separation_deg"] = round(abs(sep), 2)
            row["orb_deg"] = _orb(body, s.speed(body, t) < 0.0)
        res[body] = row
    return res


def _strip(p):
    if p is None:
        return None
    return {k: v for k, v in p.items() if not k.endswith("_jd")}


def search(p):
    """API: Guru / Shukra moudhyami periods overlapping [start, end] (local dates)."""
    import time
    from .localtime import LocalTime
    started = time.time()
    lt = LocalTime.from_params(p)
    y0, m0, d0 = (int(x) for x in p["start"].split("-"))
    y1, m1, d1 = (int(x) for x in p["end"].split("-"))
    t0, t1 = lt.midnight(y0, m0, d0), lt.midnight(y1, m1, d1) + 1.0
    if t1 - t0 > 12 * 366:
        raise ValueError("Moudhyami search is limited to 12 years per query.")
    pad = float(p.get("moudhya_padding_days", 0) or 0)
    res = periods(t0, t1, p.get("ayanamsa", "lahiri"), pad, lt.iso)
    return {"kind": "moudhya", "start": p["start"], "end": p["end"],
            "periods": [_strip(x) for x in res],
            "rule": "Sun-planet separation within the combustion orb (Jupiter 11 deg; Venus 10 deg, "
                    "8 deg when retrograde), root-solved to about 30 s",
            "compute_seconds": round(time.time() - started, 3)}
