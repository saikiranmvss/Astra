"""Compare the pure-Python core with Skyfield on DE440s (independent code)."""
import math
import os
import random
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "engine"))

from skyfield.api import load, wgs84  # noqa: E402
from skyfield.framelib import ecliptic_frame  # noqa: E402

from astro_engine import ephemeris  # noqa: E402
from astro_engine.earth import Orientation  # noqa: E402
from astro_engine.positions import apparent_gcrs, ecliptic_of_date  # noqa: E402
from astro_engine.timescale import Instant  # noqa: E402

ephemeris.set_default(ephemeris.Ephemeris(ephemeris.file_loader(os.path.join(ROOT, "web", "eph"))))
ts = load.timescale()
sk = load(os.path.join(ROOT, "de440s.bsp"))
SKN = {
    "sun": "sun", "moon": "moon", "mercury": "mercury", "venus": "venus",
    "mars": "mars barycenter", "jupiter": "jupiter barycenter",
    "saturn": "saturn barycenter",
}


def wrap(d):
    return (d + 180.0) % 360.0 - 180.0


def main():
    random.seed(7)
    worst = {k: 0.0 for k in list(SKN) + ["gast_s", "moon_topo"]}
    n = 60
    t0 = time.time()
    for _ in range(n):
        year = random.randint(1900, 2099)
        jd = random.uniform(0, 365) + 2451545.0 + (year - 2000) * 365.25
        inst = Instant.from_utc_jd(jd)
        orient = Orientation(inst)
        y, mo, d, h, mi, s = __import__("astro_engine.timescale", fromlist=["calendar"]).calendar(jd)
        # compare at the identical TT instant (time-scale policy is tested separately)
        t = ts.tt_jd(inst.tt)
        for name, skn in SKN.items():
            ours, _, _ = ecliptic_of_date(apparent_gcrs(name, inst, orient), orient)
            app = sk["earth"].at(t).observe(sk[skn]).apparent()
            _lat, lon, _ = app.frame_latlon(ecliptic_frame)
            diff = abs(wrap(ours - lon.degrees)) * 3600.0
            worst[name] = max(worst[name], diff)
        site = (17.385, 78.4867, 500.0)
        ours, _, _ = ecliptic_of_date(apparent_gcrs("moon", inst, orient, site=site), orient)
        obs = sk["earth"] + wgs84.latlon(site[0], site[1], site[2])
        app = obs.at(t).observe(sk["moon"]).apparent()
        _lat, lon, _ = app.frame_latlon(ecliptic_frame)
        worst["moon_topo"] = max(worst["moon_topo"], abs(wrap(ours - lon.degrees)) * 3600.0)
        if inst.leap is not None:
            g_ours = orient.gast_hours
            g_sk = ts.tt_jd(inst.tt, ).gast
            # skyfield UT1 from IERS table differs from our UT1=UTC by DUT1
            dut1 = (ts.tt_jd(inst.tt).ut1 - inst.ut1) * 86400.0
            corr = dut1 * 1.00273781191135448 / 3600.0
            worst["gast_s"] = max(worst["gast_s"], abs((g_ours + corr - g_sk) * 3600.0))
    print("samples", n, "seconds", round(time.time() - t0, 2))
    for k, v in worst.items():
        unit = "s(time)" if k == "gast_s" else "arcsec"
        print("%-10s worst %.5f %s" % (k, v, unit))


if __name__ == "__main__":
    main()
