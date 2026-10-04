"""Festival / vrata engine.  Every observance is a rule, never a stored date.

Rule = (lunar month, tithi, anchor).  Anchors are classical day divisions
(sunrise, arunodaya, purvahna, madhyahna, aparahna, pradosha, nishitha,
moonrise).  For each actual tithi interval the observance day is the civil
day whose anchor the tithi occupies; if it occupies the anchor on two days
the day with the larger coverage wins (ties: the first day); if neither,
the day on which the tithi prevails at sunrise (or begins) is used.
Months are Amanta; rules for regular months are skipped in an adhika month.
"""
import time

from . import tables as T
from .daycal import DayRange
from .timescale import calendar, julian_day

# (id, name, category, month, tithi 1..30, anchor)
RULES = [
    ("ugadi", "Ugadi / Gudi Padwa (lunar New Year)", "major", "Chaitra", 1, "sunrise"),
    ("chaitra_navratri", "Chaitra Navaratri begins", "major", "Chaitra", 1, "sunrise"),
    ("rama_navami", "Sri Rama Navami", "major", "Chaitra", 9, "madhyahna"),
    ("mahavir_jayanti", "Mahavir Jayanti", "jayanti", "Chaitra", 13, "sunrise"),
    ("hanuman_jayanti_n", "Hanuman Jayanti (North India)", "jayanti", "Chaitra", 15, "sunrise"),
    ("akshaya_tritiya", "Akshaya Tritiya", "major", "Vaishakha", 3, "purvahna"),
    ("shankara_jayanti", "Adi Shankara Jayanti", "jayanti", "Vaishakha", 5, "madhyahna"),
    ("narasimha_jayanti", "Narasimha Jayanti", "jayanti", "Vaishakha", 14, "pradosha"),
    ("buddha_purnima", "Buddha Purnima", "jayanti", "Vaishakha", 15, "sunrise"),
    ("hanuman_jayanti_te", "Hanuman Jayanti (Telugu)", "regional", "Vaishakha", 25, "sunrise"),
    ("ganga_dussehra", "Ganga Dussehra", "major", "Jyeshtha", 10, "sunrise"),
    ("vat_purnima", "Vat Purnima", "vrata", "Jyeshtha", 15, "sunrise"),
    ("rath_yatra", "Jagannath Rath Yatra", "major", "Ashadha", 2, "sunrise"),
    ("toli_ekadashi", "Toli Ekadashi (Devshayani)", "major", "Ashadha", 11, "sunrise"),
    ("guru_purnima", "Guru Purnima (Vyasa Purnima)", "major", "Ashadha", 15, "sunrise"),
    ("naga_panchami", "Naga Panchami", "major", "Shravana", 5, "purvahna"),
    ("raksha_bandhan", "Raksha Bandhan / Shravana Purnima", "major", "Shravana", 15, "aparahna"),
    ("janmashtami", "Sri Krishna Janmashtami", "major", "Shravana", 23, "nishitha"),
    ("vinayaka_chaturthi", "Vinayaka Chaturthi", "major", "Bhadrapada", 4, "madhyahna"),
    ("rishi_panchami", "Rishi Panchami", "vrata", "Bhadrapada", 5, "madhyahna"),
    ("anant_chaturdashi", "Anant Chaturdashi (Ganesh Visarjan)", "major", "Bhadrapada", 14, "sunrise"),
    ("pitru_paksha", "Pitru Paksha begins", "major", "Bhadrapada", 16, "aparahna"),
    ("mahalaya", "Mahalaya Amavasya", "major", "Bhadrapada", 30, "aparahna"),
    ("bathukamma_start", "Engili Pula Bathukamma", "regional", "Bhadrapada", 30, "sunrise"),
    ("sharad_navratri", "Sharad Navaratri begins", "major", "Ashvayuja", 1, "sunrise"),
    ("durgashtami", "Durgashtami", "major", "Ashvayuja", 8, "sunrise"),
    ("saddula_bathukamma", "Saddula Bathukamma", "regional", "Ashvayuja", 8, "sunrise"),
    ("maha_navami", "Maha Navami", "major", "Ashvayuja", 9, "sunrise"),
    ("vijayadashami", "Vijayadashami (Dasara)", "major", "Ashvayuja", 10, "aparahna"),
    ("sharad_purnima", "Sharad Purnima", "vrata", "Ashvayuja", 15, "pradosha"),
    ("atla_taddi", "Atla Taddi", "regional", "Ashvayuja", 18, "moonrise"),
    ("karva_chauth", "Karva Chauth", "vrata", "Ashvayuja", 19, "moonrise"),
    ("dhanteras", "Dhanteras (Dhana Trayodashi)", "major", "Ashvayuja", 28, "pradosha"),
    ("naraka_chaturdashi", "Naraka Chaturdashi", "major", "Ashvayuja", 29, "arunodaya"),
    ("deepavali", "Deepavali (Lakshmi Puja)", "major", "Ashvayuja", 30, "pradosha"),
    ("govardhan", "Govardhan Puja / Bali Pratipada", "major", "Kartika", 1, "sunrise"),
    ("bhai_dooj", "Bhai Dooj / Yama Dvitiya", "major", "Kartika", 2, "aparahna"),
    ("nagula_chavithi", "Nagula Chavithi", "regional", "Kartika", 4, "sunrise"),
    ("chhath", "Chhath Puja", "major", "Kartika", 6, "sayahna"),
    ("prabodhini", "Prabodhini (Utthana) Ekadashi", "major", "Kartika", 11, "sunrise"),
    ("ksheerabdi_dvadashi", "Ksheerabdi Dvadashi", "regional", "Kartika", 12, "sunrise"),
    ("kartika_purnima", "Kartika Purnima", "major", "Kartika", 15, "pradosha"),
    ("subrahmanya_shashti", "Subrahmanya Shashti", "major", "Margashira", 6, "sunrise"),
    ("gita_jayanti", "Gita Jayanti", "jayanti", "Margashira", 11, "sunrise"),
    ("datta_jayanti", "Datta Jayanti", "jayanti", "Margashira", 15, "pradosha"),
    ("vasant_panchami", "Vasant Panchami (Sri Panchami)", "major", "Magha", 5, "purvahna"),
    ("ratha_saptami", "Ratha Saptami", "major", "Magha", 7, "arunodaya"),
    ("bhishma_ashtami", "Bhishma Ashtami", "major", "Magha", 8, "madhyahna"),
    ("maha_shivaratri", "Maha Shivaratri", "major", "Magha", 29, "nishitha"),
    ("holika_dahan", "Holika Dahan", "major", "Phalguna", 15, "pradosha"),
]

