"""Sun times of a Hindu day and the day/night half that contains an instant.

The search is anchored at local mean midnight of the place (from its
longitude), not at midnight of the chosen time zone.  A zone far from the
place's solar time (an Indian birth entered in UTC, say) can put that zone's
midnight right on top of sunrise, and a one-day search from there may contain
no sunrise at all.  Solar midnight is always ~6 h from sunrise outside the
polar regions, so the result depends only on the date and the place.
"""
from .timescale import julian_day


def day_sun_times(eng, year, month, day, site, profile):
    """(sunrise, sunset, next_sunrise, prev_sunset) as UTC JDs; None where the Sun
    does not rise or set (polar day/night)."""
    anchor = julian_day(year, month, day) - site[1] / 360.0
    sr = eng.first_event("sun", "rise", anchor, site, profile)
    ss = eng.first_event("sun", "set", sr if sr is not None else anchor, site, profile)
    nsr = eng.first_event("sun", "rise", sr + 0.5 if sr is not None else anchor + 1.0, site, profile)
    pss = eng.first_event("sun", "set", (sr if sr is not None else anchor) - 1.0, site, profile)
    return sr, ss, nsr, pss


def day_part(jd, sun_times, sun_hour_angle):
    """("day" | "night", start, end) of the half containing jd.

    Without a usable rise/set pair (polar day/night) the halves are taken as
    12 h each, split where the Sun's hour angle is -90 and +90 degrees."""
    sr, ss, nsr, pss = sun_times
    if sr is not None and ss is not None and sr <= jd < ss:
        return "day", sr, ss
    if ss is not None and nsr is not None and ss <= jd < nsr:
        return "night", ss, nsr
    if pss is not None and sr is not None and pss <= jd < sr:
        return "night", pss, sr
    h = (sun_hour_angle + 90.0) % 360.0
    part, since = ("day", h) if h < 180.0 else ("night", h - 180.0)
    start = jd - since / 360.0
    return part, start, start + 0.5
