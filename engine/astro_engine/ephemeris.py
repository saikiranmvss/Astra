"""JPL DE440 evaluation from chunked Chebyshev records (SPK type 2).

Chunks are produced by tools/build_ephemeris.py. Positions are km,
velocities km/day, time argument is TDB Julian Date.
"""
import struct
from array import array

from .constants import DAY_S, J2000

EPOCH_JD = 2396752.5
CHUNK_DAYS = 384.0
FIRST_JD = 2396752.5
LAST_JD = 2506352.5


class MissingChunk(Exception):
    def __init__(self, index):
        Exception.__init__(self, "ephemeris chunk %d not loaded" % index)
        self.index = index


class OutOfRange(Exception):
    pass


class _Segment(object):
    __slots__ = ("first", "interval", "rsize", "n", "data")


def chunk_index(jd_tdb):
    return int((jd_tdb - EPOCH_JD) // CHUNK_DAYS)


class Ephemeris(object):
    def __init__(self, loader=None):
        self.loader = loader
        self.chunks = {}

    def add_chunk(self, index, blob):
        blob = bytes(blob)
        if blob[:4] != b"AEPH":
            raise ValueError("bad ephemeris chunk %d" % index)
        _ver, ci, nseg = struct.unpack_from("<III", blob, 4)
        pos = 16
        segs = {}
        for _ in range(nseg):
            center, target, first, iv, rs, n = struct.unpack_from("<iiddii", blob, pos)
            pos += struct.calcsize("<iiddii")
            nbytes = rs * n * 8
            data = array("d")
            data.frombytes(blob[pos:pos + nbytes])
            pos += nbytes
            seg = _Segment()
            seg.first = first
            seg.interval = iv
            seg.rsize = rs
            seg.n = n
            seg.data = data
            segs[(center, target)] = seg
        self.chunks[ci] = segs

    def _segment(self, center, target, jd):
        if jd < FIRST_JD or jd >= LAST_JD:
            raise OutOfRange("date outside DE440s coverage (1849-12-26 .. 2150-01-22)")
        ci = chunk_index(jd)
        segs = self.chunks.get(ci)
        if segs is None:
            if self.loader is None:
                raise MissingChunk(ci)
            self.add_chunk(ci, self.loader(ci))
            segs = self.chunks[ci]
        return segs[(center, target)]

    def state(self, center, target, jd_tdb):
        """Position (km) and velocity (km/day) of target relative to center."""
        seg = self._segment(center, target, jd_tdb)
        i = int((jd_tdb - seg.first) // seg.interval)
        if i < 0:
            i = 0
        elif i >= seg.n:
            i = seg.n - 1
        rs = seg.rsize
        base = i * rs
        d = seg.data
        mid = d[base]
        radius = d[base + 1]
        ncoef = (rs - 2) // 3
        s = ((jd_tdb - J2000) * DAY_S - mid) / radius
        s2 = 2.0 * s
        pos = [0.0, 0.0, 0.0]
        vel = [0.0, 0.0, 0.0]
        for k in range(3):
            off = base + 2 + k * ncoef
            # Chebyshev T_n and derivative via recurrences
            t0, t1 = 1.0, s
            dt0, dt1 = 0.0, 1.0
            p = d[off] + d[off + 1] * s
            v = d[off + 1]
            for j in range(2, ncoef):
                t2 = s2 * t1 - t0
                dt2 = 2.0 * t1 + s2 * dt1 - dt0
                c = d[off + j]
                p += c * t2
                v += c * dt2
                t0, t1 = t1, t2
                dt0, dt1 = dt1, dt2
            pos[k] = p
            vel[k] = v * DAY_S / radius
        return pos, vel


_DEFAULT = None


def default():
    global _DEFAULT
    if _DEFAULT is None:
        _DEFAULT = Ephemeris()
    return _DEFAULT


def set_default(eph):
    global _DEFAULT
    _DEFAULT = eph


def file_loader(directory):
    import os

    def load(index):
        with open(os.path.join(directory, "c%03d.bin" % index), "rb") as f:
            return f.read()

    return load
