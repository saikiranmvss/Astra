"""Gochara (transits) against a natal chart.

Positions at the transit instant are exact.  Gochara results are counted
from the natal Moon sign with the classical good houses and vedha points
(Phaladeepika); Ashtakavarga bindus of the natal chart are attached.
Sade Sati / Ashtama / Kantaka Shani periods come from root-solved Saturn
sign ingresses over the whole life span.
"""
import time

from . import ashtakavarga, dasha
from . import tables as T
from .chart import ChartContext, compute_chart, sign_of
from .localtime import LocalTime
from .series import Series, crossings
from .timescale import Instant, calendar, julian_day

GOOD = {"Sun": [3, 6, 10, 11], "Moon": [1, 3, 6, 7, 10, 11], "Mars": [3, 6, 11],
        "Mercury": [2, 4, 6, 8, 10, 11], "Jupiter": [2, 5, 7, 9, 11],
        "Venus": [1, 2, 3, 4, 5, 8, 9, 11, 12], "Saturn": [3, 6, 11], "Rahu": [3, 6, 11],
        "Ketu": [3, 6, 11]}
VEDHA = {"Sun": {3: 9, 6: 12, 10: 4, 11: 5}, "Moon": {1: 5, 3: 9, 6: 12, 7: 2, 10: 4, 11: 8},
         "Mars": {3: 12, 6: 9, 11: 5}, "Mercury": {2: 5, 4: 3, 6: 9, 8: 1, 10: 8, 11: 12},
         "Jupiter": {2: 12, 5: 4, 7: 3, 9: 10, 11: 8},
         "Venus": {1: 8, 2: 7, 3: 1, 4: 10, 5: 9, 8: 5, 9: 11, 11: 3, 12: 6},
         "Saturn": {3: 12, 6: 9, 11: 5}, "Rahu": {3: 12, 6: 9, 11: 5}, "Ketu": {3: 12, 6: 9, 11: 5}}
NO_VEDHA = [{"Sun", "Saturn"}, {"Moon", "Mercury"}]
SATURN_PHASE = {12: "Sade Sati (rising, 12th)", 1: "Sade Sati (peak, over Moon)",
                2: "Sade Sati (setting, 2nd)", 4: "Kantaka / Ardhashtama Shani (4th)",
                8: "Ashtama Shani (8th)"}


def _parse(p, prefix=""):
    y, m, d = (int(x) for x in p[prefix + "date"].split("-"))
    parts = [float(x) for x in p.get(prefix + "time", "12:00:00").split(":")]
    while len(parts) < 3:
        parts.append(0.0)
    tz = float(p.get(prefix + "tz_minutes", 330))
    return julian_day(y, m, d, *parts) - tz / 1440.0, tz


def gochara(natal_moon_sign, tsigns):
    out = {}
    for p in T.GRAHAS:
        h = (tsigns[p] - natal_moon_sign) % 12 + 1
        good = h in GOOD[p]
        vedha_by = None
        if good and h in VEDHA[p]:
            vh = VEDHA[p][h]
            for q in T.GRAHAS:
                if q == p or {p, q} in NO_VEDHA:
                    continue
                if (tsigns[q] - natal_moon_sign) % 12 + 1 == vh:
                    vedha_by = q
                    break
        out[p] = {"house_from_moon": h, "favourable": good and not vedha_by,
                  "classically_good_house": good, "vedha_by": vedha_by}
    return out


