"""Parashari divisional charts (BPHS rules). Always fed full-precision
sidereal longitude; never rounded display values.
"""
from . import tables as T

MOVABLE, FIXED, DUAL = 0, 1, 2


def _quality(sign):
    return sign % 3  # Mesha movable, Vrishabha fixed, Mithuna dual, ...


def _element(sign):
    return sign % 4  # 0 fire, 1 earth, 2 air, 3 water


def _odd(sign):
    return sign % 2 == 0  # Mesha (index 0) is an odd sign


def _equal(n, start_fn):
    def rule(sign, deg):
        span = 30.0 / n
        part = min(int(deg // span), n - 1)
        return (start_fn(sign) + part) % 12, part, (deg - part * span) / span * 30.0
    return rule


def _d2(sign, deg):
    first_half = deg < 15.0
    if _odd(sign):
        target = 4 if first_half else 3
    else:
        target = 3 if first_half else 4
    part = 0 if first_half else 1
    return target, part, (deg - part * 15.0) / 15.0 * 30.0


def _d3(sign, deg):
    part = min(int(deg // 10.0), 2)
    return (sign + (0, 4, 8)[part]) % 12, part, (deg - part * 10.0) * 3.0


def _d4(sign, deg):
    part = min(int(deg // 7.5), 3)
    return (sign + (0, 3, 6, 9)[part]) % 12, part, (deg - part * 7.5) * 4.0


_D30_ODD = ((5, 0, "Mars"), (10, 10, "Saturn"), (18, 8, "Jupiter"),
            (25, 2, "Mercury"), (30, 6, "Venus"))
_D30_EVEN = ((5, 1, "Venus"), (12, 5, "Mercury"), (20, 11, "Jupiter"),
             (25, 9, "Saturn"), (30, 7, "Mars"))


def _d30(sign, deg):
    table = _D30_ODD if _odd(sign) else _D30_EVEN
    lo = 0.0
    for part, (hi, target, _lord) in enumerate(table):
        if deg < hi or part == len(table) - 1:
            return target, part, (deg - lo) / (hi - lo) * 30.0
        lo = hi


RULES = {
    1: lambda s, d: (s, 0, d),
    2: _d2,
    3: _d3,
    4: _d4,
    7: _equal(7, lambda s: s if _odd(s) else s + 6),
    9: _equal(9, lambda s: (0, 9, 6, 3)[_element(s)]),
    10: _equal(10, lambda s: s if _odd(s) else s + 8),
    12: _equal(12, lambda s: s),
    16: _equal(16, lambda s: (0, 4, 8)[_quality(s)]),
    20: _equal(20, lambda s: (0, 8, 4)[_quality(s)]),
    24: _equal(24, lambda s: 4 if _odd(s) else 3),
    27: _equal(27, lambda s: (0, 3, 6, 9)[_element(s)]),
    30: _d30,
    40: _equal(40, lambda s: 0 if _odd(s) else 6),
    45: _equal(45, lambda s: (0, 4, 8)[_quality(s)]),
    60: _equal(60, lambda s: s),
}
NAMES = {1: "Rashi", 2: "Hora", 3: "Drekkana", 4: "Chaturthamsha", 7: "Saptamsha",
         9: "Navamsha", 10: "Dashamsha", 12: "Dvadashamsha", 16: "Shodashamsha",
         20: "Vimshamsha", 24: "Chaturvimshamsha", 27: "Saptavimshamsha",
         30: "Trimshamsha", 40: "Khavedamsha", 45: "Akshavedamsha",
         60: "Shashtyamsha"}


def _part_bounds(n, sign, part):
    """Degree range inside the sign of the division containing the point."""
    if n == 1:
        return 0.0, 30.0
    if n == 30:
        table = _D30_ODD if _odd(sign) else _D30_EVEN
        lo = table[part - 1][0] if part > 0 else 0.0
        return float(lo), float(table[part][0])
    span = 30.0 / n
    return part * span, (part + 1) * span


def varga(n, sid):
    sid %= 360.0
    sign = int(sid // 30.0) % 12
    deg = sid - sign * 30.0
    target, part, tdeg = RULES[n](sign, deg)
    target %= 12
    lo, hi = _part_bounds(n, sign, part)
    return {
        "boundary_margin_deg": min(deg - lo, hi - deg),
        "varga": "D%d" % n,
        "source_sign": sign + 1,
        "source_degree": deg,
        "division_index": part + 1,
        "sign_index": target + 1,
        "sign": T.RASHIS[target],
        "degree": tdeg,
        "lord": T.RASHI_LORD[target],
    }


def all_vargas(points):
    """points: {name: sidereal longitude}. Returns {Dn: {name: info}}."""
    out = {}
    for n in sorted(RULES):
        out["D%d" % n] = {
            "name": NAMES[n],
            "positions": {k: varga(n, v) for k, v in points.items()},
        }
    return out
