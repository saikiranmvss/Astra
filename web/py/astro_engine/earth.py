"""Earth orientation: frame bias, IAU 2006 precession, IAU 2000A nutation,
obliquity, Earth Rotation Angle and Greenwich sidereal time.
"""
import math

from . import nutation_data as nd
from .constants import ASEC2RAD, ASEC360, J2000, TAU
from .vec import mxm, rot_x, rot_z

# ICRS -> J2000 dynamical frame bias (IERS 2003)
FRAME_BIAS = [
    [0.9999999999999942, -7.078279744199226e-08, 8.056148938997159e-08],
    [7.078279744199226e-08, 0.999999999999997, 3.3060414542221477e-08],
    [-8.056148938997159e-08, -3.3060414542221477e-08, 0.9999999999999962],
]
_TENTH_UAS = ASEC2RAD / 1e7


def centuries(jd):
    return (jd - J2000) / 36525.0


def mean_obliquity(jd_tdb):
    """IAU 2006 mean obliquity of the ecliptic, radians."""
    t = centuries(jd_tdb)
    eps = (((((-0.0000000434 * t - 0.000000576) * t + 0.00200340) * t
             - 0.0001831) * t - 46.836769) * t + 84381.406)
    return eps * ASEC2RAD


def precession_matrix(jd_tdb):
    """IAU 2006 (Capitaine et al. 2003) 4-angle precession, J2000 -> mean of date."""
    eps0 = 84381.406
    t = centuries(jd_tdb)
    psia = ((((-0.0000000951 * t + 0.000132851) * t - 0.00114045) * t
             - 1.0790069) * t + 5038.481507) * t
    omegaa = ((((+0.0000003337 * t - 0.000000467) * t - 0.00772503) * t
               + 0.0512623) * t - 0.025754) * t + eps0
    chia = ((((-0.0000000560 * t + 0.000170663) * t - 0.00121197) * t
             - 2.3814292) * t + 10.556403) * t
    eps0 *= ASEC2RAD
    psia *= ASEC2RAD
    omegaa *= ASEC2RAD
    chia *= ASEC2RAD
    sa, ca = math.sin(eps0), math.cos(eps0)
    sb, cb = math.sin(-psia), math.cos(-psia)
    sc, cc = math.sin(-omegaa), math.cos(-omegaa)
    sd, cd = math.sin(chia), math.cos(chia)
    return [
        [cd * cb - sb * sd * cc,
         cd * sb * ca + sd * cc * cb * ca - sa * sd * sc,
         cd * sb * sa + sd * cc * cb * sa + ca * sd * sc],
        [-sd * cb - sb * cd * cc,
         -sd * sb * ca + cd * cc * cb * ca - sa * cd * sc,
         -sd * sb * sa + cd * cc * cb * sa + ca * cd * sc],
        [sb * sc,
         -sc * cb * ca - sa * cc,
         -sc * cb * sa + cc * ca],
    ]


_FA = (
    (485868.249036, 1717915923.2178, 31.8792, 0.051635, -0.00024470),
    (1287104.79305, 129596581.0481, -0.5532, 0.000136, -0.00001149),
    (335779.526232, 1739527262.8478, -12.7512, -0.001037, 0.00000417),
    (1072260.70369, 1602961601.2090, -6.3706, 0.006593, -0.00003169),
    (450160.398036, -6962890.5431, 7.4722, 0.007702, -0.00005939),
)
_PL_CONST = (2.35555598, 6.24006013, 1.627905234, 5.198466741, 2.18243920,
             4.402608842, 3.176146697, 1.753470314, 6.203480913, 0.599546497,
             0.874016757, 5.481293871, 5.321159000, 0.02438175)
_PL_RATE = (8328.6914269554, 628.301955, 8433.466158131, 7771.3771468121,
            -33.757045, 2608.7903141574, 1021.3285546211, 628.3075849991,
            334.0612426700, 52.9690962641, 21.3299104960, 7.4781598567,
            3.8127774000, 0.00000538691)


