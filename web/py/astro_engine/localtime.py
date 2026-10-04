"""Civil time zone handling: a default UTC offset plus explicit changes.

The browser resolves the IANA zone (DST history) and sends
{"tz_minutes": offset_at_start, "tz_changes": [[jd_utc, minutes], ...]}.
"""
from .timescale import calendar, format_jd, julian_day


class LocalTime(object):
    def __init__(self, tz_minutes=330.0, changes=None):
        self.default = float(tz_minutes)
        self.changes = sorted((float(j), float(m)) for j, m in (changes or []))

    @classmethod
    def from_params(cls, p):
        return cls(p.get("tz_minutes", 330), p.get("tz_changes"))

    def offset(self, jd_utc):
        off = self.default
        for j, m in self.changes:
            if jd_utc >= j:
                off = m
            else:
                break
        return off

    def iso(self, jd_utc):
        if jd_utc is None:
            return None
        return format_jd(jd_utc + self.offset(jd_utc) / 1440.0)

    def midnight(self, y, m, d):
        """UTC JD of local midnight starting the civil date."""
        jd0 = julian_day(y, m, d)
        off = self.offset(jd0 - self.default / 1440.0)
        return jd0 - off / 1440.0

    def date_of(self, jd_utc):
        y, m, d = calendar(jd_utc + self.offset(jd_utc) / 1440.0)[:3]
        return y, m, d

    def date_str(self, jd_utc):
        return "%04d-%02d-%02d" % self.date_of(jd_utc)


def weekday(y, m, d):
    """0 = Sunday."""
    import math
    return int(math.floor(julian_day(y, m, d) + 0.5) + 1) % 7