CATEGORIES = {
    "major": "Major festivals",
    "jayanti": "Jayantis",
    "regional": "Telugu / regional",
    "ekadashi": "Ekadashi",
    "vrata": "Vratas (Pradosha, Sankashti, Shivaratri, Purnima, Amavasya)",
    "solar": "Sankranti / solar",
}

# Amanta month -> (Shukla Ekadashi, Krishna Ekadashi)
EKADASHI_NAMES = {
    "Chaitra": ("Kamada", "Varuthini"), "Vaishakha": ("Mohini", "Apara"),
    "Jyeshtha": ("Nirjala", "Yogini"), "Ashadha": ("Devshayani", "Kamika"),
    "Shravana": ("Shravana Putrada", "Aja"), "Bhadrapada": ("Parivartini", "Indira"),
    "Ashvayuja": ("Papankusha", "Rama"), "Kartika": ("Prabodhini", "Utpanna"),
    "Margashira": ("Mokshada", "Saphala"), "Pushya": ("Pausha Putrada", "Shattila"),
    "Magha": ("Jaya", "Vijaya"), "Phalguna": ("Amalaki", "Papamochani"),
}
ADHIKA_EKADASHI = ("Padmini", "Parama")
PRADOSHA_DAY = ["Ravi", "Soma", "Bhauma", "Budha", "Guru", "Shukra", "Shani"]