def _iau2000a_raw(jd_tt):
    """IAU 2000A nutation (delta psi, delta epsilon) in radians."""
    t = centuries(jd_tt)
    a = []
    for c0, c1, c2, c3, c4 in _FA:
        v = (((c4 * t + c3) * t + c2) * t + c1) * t + c0
        a.append(math.fmod(v, ASEC360) * ASEC2RAD)
    dpsi = 0.0
    deps = 0.0
    sin, cos = math.sin, math.cos
    for (n0, n1, n2, n3, n4), (l0, l1, l2), (o0, o1, o2) in zip(nd.NALS, nd.LS_LON, nd.LS_OBL):
        arg = n0 * a[0] + n1 * a[1] + n2 * a[2] + n3 * a[3] + n4 * a[4]
        s, c = sin(arg), cos(arg)
        dpsi += (l0 + l1 * t) * s + l2 * c
        deps += (o0 + o1 * t) * c + o2 * s
    pa = [c + r * t for c, r in zip(_PL_CONST, _PL_RATE)]
    pa[-1] *= t
    for row, (pl0, pl1), (po0, po1) in zip(nd.NAPL, nd.PL_LON, nd.PL_OBL):
        arg = 0.0
        for k, coef in enumerate(row):
            if coef:
                arg += coef * pa[k]
        s, c = sin(arg), cos(arg)
        dpsi += pl0 * s + pl1 * c
        deps += po0 * s + po1 * c
    return dpsi * _TENTH_UAS, deps * _TENTH_UAS


_NUT_STEP = 1.0
_NUT_OFFSETS = (-3, -2, -1, 0, 1, 2, 3, 4)
_nut_cache = {}


def _nut_node(key):
    v = _nut_cache.get(key)
    if v is None:
        if len(_nut_cache) > 6000:
            _nut_cache.clear()
        v = _iau2000a_raw(key * _NUT_STEP)
        _nut_cache[key] = v
    return v


def lagrange_weights(u, offsets):
    """Weights of the Lagrange polynomial through integer `offsets`, at u."""
    w = []
    for i in offsets:
        p = 1.0
        for j in offsets:
            if j != i:
                p *= (u - j) / float(i - j)
        w.append(p)
    return w


def nutation(jd_tt, exact=False):
    """IAU 2000A nutation, 8-point Lagrange interpolation on a 1-day grid.

    Measured interpolation error is below 1e-5 arcsec over 1850-2150
    because the shortest significant nutation periods are several days.
    """
    if exact:
        return _iau2000a_raw(jd_tt)
    x = jd_tt / _NUT_STEP
    k = int(math.floor(x))
    w = lagrange_weights(x - k, _NUT_OFFSETS)
    dpsi = deps = 0.0
    for wi, off in zip(w, _NUT_OFFSETS):
        p = _nut_node(k + off)
        dpsi += wi * p[0]
        deps += wi * p[1]
    return dpsi, deps


def nutation_exact(jd_tt):
    return _iau2000a_raw(jd_tt)


_eqeq_cache = {}


def eqeq_complementary_cached(jd_tt):
    """Complementary terms change by far less than a microarcsecond per day."""
    key = math.floor(jd_tt)
    v = _eqeq_cache.get(key)
    if v is None:
        if len(_eqeq_cache) > 2000:
            _eqeq_cache.clear()
        v = eqeq_complementary(key + 0.5)
        _eqeq_cache[key] = v
    return v


def nutation_matrix(mean_eps, true_eps, dpsi):
    cobm, sobm = math.cos(mean_eps), math.sin(mean_eps)
    cobt, sobt = math.cos(true_eps), math.sin(true_eps)
    cpsi, spsi = math.cos(dpsi), math.sin(dpsi)
    return [
        [cpsi, -spsi * cobm, -spsi * sobm],
        [spsi * cobt, cpsi * cobm * cobt + sobm * sobt, cpsi * sobm * cobt - cobm * sobt],
        [spsi * sobt, cpsi * cobm * sobt - sobm * cobt, cpsi * sobm * sobt + cobm * cobt],
    ]


