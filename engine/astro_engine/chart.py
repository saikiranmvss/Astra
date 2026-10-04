"""D1 chart: graha states, nodes, lagna, bhavas, dignity and combustion."""
import math

from . import tables as T
from .constants import DEG2RAD, NAKSHATRA_SPAN, PADA_SPAN, RAD2DEG
from .earth import Orientation, centuries
from .positions import apparent_gcrs, ecliptic_of_date, geocentric_moon_state_ecliptic
from .sidereal import ayanamsa
from .vec import cross

PHYSICAL = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn",
            "Uranus", "Neptune", "Pluto"]
SPEED_STEP = 0.02  # days, central difference for longitude speed


def norm360(x):
    return x % 360.0


def sign_of(lon):
    return int(norm360(lon) // 30.0) % 12


def nakshatra_info(sid):
    sid = norm360(sid)
    i = int(sid // NAKSHATRA_SPAN) % 27
    into = sid - i * NAKSHATRA_SPAN
    pada = int(into // PADA_SPAN) + 1
    return {
        "index": i + 1,
        "name": T.NAKSHATRAS[i],
        "lord": T.nakshatra_lord(i),
        "pada": min(pada, 4),
        "degrees_into": into,
        "fraction_elapsed": into / NAKSHATRA_SPAN,
    }


def rashi_info(sid):
    s = sign_of(sid)
    return {"index": s + 1, "name": T.RASHIS[s], "lord": T.RASHI_LORD[s],
            "degrees_in_sign": norm360(sid) - s * 30.0}


def mean_node_tropical(inst):
    """Mean longitude of the Moon's ascending node, mean equinox of date."""
    t = centuries(inst.tt)
    om = (125.0445479 - 1934.1362891 * t + 0.0020754 * t * t
          + t ** 3 / 467441.0 - t ** 4 / 60616000.0)
    return norm360(om)


def true_node_tropical(inst, orient):
    """Osculating ascending node from the geocentric lunar orbit plane."""
    r, v = geocentric_moon_state_ecliptic(inst, orient)
    h = cross(r, v)
    return norm360(math.atan2(h[0], -h[1]) * RAD2DEG)


class ChartContext(object):
    """Caches orientation and ayanamsa per instant."""

    def __init__(self, ayanamsa_model="lahiri", nutation="grid"):
        self.model = ayanamsa_model
        self.nutation = nutation
        self._cache = {}

    def orient(self, inst):
        key = round(inst.utc * 86400.0 * 1000.0)
        o = self._cache.get(key)
        if o is None:
            if len(self._cache) > 2000:
                self._cache.clear()
            o = Orientation(inst, self.nutation)
            o.ayan_true, o.ayan_mean = ayanamsa(o, self.model)
            self._cache[key] = o
        return o

    def tropical(self, body, inst, site=None):
        o = self.orient(inst)
        lon, lat, dist = ecliptic_of_date(apparent_gcrs(body.lower(), inst, o, site=site), o)
        return lon, lat, dist

    def sidereal(self, body, inst, site=None):
        o = self.orient(inst)
        lon, lat, dist = self.tropical(body, inst, site)
        return norm360(lon - o.ayan_true), lat, dist


def _speed(ctx, body, inst):
    a = ctx.sidereal(body, inst.shifted(-SPEED_STEP))[0]
    b = ctx.sidereal(body, inst.shifted(SPEED_STEP))[0]
    return ((b - a + 180.0) % 360.0 - 180.0) / (2.0 * SPEED_STEP)


def dignity(planet, sid):
    if planet not in T.EXALTATION:
        return None
    s = sign_of(sid)
    deg = norm360(sid) - s * 30.0
    ex_sign, ex_deg = T.EXALTATION[planet]
    if s == ex_sign:
        return "exalted"
    if s == (ex_sign + 6) % 12:
        return "debilitated"
    mt = T.MOOLATRIKONA[planet]
    if s == mt[0] and mt[1] <= deg < mt[2]:
        return "moolatrikona"
    if s in T.OWN_SIGNS[planet]:
        return "own"
    lord = T.RASHI_LORD[s]
    friends, neutral, enemies = T.NATURAL_FRIENDS[planet]
    if lord in friends:
        return "friend"
    if lord in enemies:
        return "enemy"
    return "neutral"


def ascendant_tropical(orient, lat_deg, lon_deg):
    ramc = (orient.gast_hours * 15.0 + lon_deg) % 360.0
    th = ramc * DEG2RAD
    eps = orient.true_eps
    phi = lat_deg * DEG2RAD
    asc = math.atan2(math.cos(th), -(math.sin(th) * math.cos(eps) + math.tan(phi) * math.sin(eps)))
    mc = math.atan2(math.sin(th), math.cos(th) * math.cos(eps))
    return norm360(asc * RAD2DEG), norm360(mc * RAD2DEG), ramc


def sripati_bhavas(asc_sid, mc_sid):
    """Sripati: quadrants trisected; returns 12 bhava madhyas and sandhis."""
    ic = norm360(mc_sid + 180.0)
    dsc = norm360(asc_sid + 180.0)
    q1 = (asc_sid - mc_sid) % 360.0  # MC -> Asc (houses 10,11,12)
    q2 = (ic - asc_sid) % 360.0      # Asc -> IC (houses 1,2,3)
    m = [0.0] * 12
    m[9] = mc_sid
    m[10] = norm360(mc_sid + q1 / 3.0)
    m[11] = norm360(mc_sid + 2.0 * q1 / 3.0)
    m[0] = asc_sid
    m[1] = norm360(asc_sid + q2 / 3.0)
    m[2] = norm360(asc_sid + 2.0 * q2 / 3.0)
    m[3] = ic
    m[4] = norm360(m[10] + 180.0)
    m[5] = norm360(m[11] + 180.0)
    m[6] = dsc
    m[7] = norm360(m[1] + 180.0)
    m[8] = norm360(m[2] + 180.0)
    sandhi = []
    for i in range(12):
        a = m[i]
        b = m[(i + 1) % 12]
        sandhi.append(norm360(a + ((b - a) % 360.0) / 2.0))
    return m, sandhi


def bhava_of(lon, sandhi):
    """House number (1-12) whose sandhi interval contains lon."""
    for i in range(12):
        start = sandhi[(i - 1) % 12]
        end = sandhi[i]
        if (lon - start) % 360.0 < (end - start) % 360.0:
            return i + 1
    return 1


def compute_chart(inst, lat, lon, elev=0.0, ayanamsa_model="lahiri", node="true",
                  ctx=None):
    ctx = ctx or ChartContext(ayanamsa_model)
    o = ctx.orient(inst)
    asc_t, mc_t, ramc = ascendant_tropical(o, lat, lon)
    asc = norm360(asc_t - o.ayan_true)
    mc = norm360(mc_t - o.ayan_true)
    asc_sign = sign_of(asc)
    one_min = 1.0 / 1440.0
    a_inst, b_inst = inst.shifted(-one_min), inst.shifted(one_min)
    asc_a = ascendant_tropical(ctx.orient(a_inst), lat, lon)[0]
    asc_b = ascendant_tropical(ctx.orient(b_inst), lat, lon)[0]
    asc_speed = ((asc_b - asc_a + 180.0) % 360.0 - 180.0) / 2.0

    grahas = {}
    sun_sid = None
    for name in PHYSICAL:
        sid, blat, dist = ctx.sidereal(name, inst)
        trop = norm360(sid + o.ayan_true)
        spd = _speed(ctx, name, inst)
        grahas[name] = {
            "tropical_longitude": trop,
            "longitude": sid,
            "latitude": blat,
            "distance_au": dist,
            "speed_deg_per_day": spd,
            "retrograde": spd < 0 and name not in ("Sun", "Moon"),
        }
        if name == "Sun":
            sun_sid = sid

    mean_t = mean_node_tropical(inst)
    true_t = true_node_tropical(inst, o)
    if node == "mean":
        rahu = norm360(mean_t - o.ayan_mean)
    else:
        rahu = norm360(true_t - o.ayan_true)
    ketu = norm360(rahu + 180.0)
    if node == "mean":
        node_speed = -1934.1362891 / 36525.0
    else:
        a_inst, b_inst = inst.shifted(-SPEED_STEP), inst.shifted(SPEED_STEP)
        a = true_node_tropical(a_inst, ctx.orient(a_inst))
        b = true_node_tropical(b_inst, ctx.orient(b_inst))
        node_speed = ((b - a + 180.0) % 360.0 - 180.0) / (2.0 * SPEED_STEP)
    grahas["Rahu"] = {"tropical_longitude": norm360(rahu + o.ayan_true), "longitude": rahu,
                      "latitude": 0.0, "distance_au": None, "speed_deg_per_day": node_speed,
                      "retrograde": node_speed < 0}
    grahas["Ketu"] = {"tropical_longitude": norm360(ketu + o.ayan_true), "longitude": ketu,
                      "latitude": 0.0, "distance_au": None, "speed_deg_per_day": node_speed,
                      "retrograde": node_speed < 0}

    mad, sandhi = sripati_bhavas(asc, mc)
    for name, g in grahas.items():
        sid = g["longitude"]
        g["rashi"] = rashi_info(sid)
        g["nakshatra"] = nakshatra_info(sid)
        g["house_whole_sign"] = (sign_of(sid) - asc_sign) % 12 + 1
        g["house_sripati"] = bhava_of(sid, sandhi)
        g["dignity"] = dignity(name, sid)
        if name in T.COMBUSTION:
            orb = T.COMBUSTION[name][1 if g["retrograde"] else 0]
            sep = abs((sid - sun_sid + 180.0) % 360.0 - 180.0)
            g["sun_separation"] = sep
            g["combust"] = sep < orb
            g["combustion_orb"] = orb
        else:
            g["combust"] = None

    return {
        "instant": {"utc": inst.utc_iso(), "jd_utc": inst.utc, "jd_tt": inst.tt,
                    "delta_t_s": inst.delta_t, "tai_minus_utc": inst.leap},
        "ayanamsa": {"model": ayanamsa_model, "true": o.ayan_true, "mean": o.ayan_mean},
        "obliquity_true": o.true_eps * RAD2DEG,
        "nutation_longitude_arcsec": o.dpsi * RAD2DEG * 3600.0,
        "gast_hours": o.gast_hours,
        "ramc": ramc,
        "lagna": dict(longitude=asc, tropical_longitude=asc_t, speed_deg_per_min=asc_speed,
                      rashi=rashi_info(asc), nakshatra=nakshatra_info(asc)),
        "mc": dict(longitude=mc, rashi=rashi_info(mc)),
        "grahas": grahas,
        "nodes": {"type": node, "mean_rahu": norm360(mean_t - o.ayan_mean),
                  "true_rahu": norm360(true_t - o.ayan_true)},
        "bhavas": {
            "whole_sign": [{"house": i + 1, "rashi": T.RASHIS[(asc_sign + i) % 12],
                            "lord": T.RASHI_LORD[(asc_sign + i) % 12]} for i in range(12)],
            "sripati": [{"house": i + 1, "madhya": mad[i], "sandhi_end": sandhi[i],
                         "rashi": T.RASHIS[sign_of(mad[i])]} for i in range(12)],
        },
    }
