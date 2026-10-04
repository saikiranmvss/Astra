"""Jaimini: chara karakas, arudha padas, rashi drishti."""
from . import tables as T

KARAKA_7 = ["Atmakaraka", "Amatyakaraka", "Bhratrikaraka", "Matrikaraka",
            "Putrakaraka", "Gnatikaraka", "Darakaraka"]
KARAKA_8 = ["Atmakaraka", "Amatyakaraka", "Bhratrikaraka", "Matrikaraka",
            "Pitrikaraka", "Putrakaraka", "Gnatikaraka", "Darakaraka"]
# primary lords (Vrishchika -> Mars, Kumbha -> Saturn); co-lords are a profile choice
ARUDHA_NAMES = {1: "AL (A1)", 12: "UL (A12)"}


def chara_karakas(longitudes, scheme=8):
    """longitudes: sidereal degrees for Sun..Saturn (+Rahu for 8-scheme)."""
    items = []
    for p in T.SEVEN:
        items.append((longitudes[p] % 30.0, p))
    if scheme == 8:
        items.append((30.0 - (longitudes["Rahu"] % 30.0), "Rahu"))
    items.sort(reverse=True)
    names = KARAKA_8 if scheme == 8 else KARAKA_7
    return [{"karaka": names[i], "planet": p, "degrees": d}
            for i, (d, p) in enumerate(items)]


def arudha_padas(lagna_sign, planet_signs):
    out = []
    for house in range(1, 13):
        s = (lagna_sign + house - 1) % 12
        lord = T.RASHI_LORD[s]
        ls = planet_signs[lord]
        dist = (ls - s) % 12
        pada = (ls + dist) % 12
        exception = None
        if pada == s:
            pada = (s + 9) % 12
            exception = "fell in the sign itself; 10th taken"
        elif pada == (s + 6) % 12:
            pada = (s + 3) % 12
            exception = "fell in the 7th; 4th from sign taken"
        out.append({
            "pada": "A%d" % house,
            "label": ARUDHA_NAMES.get(house, "A%d" % house),
            "source_sign": T.RASHIS[s],
            "lord": lord,
            "lord_sign": T.RASHIS[ls],
            "distance": dist + 1,
            "sign": T.RASHIS[pada],
            "exception": exception,
        })
    return out


def rashi_drishti():
    """Sign aspects: movable->fixed (except adjacent), fixed->movable
    (except adjacent), dual->other duals."""
    out = {}
    for s in range(12):
        q = s % 3
        targets = []
        for t in range(12):
            if t == s:
                continue
            tq = t % 3
            adjacent = (t - s) % 12 in (1, 11)
            if q == 0 and tq == 1 and not adjacent:
                targets.append(T.RASHIS[t])
            elif q == 1 and tq == 0 and not adjacent:
                targets.append(T.RASHIS[t])
            elif q == 2 and tq == 2:
                targets.append(T.RASHIS[t])
        out[T.RASHIS[s]] = targets
    return out