def eqeq_complementary(jd_tt):
    """Complementary terms of the equation of the equinoxes, radians."""
    t = centuries(jd_tt)
    fa = []
    for c0, c1, c2, c3, c4 in _FA:
        v = (((c4 * t + c3) * t + c2) * t + c1) * t + c0
        fa.append(math.fmod(v, ASEC360) * ASEC2RAD)
    fa += [
        4.402608842 + 2608.7903141574 * t,
        3.176146697 + 1021.3285546211 * t,
        1.753470314 + 628.3075849991 * t,
        6.203480913 + 334.0612426700 * t,
        0.599546497 + 52.9690962641 * t,
        0.874016757 + 21.3299104960 * t,
        5.481293872 + 7.4781598567 * t,
        5.311886287 + 3.8133035638 * t,
        (0.024381750 + 0.00000538691 * t) * t,
    ]
    fa = [x % TAU for x in fa]
    a = sum(k * f for k, f in zip(nd.KE1, fa))
    c_terms = (-0.87e-6 * math.sin(a)) * t
    for row, s0, c0 in zip(nd.KE0, nd.SE0_S, nd.SE0_C):
        arg = sum(k * f for k, f in zip(row, fa) if k)
        c_terms += s0 * math.sin(arg) + c0 * math.cos(arg)
    return c_terms * ASEC2RAD


class Orientation(object):
    """All Earth-orientation quantities for one instant."""

    def __init__(self, inst, nutation_mode="grid"):
        """nutation_mode: 'grid' (interpolated IAU 2000A), 'exact', or 'none'
        (mean equator/ecliptic; only for coarse long-range scans)."""
        self.inst = inst
        self.mean_eps = mean_obliquity(inst.tdb)
        if nutation_mode == "none":
            self.dpsi, self.deps = 0.0, 0.0
        else:
            self.dpsi, self.deps = nutation(inst.tt, nutation_mode == "exact")
        self.true_eps = self.mean_eps + self.deps
        self.P = precession_matrix(inst.tdb)
        self.N = nutation_matrix(self.mean_eps, self.true_eps, self.dpsi)
        self.PB = mxm(self.P, FRAME_BIAS)
        self.M = mxm(self.N, self.PB)  # ICRS -> true equator & equinox of date
        self.ecl_true = mxm(rot_x(-self.true_eps), self.M)
        self.ecl_mean = mxm(rot_x(-self.mean_eps), self.PB)
        self._gast = None

    @property
    def gast_hours(self):
        if self._gast is None:
            inst = self.inst
            th = 0.7790572732640 + 0.00273781191135448 * (inst.ut1 - J2000)
            era = (th % 1.0 + inst.ut1 % 1.0) % 1.0
            t = centuries(inst.tdb)
            st = (0.014506 + ((((-0.0000000368 * t - 0.000029956) * t
                                - 0.00000044) * t + 1.3915817) * t
                              + 4612.156534) * t)
            gmst = (st / 54000.0 + era * 24.0) % 24.0
            eqeq = self.dpsi * math.cos(self.mean_eps) + eqeq_complementary_cached(inst.tt)
            self._gast = (gmst + eqeq / TAU * 24.0) % 24.0
        return self._gast

    def itrs_to_gcrs(self):
        """Rotation taking terrestrial (no polar motion) to GCRS axes."""
        r = rot_z(self.gast_hours * TAU / 24.0)
        # GCRS = M^T * R3(GAST) * ITRS
        mt = [[self.M[j][i] for j in range(3)] for i in range(3)]
        return mxm(mt, r)
