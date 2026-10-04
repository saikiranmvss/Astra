import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "engine"))

from astro_engine import api, ephemeris  # noqa: E402

ephemeris.set_default(ephemeris.Ephemeris(ephemeris.file_loader(os.path.join(ROOT, "web", "eph"))))


def deg(x):
    d = int(x)
    m = int((x - d) * 60)
    s = ((x - d) * 60 - m) * 60
    return "%d:%02d:%05.2f" % (d, m, s)


if __name__ == "__main__":
    r = api.dispatch("chart", {"date": "1998-12-10", "time": "18:10", "tz_minutes": 330,
                               "lat": 18.576216339514087, "lon": 83.3587995791954,
                               "now_jd_utc": 2461317.2})
    c = r["chart"]
    print("compute_seconds", r["compute_seconds"])
    print("ayanamsa", deg(c["ayanamsa"]["true"]))
    print("lagna", c["lagna"]["rashi"]["name"], deg(c["lagna"]["rashi"]["degrees_in_sign"]))
    for k, g in c["grahas"].items():
        print("%-8s %-10s %s %-16s p%d h%d %s %s" % (
            k, g["rashi"]["name"], deg(g["rashi"]["degrees_in_sign"]), g["nakshatra"]["name"],
            g["nakshatra"]["pada"], g["house_whole_sign"], "R" if g["retrograde"] else " ",
            g["dignity"] or ""))
    print("D10 lagna", r["vargas"]["D10"]["positions"]["Lagna"]["sign"])
    print("D9 lagna", r["vargas"]["D9"]["positions"]["Lagna"]["sign"])
    print("dasha current", [x["lord"] for x in r["dasha"]["current"]])
    print("balance", r["dasha"]["balance_years"])
    print("birth panchanga", json.dumps(r["birth_panchanga"], indent=1))
    print("SAV", r["ashtakavarga"]["sav"], r["ashtakavarga"]["sav_total"])
    print("karakas", [(k["karaka"][:3], k["planet"]) for k in r["jaimini"]["chara_karakas_8"]])

    p = api.dispatch("panchanga", {"date": "2027-01-08", "lat": 17.385, "lon": 78.4867,
                                   "tz_minutes": 330})
    print("panchanga compute_seconds", p["compute_seconds"])
    print(json.dumps({k: p[k] for k in ("sunrise", "sunset", "moonrise", "moonset", "vara",
                                        "lunar_month", "year", "sankranti")}, indent=1))
    for key in ("tithi", "nakshatra", "yoga", "karana"):
        print(key, [(x["name"], x["start"], x["end"]) for x in p[key]])
    print("rahu", p["muhurta"]["rahu_kala"])
