"""Ashtakavarga (BPHS): Bhinnashtakavarga per planet and Sarvashtakavarga.

Contributors: Sun..Saturn and Lagna. Rahu/Ketu excluded.
Raw (un-reduced) bindus; shodhana is a separate, profile-dependent step.
"""
from . import tables as T

C = ("Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Lagna")

# BAV[planet][contributor] = houses (counted from the contributor) receiving a bindu
BAV = {
    "Sun": {"Sun": (1, 2, 4, 7, 8, 9, 10, 11), "Moon": (3, 6, 10, 11),
            "Mars": (1, 2, 4, 7, 8, 9, 10, 11), "Mercury": (3, 5, 6, 9, 10, 11, 12),
            "Jupiter": (5, 6, 9, 11), "Venus": (6, 7, 12),
            "Saturn": (1, 2, 4, 7, 8, 9, 10, 11), "Lagna": (3, 4, 6, 10, 11, 12)},
    "Moon": {"Sun": (3, 6, 7, 8, 10, 11), "Moon": (1, 3, 6, 7, 10, 11),
             "Mars": (2, 3, 5, 6, 9, 10, 11), "Mercury": (1, 3, 4, 5, 7, 8, 10, 11),
             "Jupiter": (1, 4, 7, 8, 10, 11, 12), "Venus": (3, 4, 5, 7, 9, 10, 11),
             "Saturn": (3, 5, 6, 11), "Lagna": (3, 6, 10, 11)},
    "Mars": {"Sun": (3, 5, 6, 10, 11), "Moon": (3, 6, 11),
             "Mars": (1, 2, 4, 7, 8, 10, 11), "Mercury": (3, 5, 6, 11),
             "Jupiter": (6, 10, 11, 12), "Venus": (6, 8, 11, 12),
             "Saturn": (1, 4, 7, 8, 9, 10, 11), "Lagna": (1, 3, 6, 10, 11)},
    "Mercury": {"Sun": (5, 6, 9, 11, 12), "Moon": (2, 4, 6, 8, 10, 11),
                "Mars": (1, 2, 4, 7, 8, 9, 10, 11), "Mercury": (1, 3, 5, 6, 9, 10, 11, 12),
                "Jupiter": (6, 8, 11, 12), "Venus": (1, 2, 3, 4, 5, 8, 9, 11),
                "Saturn": (1, 2, 4, 7, 8, 9, 10, 11), "Lagna": (1, 2, 4, 6, 8, 10, 11)},
    "Jupiter": {"Sun": (1, 2, 3, 4, 7, 8, 9, 10, 11), "Moon": (2, 5, 7, 9, 11),
                "Mars": (1, 2, 4, 7, 8, 10, 11), "Mercury": (1, 2, 4, 5, 6, 9, 10, 11),
                "Jupiter": (1, 2, 3, 4, 7, 8, 10, 11), "Venus": (2, 5, 6, 9, 10, 11),
                "Saturn": (3, 5, 6, 12), "Lagna": (1, 2, 4, 5, 6, 7, 9, 10, 11)},
    "Venus": {"Sun": (8, 11, 12), "Moon": (1, 2, 3, 4, 5, 8, 9, 11, 12),
              "Mars": (3, 5, 6, 9, 11, 12), "Mercury": (3, 5, 6, 9, 11),
              "Jupiter": (5, 8, 9, 10, 11), "Venus": (1, 2, 3, 4, 5, 8, 9, 10, 11),
              "Saturn": (3, 4, 5, 8, 9, 10, 11), "Lagna": (1, 2, 3, 4, 5, 8, 9, 11)},
    "Saturn": {"Sun": (1, 2, 4, 7, 8, 10, 11), "Moon": (3, 6, 11),
               "Mars": (3, 5, 6, 10, 11, 12), "Mercury": (6, 8, 9, 10, 11, 12),
               "Jupiter": (5, 6, 11, 12), "Venus": (6, 11, 12),
               "Saturn": (3, 5, 6, 11), "Lagna": (1, 3, 4, 6, 10, 11)},
}
EXPECTED_TOTALS = {"Sun": 48, "Moon": 49, "Mars": 39, "Mercury": 54,
                   "Jupiter": 56, "Venus": 52, "Saturn": 39}


def compute(signs):
    """signs: {contributor: sign index 0-11}. Returns BAV and SAV by sign."""
    bav = {}
    for planet, table in BAV.items():
        row = [0] * 12
        for contributor, houses in table.items():
            base = signs[contributor]
            for h in houses:
                row[(base + h - 1) % 12] += 1
        assert sum(row) == EXPECTED_TOTALS[planet]
        bav[planet] = row
    sav = [sum(bav[p][i] for p in bav) for i in range(12)]
    assert sum(sav) == 337
    lagna = signs["Lagna"]
    return {
        "signs": T.RASHIS,
        "bav": bav,
        "sav": sav,
        "sav_by_house": [sav[(lagna + i) % 12] for i in range(12)],
        "totals": {p: sum(r) for p, r in bav.items()},
        "sav_total": sum(sav),
        "note": "raw bindus (no trikona/ekadhipatya shodhana)",
    }
