"""Smoke-test every API kind and print timings (CPython)."""
import json
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "engine"))

from astro_engine.ephemeris import Ephemeris, file_loader, set_default  # noqa: E402

set_default(Ephemeris(file_loader(os.path.join(HERE, "..", "web", "eph"))))

from astro_engine import api  # noqa: E402

HYD = {"lat": 17.385, "lon": 78.4867, "tz_minutes": 330}
BIRTH = {"date": "1998-12-10", "time": "18:10:00", "tz_minutes": 330,
         "lat": 18.576216339514087, "lon": 83.3587995791954}
CASES = [
    ("chart", BIRTH),
    ("panchanga", dict(HYD, date="2027-01-08")),
    ("calendar", dict(HYD, year=2027, month=4)),
    ("festivals", dict(HYD, year=2027)),
    ("search", dict(HYD, start="2027-01-01", end="2027-12-31",
                    categories=["tithi", "nakshatra", "lunation", "sankranti", "ingress",
                                "station", "combustion", "conjunction", "moon_sign", "yoga",
                                "karana", "nakshatra_ingress"])),
    ("search", dict(HYD, start="2027-01-01", end="2046-12-31",
                    categories=["ingress", "station"], planets=["Jupiter", "Saturn", "Rahu"])),
    ("transits", dict(HYD, date="2026-10-03", time="12:00:00", birth_date=BIRTH["date"],
                      birth_time=BIRTH["time"], birth_tz_minutes=330, birth_lat=BIRTH["lat"],
                      birth_lon=BIRTH["lon"])),
    ("match", {"groom": BIRTH, "bride": dict(BIRTH, date="2000-03-15", time="07:30:00")}),
    ("muhurta", dict(HYD, start="2027-01-01", end="2027-03-31", activity="marriage")),
    ("eclipses", dict(HYD, start="2026-01-01", end="2030-12-31")),
]
dump = sys.argv[1] if len(sys.argv) > 1 else None
if dump:
    os.makedirs(dump, exist_ok=True)
for i, (kind, params) in enumerate(CASES):
    t = time.time()
    r = api.dispatch(kind, params)
    size = len(json.dumps(r))
    if dump:
        with open(os.path.join(dump, "%d_%s.json" % (i, kind)), "w") as fh:
            json.dump(r, fh, indent=1)
    extra = r.get("count", "")
    print("%-10s %6.2fs  %7d bytes  %s" % (kind, time.time() - t, size, extra))
