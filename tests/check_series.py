"""Series interpolation vs. exact engine: boundary-time differences and speed."""
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "engine"))

from astro_engine.ephemeris import Ephemeris, file_loader, set_default  # noqa: E402

set_default(Ephemeris(file_loader(os.path.join(HERE, "..", "web", "eph"))))

from astro_engine.panchanga import Engine  # noqa: E402
from astro_engine.series import Series, crossings, stations  # noqa: E402
from astro_engine.timescale import julian_day, format_jd  # noqa: E402
from astro_engine.constants import NAKSHATRA_SPAN  # noqa: E402

t0 = julian_day(2027, 1, 1)
t1 = julian_day(2028, 1, 1)
a = time.time()
s = Series(t0, t1, ["Sun", "Moon"])
b = time.time()
tith = crossings(s.elongation, 12.0, t0, t1)
naks = crossings(lambda t: s.lon("Moon", t), NAKSHATRA_SPAN, t0, t1)
c = time.time()
print("sample year %.2fs, solve %.2fs, tithis %d naks %d" % (b - a, c - b, len(tith), len(naks)))

eng = Engine()
worst = 0.0
for t, k, d in tith[::7]:
    idx, start, end = eng.interval(eng.elongation, 12.0, t + 1e-4, 0.25)
    worst = max(worst, abs(start - t) * 86400)
for t, k, d in naks[::7]:
    idx, start, end = eng.interval(eng.moon_sid, NAKSHATRA_SPAN, t + 1e-4, 0.25)
    worst = max(worst, abs(start - t) * 86400)
print("worst boundary difference vs exact: %.3f s" % worst)

a = time.time()
sp = Series(t0, t1 + 3650, ["Sun", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Rahu"],
            step=4.0)
b = time.time()
st = stations(sp, "Mercury", t0, t1)
ing = crossings(lambda t: sp.lon("Saturn", t), 30.0, t0, t1 + 3650, scan=4.0)
print("10y planets sample %.2fs; Mercury stations 2027:" % (b - a))
for t, kind in st:
    print("   ", format_jd(t + 330 / 1440.0), kind)
print("Saturn ingresses 2027-2037:", [(format_jd(t + 330 / 1440.0)[:16], k % 12, d) for t, k, d in ing])
