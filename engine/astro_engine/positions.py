"""Apparent geocentric / topocentric positions from DE440.

Pipeline: barycentric states -> light-time iteration -> solar light
deflection -> relativistic aberration -> GCRS vector -> rotate to the
true ecliptic / true equator of date.
"""
import math

from . import ephemeris
from .constants import (AU_KM, AU_M, C_AUDAY, C_M_S, DEG2RAD, EARTH_ANGVEL,
                        EARTH_FLATTENING, ERAD_KM, GS, RAD2DEG, DAY_S)
from .vec import add, dot, mxv, norm, scale, spherical, sub

# body name -> chain of (center, target) segments from the SSB
CHAINS = {
    "sun": ((0, 10),),
    "moon": ((0, 3), (3, 301)),
    "earth": ((0, 3), (3, 399)),
    "mercury": ((0, 1), (1, 199)),
    "venus": ((0, 2), (2, 299)),
    "mars": ((0, 4),),
    "jupiter": ((0, 5),),
    "saturn": ((0, 6),),
    "uranus": ((0, 7),),
    "neptune": ((0, 8),),
    "pluto": ((0, 9),),
}
KM_PER_DAY_TO_AU_PER_DAY = 1.0 / AU_KM


def barycentric(body, jd_tdb, eph=None):
    """Barycentric position (au) and velocity (au/day)."""
    eph = eph or ephemeris.default()
    p = [0.0, 0.0, 0.0]
    v = [0.0, 0.0, 0.0]
    for center, target in CHAINS[body]:
        pp, vv = eph.state(center, target, jd_tdb)
        p = add(p, pp)
        v = add(v, vv)
    return scale(p, 1.0 / AU_KM), scale(v, KM_PER_DAY_TO_AU_PER_DAY)


def observer_offset(orient, lat_deg, lon_deg, elev_m=0.0):
    """Geocentric GCRS position (au) and velocity (au/day) of a site."""
    lat = lat_deg * DEG2RAD
    lon = lon_deg * DEG2RAD
    f = EARTH_FLATTENING
    e2 = f * (2.0 - f)
    sl = math.sin(lat)
    n = ERAD_KM / math.sqrt(1.0 - e2 * sl * sl)
    h = elev_m / 1000.0
    x = (n + h) * math.cos(lat) * math.cos(lon)
    y = (n + h) * math.cos(lat) * math.sin(lon)
    z = (n * (1.0 - e2) + h) * sl
    r_itrs = [x, y, z]
    v_itrs = [-EARTH_ANGVEL * y * DAY_S, EARTH_ANGVEL * x * DAY_S, 0.0]
    rot = orient.itrs_to_gcrs()
    pos = scale(mxv(rot, r_itrs), 1.0 / AU_KM)
    vel = scale(mxv(rot, v_itrs), 1.0 / AU_KM)
    return pos, vel


def _deflect_by_sun(pos, obs_bary, sun_bary):
    """Gravitational light deflection by the Sun (IERS / Kaplan formula)."""
    pe = sub(obs_bary, sun_bary)
    pmag = norm(pos)
    emag = norm(pe)
    pq = add(pos, pe)
    qmag = norm(pq)
    phat = scale(pos, 1.0 / pmag)
    qhat = scale(pq, 1.0 / qmag)
    ehat = scale(pe, 1.0 / emag)
    pdotq = dot(phat, qhat)
    qdote = dot(qhat, ehat)
    edotp = dot(ehat, phat)
    if abs(edotp) > 0.99999999999:
        return pos
    fac1 = 2.0 * GS / (C_M_S * C_M_S * emag * AU_M)
    fac2 = 1.0 + qdote
    corr = scale(sub(scale(ehat, pdotq), scale(qhat, edotp)), fac1 / fac2 * pmag)
    return add(pos, corr)


def _aberrate(pos, vel, light_time):
    p1mag = light_time * C_AUDAY
    vemag = norm(vel)
    beta = vemag / C_AUDAY
    d = dot(pos, vel)
    cosd = d / (p1mag * vemag + 1e-23)
    gammai = math.sqrt(1.0 - beta * beta)
    p = beta * cosd
    q = (1.0 + p / (1.0 + gammai)) * light_time
    r = 1.0 + p
    return [(pos[i] * gammai + q * vel[i]) / r for i in range(3)]


def apparent_gcrs(body, inst, orient=None, site=None, geometric=False):
    """Apparent GCRS vector (au) of body seen from geocenter or a site.

    site = (lat_deg, lon_deg, elev_m) for topocentric positions.
    """
    jd = inst.tdb
    e_pos, e_vel = barycentric("earth", jd)
    if site is not None:
        o_pos, o_vel = observer_offset(orient, site[0], site[1], site[2])
        e_pos = add(e_pos, o_pos)
        e_vel = add(e_vel, o_vel)
    t_pos, _ = barycentric(body, jd)
    rel = sub(t_pos, e_pos)
    lt = norm(rel) / C_AUDAY
    if geometric:
        return rel
    for _ in range(10):
        t_pos, _ = barycentric(body, jd - lt)
        rel = sub(t_pos, e_pos)
        new_lt = norm(rel) / C_AUDAY
        if abs(new_lt - lt) < 1e-12:
            lt = new_lt
            break
        lt = new_lt
    if body != "sun":
        sun_pos, _ = barycentric("sun", jd)
        rel = _deflect_by_sun(rel, e_pos, sun_pos)
    return _aberrate(rel, e_vel, lt)


def ecliptic_of_date(vec, orient):
    """(lon_deg, lat_deg, dist_au) on the true ecliptic & equinox of date."""
    r, lat, lon = spherical(mxv(orient.ecl_true, vec))
    return lon * RAD2DEG, lat * RAD2DEG, r


def equatorial_of_date(vec, orient):
    """(ra_deg, dec_deg, dist_au) on the true equator & equinox of date."""
    r, dec, ra = spherical(mxv(orient.M, vec))
    return ra * RAD2DEG, dec * RAD2DEG, r


def geocentric_moon_state_ecliptic(inst, orient):
    """Geometric geocentric Moon position/velocity in ecliptic of date (km, km/day)."""
    eph = ephemeris.default()
    pm, vm = eph.state(3, 301, inst.tdb)
    pe, ve = eph.state(3, 399, inst.tdb)
    p = sub(pm, pe)
    v = sub(vm, ve)
    return mxv(orient.ecl_true, p), mxv(orient.ecl_true, v)