def _overlap(a, b, c, d):
    return max(0.0, min(b, d) - max(a, c))


class Resolver(object):
    def __init__(self, dr):
        self.dr = dr
        self.moonrise_cache = {}
        self.tithi_intervals = dr.tithi.intervals()

    def month_of(self, a, b):
        return self.dr.months.at(a + (b - a) / 2.0)

    def anchor_value(self, i, anchor, a, b):
        """Coverage (days) of tithi [a,b) on day i's anchor; point anchors -> 1/0."""
        dr = self.dr
        if anchor == "moonrise":
            if i not in self.moonrise_cache:
                self.moonrise_cache[i] = dr.moonrise(i)
            t = self.moonrise_cache[i]
            return None if t is None else (1.0 if a <= t < b else 0.0)
        w = dr.windows(i)
        if w is None:
            return None
        s, e = w[anchor]
        if s == e:
            return 1.0 if a <= s < b else 0.0
        return _overlap(a, b, s, e)

    def candidate_days(self, a, b):
        dr = self.dr
        out = []
        for i in range(len(dr.dates)):
            r, nr = dr.rises[i], dr.rises[i + 1]
            if r is None or nr is None:
                continue
            lo = r - ARUNODAYA_PAD
            if lo < b and nr + 0.6 > a:
                out.append(i)
        return out

    def pick(self, a, b, anchor):
        dr = self.dr
        best, best_v = None, 0.0
        for i in self.candidate_days(a, b):
            v = self.anchor_value(i, anchor, a, b)
            if v is not None and v > best_v + 1e-9:
                best, best_v = i, v
        if best is not None:
            return best, "rule"
        for i in self.candidate_days(a, b):
            r = dr.rises[i]
            if r is not None and a <= r < b:
                return i, "fallback: tithi at sunrise"
        i = dr.day_index_of(a)
        return i, "fallback: day the tithi begins"


ARUNODAYA_PAD = 0.1


def _entry(dr, i, fid, name, cat, a, b, rule, how, **kw):
    y, m, d = dr.dates[i]
    e = {"id": fid, "name": name, "category": cat, "date": "%04d-%02d-%02d" % (y, m, d),
         "weekday": dr.days[i]["weekday"], "tithi_start": dr.fmt(a), "tithi_end": dr.fmt(b),
         "rule": rule, "resolution": how}
    e.update(kw)
    return e


