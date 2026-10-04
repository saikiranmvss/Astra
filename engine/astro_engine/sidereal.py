"""Ayanamsa models.

A sidereal zero point is a fixed inertial direction defined by an
ayanamsa value at an anchor epoch. Its longitude on the ecliptic of any
date (IAU 2006 precession; plus IAU 2000A nutation for the true value)
is the ayanamsa of that date. Nothing is a fixed "subtract 24 deg".
"""
import math

from .constants import DEG2RAD, RAD2DEG
from .earth import Orientation, nutation
from .timescale import Instant
from .vec import mtxv, mxv, spherical

# name -> (anchor JD TT, anchor value in degrees, value_is_true)
MODELS = {
    # Indian Astronomical Ephemeris / Rashtriya Panchang convention:
    # true ayanamsa 23 deg 15' 00.658" on 1956-03-21 0h TT.
    "lahiri": (2435553.5, 23.0 + 15.0 / 60.0 + 0.658 / 3600.0, True),
    # Calendar Reform Committee wording read as a mean value: 23 deg 15' 00".
    "lahiri_icrc_mean": (2435553.5, 23.25, False),
}
LABELS = {
    "lahiri": "Lahiri / Citrapaksha (IAE true 23d15m00.658s at 1956-03-21 0h TT)",
    "lahiri_icrc_mean": "Lahiri / Citrapaksha (mean 23d15m00s at 1956-03-21 0h TT)",
}

_zero_cache = {}


def _zero_vector(model):
    v = _zero_cache.get(model)
    if v is not None:
        return v
    jd_tt, value, is_true = MODELS[model]
    inst = Instant.from_tt_jd(jd_tt)
    orient = Orientation(inst)
    if is_true:
        dpsi, _ = nutation(inst.tt)
        mean_value = value - dpsi * RAD2DEG
    else:
        mean_value = value
    lam = mean_value * DEG2RAD
    v = mtxv(orient.ecl_mean, [math.cos(lam), math.sin(lam), 0.0])
    _zero_cache[model] = v
    return v


def ayanamsa(orient, model="lahiri"):
    """Return (true_deg, mean_deg) ayanamsa for the orientation's instant."""
    v = _zero_vector(model)
    _, _, lt = spherical(mxv(orient.ecl_true, v))
    _, _, lm = spherical(mxv(orient.ecl_mean, v))
    return lt * RAD2DEG, lm * RAD2DEG
