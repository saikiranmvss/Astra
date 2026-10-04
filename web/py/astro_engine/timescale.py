"""Time scales: UTC, TAI, TT, TDB, UT1 and Julian dates.

UTC -> TAI uses the official leap-second table (1972 onward).
TT = TAI + 32.184 s.
UT1 = UTC for 1972+ (|UT1 - UTC| < 0.9 s by definition of UTC).
Before 1972 civil time is treated as UT and TT = UT + Delta T
(Espenak & Meeus polynomial fits to historical observations).
"""
import math

from .constants import DAY_S, J2000

# (UTC calendar date the offset takes effect, TAI - UTC seconds)
LEAP_SECONDS = (
    ((1972, 1, 1), 10), ((1972, 7, 1), 11), ((1973, 1, 1), 12),
    ((1974, 1, 1), 13), ((1975, 1, 1), 14), ((1976, 1, 1), 15),
    ((1977, 1, 1), 16), ((1978, 1, 1), 17), ((1979, 1, 1), 18),
    ((1980, 1, 1), 19), ((1981, 7, 1), 20), ((1982, 7, 1), 21),
    ((1983, 7, 1), 22), ((1985, 7, 1), 23), ((1988, 1, 1), 24),
    ((1990, 1, 1), 25), ((1991, 1, 1), 26), ((1992, 7, 1), 27),
    ((1993, 7, 1), 28), ((1994, 7, 1), 29), ((1996, 1, 1), 30),
    ((1997, 7, 1), 31), ((1999, 1, 1), 32), ((2006, 1, 1), 33),
    ((2009, 1, 1), 34), ((2012, 7, 1), 35), ((2015, 7, 1), 36),
    ((2017, 1, 1), 37),
)
TT_MINUS_TAI = 32.184


def julian_day(year, month, day, hour=0, minute=0, second=0.0):
    """Proleptic Gregorian calendar to Julian Date."""
    a = (14 - month) // 12
    y = year + 4800 - a
    m = month + 12 * a - 3
    jdn = day + (153 * m + 2) // 5 + 365 * y + y // 4 - y // 100 + y // 400 - 32045
    return jdn - 0.5 + (hour + minute / 60.0 + second / 3600.0) / 24.0


def calendar(jd):
    """Julian Date to (year, month, day, hour, minute, second)."""
    z = math.floor(jd + 0.5)
    f = jd + 0.5 - z
    a = z + 32044
    b = (4 * a + 3) // 146097
    c = a - 146097 * b // 4
    d = (4 * c + 3) // 1461
    e = c - 1461 * d // 4
    m = (5 * e + 2) // 153
    day = int(e - (153 * m + 2) // 5 + 1)
    month = int(m + 3 - 12 * (m // 10))
    year = int(100 * b + d - 4800 + m // 10)
    secs = f * DAY_S
    hour = int(secs // 3600)
    minute = int((secs - hour * 3600) // 60)
    second = secs - hour * 3600 - minute * 60
    return year, month, day, hour, minute, second


_LEAP_JD = tuple((julian_day(*d), off) for d, off in LEAP_SECONDS)
FIRST_LEAP_JD = _LEAP_JD[0][0]


def tai_minus_utc(jd_utc):
    off = None
    for jd, o in _LEAP_JD:
        if jd_utc >= jd:
            off = o
        else:
            break
    return off


def delta_t_polynomial(year):
    """Delta T = TT - UT in seconds (Espenak & Meeus, NASA)."""
    y = year
    if y < 1860:
        t = y - 1800
        return (13.72 - 0.332447 * t + 0.0068612 * t ** 2 + 0.0041116 * t ** 3
                - 0.00037436 * t ** 4 + 0.0000121272 * t ** 5
                - 0.0000001699 * t ** 6 + 0.000000000875 * t ** 7)
    if y < 1900:
        t = y - 1860
        return (7.62 + 0.5737 * t - 0.251754 * t ** 2 + 0.01680668 * t ** 3
                - 0.0004473624 * t ** 4 + t ** 5 / 233174.0)
    if y < 1920:
        t = y - 1900
        return -2.79 + 1.494119 * t - 0.0598939 * t ** 2 + 0.0061966 * t ** 3 - 0.000197 * t ** 4
    if y < 1941:
        t = y - 1920
        return 21.20 + 0.84493 * t - 0.076100 * t ** 2 + 0.0020936 * t ** 3
    if y < 1961:
        t = y - 1950
        return 29.07 + 0.407 * t - t ** 2 / 233.0 + t ** 3 / 2547.0
    t = y - 1975
    return 45.45 + 1.067 * t - t ** 2 / 260.0 - t ** 3 / 718.0


def tdb_minus_tt(jd_tt):
    g = math.radians(357.53 + 0.98560028 * (jd_tt - J2000))
    return 0.001657 * math.sin(g) + 0.000014 * math.sin(2.0 * g)


class Instant(object):
    """A moment expressed on every required time scale (Julian Dates)."""

    __slots__ = ("utc", "tt", "tdb", "ut1", "delta_t", "leap")

    def __init__(self, jd_utc, jd_tt, jd_ut1, leap):
        self.utc = jd_utc
        self.tt = jd_tt
        self.ut1 = jd_ut1
        self.tdb = jd_tt + tdb_minus_tt(jd_tt) / DAY_S
        self.delta_t = (jd_tt - jd_ut1) * DAY_S
        self.leap = leap

    @classmethod
    def from_utc_jd(cls, jd_utc):
        if jd_utc >= FIRST_LEAP_JD:
            leap = tai_minus_utc(jd_utc)
            tt = jd_utc + (leap + TT_MINUS_TAI) / DAY_S
            return cls(jd_utc, tt, jd_utc, leap)
        year = calendar(jd_utc)[0] + (jd_utc - julian_day(calendar(jd_utc)[0], 1, 1)) / 365.25
        dt = delta_t_polynomial(year)
        return cls(jd_utc, jd_utc + dt / DAY_S, jd_utc, None)

    @classmethod
    def from_tt_jd(cls, jd_tt):
        guess = jd_tt - 69.0 / DAY_S
        for _ in range(3):
            probe = cls.from_utc_jd(guess)
            guess += jd_tt - probe.tt
        return cls.from_utc_jd(guess)

    @classmethod
    def from_utc(cls, year, month, day, hour=0, minute=0, second=0.0):
        return cls.from_utc_jd(julian_day(year, month, day, hour, minute, second))

    def shifted(self, days):
        """Same instant moved by `days` of UTC (used by root solvers)."""
        return Instant.from_utc_jd(self.utc + days)

    def utc_iso(self, offset_minutes=0):
        return format_jd(self.utc + offset_minutes / 1440.0)


def format_jd(jd):
    """Julian Date to ISO text rounded to the nearest second."""
    jd = math.floor(jd * DAY_S + 0.5) / DAY_S
    y, mo, d, h, mi, s = calendar(jd + 1e-7)
    return "%04d-%02d-%02dT%02d:%02d:%02d" % (y, mo, d, h, mi, int(s))
