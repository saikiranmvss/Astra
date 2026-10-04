"""Sampled sidereal longitudes with 8-point Lagrange interpolation.

Range work (month calendars, event lists, transits, muhurta search) samples
each body once per grid step and interpolates between samples.  With a
1-day step the Moon is reproduced to about 0.1 arcsec (~0.2 s of time) and
slower bodies far better, so every boundary found from a Series is still a
root-solved event, not a table lookup.
"""
import math

from .chart import ChartContext, mean_node_tropical, true_node_tropical
from .earth import lagrange_weights
from .rootfind import solve
from .timescale import Instant

OFFSETS = (-3, -2, -1, 0, 1, 2, 3, 4)
NODES = ("Rahu", "Ketu")


def _unwrap(values):
    out = [values[0]]
    for v in values[1:]:
        prev = out[-1]
        d = (v - prev + 180.0) % 360.0 - 180.0
        out.append(prev + d)
    return out


class Series(object):
    def __init__(self, t0, t1, bodies, step=1.0, model="lahiri", node="true",
                 nutation=None, ctx=None):
        self.step = float(step)
        self.k0 = int(math.floor(t0 / self.step)) - 4
        k1 = int(math.ceil(t1 / self.step)) + 5
        self.n = k1 - self.k0 + 1
        if ctx is None:
            ctx = ChartContext(model, nutation or ("grid" if step <= 1.0 else "none"))
        self.ctx = ctx
        self.node = node
        self.bodies = list(bodies)
        self.t0, self.t1 = t0, t1
        raw = dict((b, []) for b in self.bodies)
        for i in range(self.n):
            inst = Instant.from_utc_jd((self.k0 + i) * self.step)
            o = ctx.orient(inst)
            rahu = None
            for b in self.bodies:
                if b in NODES:
                    if rahu is None:
                        if node == "mean":
                            rahu = mean_node_tropical(inst) - o.ayan_mean
                        else:
                            rahu = true_node_tropical(inst, o) - o.ayan_true
                    raw[b].append((rahu + (180.0 if b == "Ketu" else 0.0)) % 360.0)
                else:
                    raw[b].append(ctx.sidereal(b, inst)[0])
        self.v = dict((b, _unwrap(raw[b])) for b in self.bodies)

    def _weights(self, t):
        x = t / self.step
        k = int(math.floor(x))
        i = k - self.k0
        if i < 3 or i + 4 >= self.n:
            raise ValueError("time outside sampled range")
        return i, lagrange_weights(x - k, OFFSETS)

    def lon(self, body, t):
        """Unwrapped sidereal longitude (continuous across 360)."""
        i, w = self._weights(t)
        vals = self.v[body]
        return sum(wi * vals[i + off] for wi, off in zip(w, OFFSETS))

    def lons(self, bodies, t):
        i, w = self._weights(t)
        out = {}
        for b in bodies:
            vals = self.v[b]
            out[b] = sum(wi * vals[i + off] for wi, off in zip(w, OFFSETS))
        return out

    def sid(self, body, t):
        return self.lon(body, t) % 360.0

    def speed(self, body, t, h=0.01):
        return (self.lon(body, t + h) - self.lon(body, t - h)) / (2.0 * h)

    # ---- derived lunar quantities (unwrapped) ----
    def elongation(self, t):
        v = self.lons(("Sun", "Moon"), t)
        return v["Moon"] - v["Sun"]

    def yoga_sum(self, t):
        v = self.lons(("Sun", "Moon"), t)
        return v["Moon"] + v["Sun"]


def scan_times(t0, t1, step):
    n = max(1, int(math.ceil((t1 - t0) / step)))
    return [t0 + (t1 - t0) * i / n for i in range(n + 1)]


def crossings(fn, span, t0, t1, scan=0.5, offset=0.0):
    """Times in [t0, t1] where fn (unwrapped degrees) crosses offset + k*span.

    Returns (t, new_index, direction) with new_index the integer segment
    index entered (not reduced modulo anything).
    """
    out = []
    ts = scan_times(t0, t1, scan)
    pt, pv = ts[0], fn(ts[0])
    for t in ts[1:]:
        v = fn(t)
        ka = math.floor((pv - offset) / span)
        kb = math.floor((v - offset) / span)
        if kb != ka:
            direction = 1 if kb > ka else -1
            ks = range(ka + 1, kb + 1) if direction == 1 else range(ka, kb, -1)
            for k in ks:
                target = offset + k * span

                def g(x, target=target):
                    return fn(x) - target
                r = solve(g, pt, t, pv - target, v - target)
                out.append((r, k if direction == 1 else k - 1, direction))
        pt, pv = t, v
    return out


class MonthIndex(object):
    """Amanta lunar months from New Moons found in a Series.

    A month is named from the Sun's sidereal sign at its starting New Moon;
    it is adhika when the Sun is in the same sign at the closing New Moon.
    """

    def __init__(self, series, a, b, names):
        self.series = series
        nm = [t for t, k, _d in crossings(series.elongation, 360.0, a, b, 0.5)]
        self.new_moons = nm
        self.months = []
        for i in range(len(nm) - 1):
            s1 = int(series.sid("Sun", nm[i]) // 30.0) % 12
            s2 = int(series.sid("Sun", nm[i + 1]) // 30.0) % 12
            self.months.append({"start": nm[i], "end": nm[i + 1], "name": names[s1],
                                "adhika": s1 == s2, "sun_sign": s1})

    def at(self, t):
        for m in self.months:
            if m["start"] <= t < m["end"]:
                return m
        return None


def stations(series, body, t0, t1, scan=1.0):
    """Retrograde / direct stations: zeros of the longitude speed."""
    out = []
    ts = scan_times(t0, t1, scan)
    pt, ps = ts[0], series.speed(body, ts[0])
    for t in ts[1:]:
        s = series.speed(body, t)
        if (ps < 0.0) != (s < 0.0):
            r = solve(lambda x: series.speed(body, x), pt, t, ps, s, tol_days=30.0 / 86400.0)
            out.append((r, "retrograde" if ps > 0.0 else "direct"))
        pt, ps = t, s
    return out