def saturn_periods(ctx_model, birth_jd, moon_sign, years=100, lt=None):
    t0, t1 = birth_jd, birth_jd + years * 365.25
    s = Series(t0, t1, ["Saturn"], step=10.0, model=ctx_model)
    f = lambda t: s.lon("Saturn", t)
    found = crossings(f, 30.0, t0, t1, scan=10.0)
    marks = [(t0, int(f(t0) // 30.0) % 12)] + [(t, k % 12) for t, k, _d in found]
    spans = []
    for i, (t, sign) in enumerate(marks):
        end = marks[i + 1][0] if i + 1 < len(marks) else t1
        h = (sign - moon_sign) % 12 + 1
        spans.append({"start": t, "end": end, "sign": sign, "house": h})
    # Sade Sati: spans with Saturn in 12/1/2 from the Moon, merged across
    # retrograde excursions (outside spans shorter than 250 days).
    cycles, cur = [], None
    for sp in spans:
        inside = sp["house"] in (12, 1, 2)
        if inside:
            if cur is None:
                cur = {"start": sp["start"], "end": sp["end"], "phases": [sp]}
            else:
                cur["end"] = sp["end"]
                cur["phases"].append(sp)
        elif cur is not None and sp["end"] - sp["start"] >= 250.0:
            cycles.append(cur)
            cur = None
    if cur is not None:
        cycles.append(cur)
    other = [sp for sp in spans if sp["house"] in (4, 8)]
    fmt = lt.iso if lt else (lambda j: j)

    def phase_out(sp):
        return {"phase": SATURN_PHASE.get(sp["house"], "Saturn in house %d" % sp["house"]),
                "sign": T.RASHIS[sp["sign"]], "start": fmt(sp["start"]), "end": fmt(sp["end"])}
    return {
        "sade_sati": [{"start": fmt(c["start"]), "end": fmt(c["end"]),
                       "phases": [phase_out(x) for x in c["phases"]]} for c in cycles],
        "ashtama_kantaka": [phase_out(x) for x in other],
    }


def compute(p):
    started = time.time()
    model = p.get("ayanamsa", "lahiri")
    node = p.get("node", "true")
    bjd, btz = _parse(p, "birth_")
    blat, blon = float(p["birth_lat"]), float(p["birth_lon"])
    ctx = ChartContext(model)
    natal = compute_chart(Instant.from_utc_jd(bjd), blat, blon, 0.0, model, node, ctx=ctx)
    tjd, ttz = _parse(p, "")
    tlat = float(p.get("lat", blat))
    tlon = float(p.get("lon", blon))
    lt = LocalTime(ttz, p.get("tz_changes"))
    trans = compute_chart(Instant.from_utc_jd(tjd), tlat, tlon, 0.0, model, node, ctx=ctx)

    nsid = {k: v["longitude"] for k, v in natal["grahas"].items()}
    nlagna = sign_of(natal["lagna"]["longitude"])
    nmoon = sign_of(nsid["Moon"])
    signs = {k: sign_of(nsid[k]) for k in T.SEVEN}
    signs["Lagna"] = nlagna
    av = ashtakavarga.compute(signs)
    tsid = {k: v["longitude"] for k, v in trans["grahas"].items()}
    tsigns = {k: sign_of(tsid[k]) for k in T.GRAHAS}
    go = gochara(nmoon, tsigns)
    rows = []
    for k in T.GRAHAS + ["Uranus", "Neptune", "Pluto"]:
        g = trans["grahas"][k]
        s = sign_of(g["longitude"])
        row = {"planet": k, "longitude": g["longitude"], "rashi": g["rashi"],
               "nakshatra": g["nakshatra"], "retrograde": g["retrograde"],
               "house_from_lagna": (s - nlagna) % 12 + 1, "house_from_moon": (s - nmoon) % 12 + 1,
               "natal_longitude": nsid.get(k), "sav_in_sign": av["sav"][s]}
        if k in av["bav"]:
            row["bav_bindus"] = av["bav"][k][s]
        if k in go:
            row.update(go[k])
        rows.append(row)
    now_dasha = dasha.vimshottari(nsid["Moon"], bjd, levels=3, tz_minutes=ttz, now_jd_utc=tjd)
    sat = saturn_periods(model, bjd, nmoon, int(p.get("years", 100)), lt)
    cur_phase = None
    for c in sat["sade_sati"]:
        for ph in c["phases"]:
            if ph["start"] <= lt.iso(tjd) < ph["end"]:
                cur_phase = ph
    for ph in sat["ashtama_kantaka"]:
        if ph["start"] <= lt.iso(tjd) < ph["end"]:
            cur_phase = ph

    # upcoming slow-planet ingresses (5 years, mean node for the nodes)
    t_end = tjd + 5 * 365.25
    s = Series(tjd, t_end, ["Jupiter", "Saturn", "Rahu", "Ketu"], step=4.0, model=model,
               node="mean")
    upcoming = []
    for b in ("Jupiter", "Saturn", "Rahu", "Ketu"):
        for t, k, d in crossings(lambda x, b=b: s.lon(b, x), 30.0, tjd, t_end, scan=4.0):
            sg = k % 12
            upcoming.append({"planet": b, "sign": T.RASHIS[sg], "time": lt.iso(t), "jd": t,
                             "retrograde": d < 0 and b not in ("Rahu", "Ketu"),
                             "house_from_moon": (sg - nmoon) % 12 + 1,
                             "house_from_lagna": (sg - nlagna) % 12 + 1})
    upcoming.sort(key=lambda e: e["jd"])

    # Chandrashtama: Moon transiting the 8th sign from the natal Moon (next 60 days)
    s2 = Series(tjd, tjd + 60, ["Moon"], step=1.0, model=model)
    eighth = (nmoon + 7) % 12
    marks = [(tjd, int(s2.lon("Moon", tjd) // 30.0) % 12)] + [
        (t, k % 12) for t, k, _d in crossings(lambda x: s2.lon("Moon", x), 30.0, tjd, tjd + 60)]
    chandrashtama = []
    for i, (t, sg) in enumerate(marks):
        if sg == eighth:
            end = marks[i + 1][0] if i + 1 < len(marks) else tjd + 60
            chandrashtama.append({"start": lt.iso(t), "end": lt.iso(end)})

    return {
        "kind": "transits",
        "transit_time": lt.iso(tjd),
        "natal": {"lagna": T.RASHIS[nlagna], "moon_sign": T.RASHIS[nmoon],
                  "moon_nakshatra": natal["grahas"]["Moon"]["nakshatra"]["name"],
                  "longitudes": nsid, "lagna_longitude": natal["lagna"]["longitude"]},
        "transit_lagna": trans["lagna"]["rashi"]["name"],
        "planets": rows,
        "current_dasha": [x["lord"] for x in now_dasha["current"]],
        "saturn": sat,
        "current_saturn_phase": cur_phase,
        "upcoming_ingresses": upcoming,
        "chandrashtama": chandrashtama,
        "rules": "Gochara from natal Moon with Phaladeepika vedha; Sun-Saturn and Moon-Mercury exempt",
        "compute_seconds": round(time.time() - started, 3),
    }