def resolve(dr, categories=None):
    res = Resolver(dr)
    out = []
    cats = set(categories or CATEGORIES.keys())
    by_key = {}
    for fid, name, cat, month, tithi, anchor in RULES:
        by_key.setdefault((month, tithi), []).append((fid, name, cat, anchor))

    for idx, a, b in res.tithi_intervals:
        m = res.month_of(a, b)
        if m is None:
            continue
        mname, adhika = m["name"], m["adhika"]
        tnum = idx + 1
        # named festivals (not in adhika months)
        if not adhika:
            for fid, name, cat, anchor in by_key.get((mname, tnum), []):
                i, how = res.pick(a, b, anchor)
                if i is None:
                    continue
                out.append(_entry(dr, i, fid, name, cat, a, b,
                                  "%s %s, tithi at %s" % (mname, _tname(idx), anchor), how))
                if fid == "holika_dahan" and i + 1 < len(dr.dates):
                    out.append(_entry(dr, i + 1, "holi", "Holi (Dhulandi)", cat, a, b,
                                      "day after Holika Dahan", "derived"))
        # Ekadashi
        if tnum in (11, 26):
            out.extend(_ekadashi(dr, res, idx, a, b, mname, adhika))
        if tnum in (13, 28):
            i, how = res.pick(a, b, "pradosha")
            if i is not None:
                wd = dr.days[i]["weekday"]
                out.append(_entry(dr, i, "pradosha", "%s Pradosha" % PRADOSHA_DAY[wd],
                                  "vrata", a, b, "Trayodashi at pradosha kala", how,
                                  paksha="Shukla" if tnum == 13 else "Krishna"))
        if tnum == 19:
            i, how = res.pick(a, b, "moonrise")
            if i is not None:
                wd = dr.days[i]["weekday"]
                nm = "Angaraki Sankashti Chaturthi" if wd == 2 else "Sankashti Chaturthi"
                out.append(_entry(dr, i, "sankashti", nm, "vrata", a, b,
                                  "Krishna Chaturthi at moonrise", how))
        if tnum == 29 and not (mname == "Magha" and not adhika):
            i, how = res.pick(a, b, "nishitha")
            if i is not None:
                out.append(_entry(dr, i, "masik_shivaratri", "Masik Shivaratri", "vrata",
                                  a, b, "Krishna Chaturdashi at nishitha", how))
        if tnum in (15, 30):
            i, how = res.pick(a, b, "sunrise")
            if i is not None:
                label = ("Adhika " if adhika else "") + mname
                out.append(_entry(dr, i, "purnima" if tnum == 15 else "amavasya",
                                  "%s %s" % (label, "Purnima" if tnum == 15 else "Amavasya"),
                                  "vrata", a, b, "tithi at sunrise", how))
        if tnum == 15 and mname == "Shravana" and not adhika:
            out.extend(_varalakshmi(dr, res, a, b))

    out.extend(_solar(dr))

    lo, hi = dr.keep_range if hasattr(dr, "keep_range") else (None, None)
    out = [e for e in out if e["category"] in cats and (not lo or lo <= e["date"] <= hi)]
    out.sort(key=lambda e: (e["date"], e["category"] != "major", e["name"]))
    return out


def _tname(idx):
    from .panchanga import tithi_name
    return ("Shukla " if idx < 15 else "Krishna ") + tithi_name(idx)


def _ekadashi(dr, res, idx, a, b, mname, adhika):
    out = []
    names = ADHIKA_EKADASHI if adhika else EKADASHI_NAMES[mname]
    nm = names[0 if idx < 15 else 1]
    days = [i for i in res.candidate_days(a, b)
            if dr.rises[i] is not None and a <= dr.rises[i] < b]
    if days:
        smarta = days[0]
        how = "Ekadashi at sunrise" + (" on two days (first day for Smarta)" if len(days) > 1 else "")
    else:
        smarta = dr.day_index_of(a)
        how = "kshaya Ekadashi (no sunrise inside the tithi)"
        if smarta is None:
            return out
    r = dr.rises[smarta]
    vaishnava = smarta
    viddha = r is not None and a > r - 96.0 / 1440.0
    if len(days) > 1 or viddha:
        vaishnava = smarta + 1 if smarta + 1 < len(dr.dates) else smarta
    # parana: next sunrise after the fast, after the first quarter of Dvadashi
    p_day = smarta + 1
    parana = None
    if p_day < len(dr.dates) and dr.rises[p_day] is not None:
        d_idx, d_start, d_end = dr.tithi.at(b + 1e-6)
        start = dr.rises[p_day]
        if d_start is not None and d_end is not None:
            hari_vasara_end = d_start + (d_end - d_start) / 4.0
            start = max(start, hari_vasara_end)
        w = dr.windows(p_day)
        end = w["madhyahna"][0] if w else start + 0.15
        if d_end is not None and d_end > start:
            end = min(end, d_end) if d_end < end else end
        if end <= start:
            end = start + 0.1
        parana = {"start": dr.fmt(start), "end": dr.fmt(end),
                  "rule": "after sunrise, after the first quarter of Dvadashi (Hari Vasara)"}
    title = "%s Ekadashi" % nm
    if mname == "Margashira" and idx < 15 and not adhika:
        title += " / Gita Jayanti"
    out.append(_entry(dr, smarta, "ekadashi", title, "ekadashi", a, b,
                      "Ekadashi at sunrise (Smarta)", how,
                      vaishnava_date="%04d-%02d-%02d" % dr.dates[vaishnava],
                      parana=parana, paksha="Shukla" if idx < 15 else "Krishna"))
    # Vaikuntha Ekadashi: Shukla Ekadashi while the Sun is in Dhanu
    if idx < 15 and dr.days[smarta]["sun_sign"]["index"] == 9:
        out.append(_entry(dr, smarta, "vaikuntha_ekadashi", "Vaikuntha (Mukkoti) Ekadashi",
                          "major", a, b, "Shukla Ekadashi with the Sun in Dhanu", how))
    return out


