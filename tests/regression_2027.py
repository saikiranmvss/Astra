"""2027 regression cases from the project manual, plus independent checks
against Skyfield's almanac (separate code base, same DE440s data).
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "engine"))

from skyfield import almanac  # noqa: E402
from skyfield.api import load, wgs84  # noqa: E402

from astro_engine import api, ephemeris  # noqa: E402
from astro_engine.panchanga import Engine  # noqa: E402
from astro_engine.timescale import format_jd, julian_day  # noqa: E402

ephemeris.set_default(ephemeris.Ephemeris(ephemeris.file_loader(os.path.join(ROOT, "web", "eph"))))
HYD = dict(lat=17.385, lon=78.4867, tz_minutes=330)
IST = 330 / 1440.0
results = []


def check(name, ok, detail=""):
    results.append((name, ok, detail))
    print("%-5s %-55s %s" % ("PASS" if ok else "FAIL", name, detail))


def day(date):
    return api.dispatch("panchanga", dict(HYD, date=date))


def at_sunrise(p, key):
    return p[key][0]


def main():
    eng = Engine()
    ts = load.timescale()
    sk = load(os.path.join(ROOT, "de440s.bsp"))

    # --- New Moons: engine vs Skyfield almanac ---
    t0, t1 = ts.utc(2027, 1, 1), ts.utc(2028, 1, 1)
    times, phases = almanac.find_discrete(t0, t1, almanac.moon_phases(sk))
    sk_new = [t for t, ph in zip(times, phases) if ph == 0]
    # manual section 44 lists New Moon dates in UTC
    expected_dates = ["2027-01-07", "2027-02-06", "2027-03-08", "2027-04-06", "2027-05-06",
                      "2027-06-04", "2027-07-04", "2027-08-02", "2027-08-31", "2027-09-30",
                      "2027-10-29", "2027-11-28", "2027-12-27"]
    worst = 0.0
    for t, exp in zip(sk_new, expected_dates):
        jd_sk_utc = t.tt - (69.184 / 86400.0)
        ours = eng.new_moon_after(jd_sk_utc - 1.0)
        diff = abs(ours - jd_sk_utc) * 86400.0
        worst = max(worst, diff)
        check("New Moon %s (UTC date)" % exp, format_jd(ours)[:10] == exp,
              "ours %s UTC / %s IST, |ours-skyfield| %.3fs"
              % (format_jd(ours), format_jd(ours + IST)[11:], diff))
    check("New Moon timing vs Skyfield worst < 1 s", worst < 1.0, "%.3f s" % worst)
    jan = eng.new_moon_after(julian_day(2027, 1, 7))
    check("Jan 2027 New Moon ~ 2027-01-07 20:24:25 UTC (manual)",
          abs(jan - julian_day(2027, 1, 7, 20, 24, 25)) * 86400 < 5,
          "ours %s UTC" % format_jd(jan))

    # --- Daily labels at Hyderabad sunrise (manual section 44) ---
    p = day("2027-01-01")
    check("Jan 1 sunrise Krishna Navami", at_sunrise(p, "tithi")["name"] == "Navami"
          and at_sunrise(p, "tithi")["paksha"] == "Krishna", at_sunrise(p, "tithi")["name"])
    check("Jan 1 sunrise Chitra", at_sunrise(p, "nakshatra")["name"] == "Chitra",
          at_sunrise(p, "nakshatra")["name"])
    p = day("2027-01-03")
    check("Jan 3 sunrise Krishna Ekadashi", at_sunrise(p, "tithi")["name"] == "Ekadashi",
          at_sunrise(p, "tithi")["name"])
    p = day("2027-01-08")
    check("Jan 8 sunrise Shukla Pratipada", at_sunrise(p, "tithi")["index"] == 1,
          at_sunrise(p, "tithi")["name"])
    check("Jan 8 month Pushya (Margashira ended at Jan 8 New Moon)",
          p["lunar_month"]["name"] == "Pushya", p["lunar_month"]["name"])
    p = day("2027-01-19")
    check("Jan 19 sunrise Shukla Ekadashi", at_sunrise(p, "tithi")["name"] == "Ekadashi",
          at_sunrise(p, "tithi")["name"])
    p = day("2027-01-20")
    check("Jan 20 sunrise Trayodashi", at_sunrise(p, "tithi")["name"] == "Trayodashi",
          at_sunrise(p, "tithi")["name"])
    p = day("2027-01-26")
    check("Jan 26 sunrise Krishna Panchami", at_sunrise(p, "tithi")["name"] == "Panchami",
          at_sunrise(p, "tithi")["name"])

    # Full Moon on Jan 22 (IST date)
    t = eng.crossing(eng.elongation, 180.0, julian_day(2027, 1, 21), 12.19,
                     after=julian_day(2027, 1, 18))
    check("Full Moon Jan 22 (IST)", format_jd(t + IST)[:10] == "2027-01-22", format_jd(t + IST))

    # Sankashtahara Chaturthi: Krishna Chaturthi at Moonrise on Jan 25
    p = day("2027-01-25")
    mr = p["moonrise"]
    cover = [x for x in p["tithi"] if x["start"] <= (mr or "") < x["end"]]
    name = cover[0]["name"] + "/" + cover[0]["paksha"] if cover else None
    check("Jan 25 Krishna Chaturthi at Moonrise", name == "Chaturthi/Krishna",
          "moonrise %s, tithi %s" % (mr, name))

    # Makara Sankranti Jan 14
    t, sign = eng.sankranti(julian_day(2027, 1, 10), 1)
    check("Makara Sankranti Jan 14", sign == "Makara" and format_jd(t + IST)[:10] == "2027-01-14",
          format_jd(t + IST))

    # Karana regression
    def karanas(date):
        return [k["name"] for k in day(date)["karana"]]
    k6, k7, k8 = karanas("2027-01-06"), karanas("2027-01-07"), karanas("2027-01-08")
    check("Jan 6 Vishti -> Shakuni", "Vishti" in k6 and "Shakuni" in k6, str(k6))
    check("Jan 7 Chatushpada -> Naga", "Chatushpada" in k7 and "Naga" in k7, str(k7))
    check("Jan 8 Kimstughna -> Bava", "Kimstughna" in k8 and "Bava" in k8, str(k8))

    # Ugadi 2027: Chaitra Shukla Pratipada at sunrise
    p = day("2027-04-07")
    ok = (p["lunar_month"]["name"] == "Chaitra" and at_sunrise(p, "tithi")["index"] == 1)
    check("Ugadi 2027-04-07 (Chaitra Shukla Pratipada at sunrise)", ok,
          "%s %s, samvatsara %s" % (p["lunar_month"]["name"], at_sunrise(p, "tithi")["name"],
                                    p["year"]["samvatsara"]))
    check("Samvatsara from Ugadi 2027 = Plavanga", p["year"]["samvatsara"] == "Plavanga",
          p["year"]["samvatsara"])

    # --- Sunrise / sunset vs Skyfield almanac (same refraction convention) ---
    site = wgs84.latlon(HYD["lat"], HYD["lon"])
    worst = 0.0
    for d in ("2027-01-08", "2027-03-21", "2027-06-21", "2027-09-23", "2027-12-21"):
        y, m, dd = (int(x) for x in d.split("-"))
        t0 = ts.utc(y, m, dd, -5, -30)
        t1 = ts.utc(y, m, dd + 1, -5, -30)
        f = almanac.sunrise_sunset(sk, site)
        times, ups = almanac.find_discrete(t0, t1, f)
        ours = day(d)
        for t, up in zip(times, ups):
            jd_utc = t.tt - 69.184 / 86400.0
            ours_s = ours["sunrise"] if up else ours["sunset"]
            y2, mo2, d2 = (int(x) for x in ours_s[:10].split("-"))
            hh, mi, ss = (int(x) for x in ours_s[11:].split(":"))
            jd_ours = julian_day(y2, mo2, d2, hh, mi, ss) - IST
            worst = max(worst, abs(jd_ours - jd_utc) * 86400.0)
    check("Sunrise/sunset vs Skyfield worst < 10 s", worst < 10.0, "%.1f s" % worst)

    fails = [r for r in results if not r[1]]
    print("\n%d checks, %d failed" % (len(results), len(fails)))
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
