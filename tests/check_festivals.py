"""Print the 2027 festival list for Hyderabad and time it."""
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "engine"))

from astro_engine.ephemeris import Ephemeris, file_loader, set_default  # noqa: E402

set_default(Ephemeris(file_loader(os.path.join(HERE, "..", "web", "eph"))))

from astro_engine import festivals  # noqa: E402

year = int(sys.argv[1]) if len(sys.argv) > 1 else 2027
cats = sys.argv[2].split(",") if len(sys.argv) > 2 else None
t = time.time()
r = festivals.festival_year({"year": year, "lat": 17.385, "lon": 78.4867, "tz_minutes": 330,
                             "categories": cats})
print("count", r["count"], "seconds", round(time.time() - t, 2))
for e in r["festivals"]:
    extra = ""
    if e.get("vaishnava_date") and e["vaishnava_date"] != e["date"]:
        extra = "  [Vaishnava %s]" % e["vaishnava_date"]
    print(e["date"], "%-9s" % e["category"], e["name"], "|", e["resolution"], extra)