def _varalakshmi(dr, res, a, b):
    """Friday on or before Shravana Purnima, within Shravana Shukla paksha."""
    i, _how = res.pick(a, b, "sunrise")
    if i is None:
        return []
    for j in range(i, max(-1, i - 8), -1):
        if dr.days[j]["weekday"] == 5:
            return [_entry(dr, j, "varalakshmi", "Varalakshmi Vratam", "regional", a, b,
                           "Friday before Shravana Purnima", "derived")]
    return []


SANKRANTI_FEAST = {9: "Makara Sankranti / Pongal (Uttarayana)",
                   0: "Mesha Sankranti (Solar New Year: Vishu, Puthandu, Baisakhi)",
                   3: "Karkataka Sankranti (Dakshinayana)",
                   8: "Dhanu Sankranti (Dhanurmasa begins)"}


def _solar(dr):
    out = []
    times, idxs = dr.sun_sign.times, dr.sun_sign.idx
    for t, sign in zip(times, idxs):
        # festival day: if the sankranti falls after sunset, the next day
        civil = None
        for k in range(len(dr.dates)):
            m0 = dr.midnights[k]
            if m0 <= t < dr.midnights[k + 1]:
                civil = k
                break
        if civil is None:
            continue
        day = civil
        if dr.sets[civil] is not None and t > dr.sets[civil]:
            day = civil + 1
        if day >= len(dr.dates):
            continue
        name = SANKRANTI_FEAST.get(sign, "%s Sankranti" % T.RASHIS[sign])
        cat = "major" if sign in (9, 0) else "solar"
        e = _entry(dr, day, "sankranti_%d" % sign, name, cat, t, t,
                   "Sun enters %s; next day if after sunset" % T.RASHIS[sign],
                   "sankranti at " + dr.fmt(t))
        e["sankranti_time"] = dr.fmt(t)
        out.append(e)
        if sign == 9:
            for off, nm in ((-1, "Bhogi"), (1, "Kanuma"), (2, "Mukkanuma")):
                j = day + off
                if 0 <= j < len(dr.dates):
                    out.append(_entry(dr, j, "makara_%d" % off, nm, "regional", t, t,
                                      "relative to Makara Sankranti day", "derived"))
    return out


def festivals_for_range(p, first, last, categories=None):
    pad = 3
    a = calendar(julian_day(*first) - pad)[:3]
    b = calendar(julian_day(*last) + pad)[:3]
    dr = DayRange(p, a, b)
    dr.keep_range = ("%04d-%02d-%02d" % first, "%04d-%02d-%02d" % last)
    return dr, resolve(dr, categories)


def festival_year(p):
    started = time.time()
    year = int(p.get("year"))
    first, last = (year, 1, 1), (year, 12, 31)
    if p.get("start") and p.get("end"):
        first = tuple(int(x) for x in p["start"].split("-"))
        last = tuple(int(x) for x in p["end"].split("-"))
    dr, items = festivals_for_range(p, first, last, p.get("categories"))
    return {
        "kind": "festivals",
        "start": "%04d-%02d-%02d" % first, "end": "%04d-%02d-%02d" % last,
        "categories": CATEGORIES,
        "count": len(items),
        "festivals": items,
        "profile": {"months": "Amanta", "ekadashi": "Smarta (Vaishnava date also given)",
                    "sunrise": dr.profile, "ayanamsa": dr.model},
        "compute_seconds": round(time.time() - started, 3),
    }
