"""Split JPL DE440s (SPK type 2) into fixed-length binary chunks.

Each chunk holds the unmodified Chebyshev records of every segment for
CHUNK_DAYS days, so the engine can evaluate DE440 with no external library.

Chunk layout (little-endian):
    b"AEPH" | uint32 version | uint32 chunk_index | uint32 n_segments
    per segment:
        int32 center | int32 target | float64 first_record_start_jd
        float64 interval_days | int32 record_size | int32 n_records
        float64[record_size * n_records] records
"""
import json
import os
import struct
import sys

from jplephem.spk import SPK

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, "de440s.bsp")
OUT = os.path.join(ROOT, "web", "eph")

EPOCH_JD = 2396752.5
CHUNK_DAYS = 384.0
VERSION = 1
KEEP = {
    (0, 1), (0, 2), (0, 3), (0, 4), (0, 5), (0, 6), (0, 7), (0, 8), (0, 9),
    (0, 10), (3, 301), (3, 399), (1, 199), (2, 299),
}


def main():
    os.makedirs(OUT, exist_ok=True)
    kernel = SPK.open(SRC)
    segs = []
    for s in kernel.segments:
        if (s.center, s.target) not in KEEP:
            continue
        init, intlen, rsize, n = s.daf.read_array(s.end_i - 3, s.end_i)
        rsize = int(rsize)
        n = int(n)
        data = s.daf.read_array(s.start_i, s.end_i - 4)
        segs.append({
            "center": s.center,
            "target": s.target,
            "init_jd": 2451545.0 + init / 86400.0,
            "interval_days": intlen / 86400.0,
            "rsize": rsize,
            "n": n,
            "data": data,
            "end_jd": s.end_jd,
        })

    end_jd = min(s["end_jd"] for s in segs)
    n_chunks = int((end_jd - EPOCH_JD) // CHUNK_DAYS) + 1
    manifest = {
        "source": "JPL DE440s",
        "epoch_jd": EPOCH_JD,
        "chunk_days": CHUNK_DAYS,
        "n_chunks": n_chunks,
        "start_jd": EPOCH_JD,
        "end_jd": end_jd,
        "version": VERSION,
    }

    total = 0
    for ci in range(n_chunks):
        c0 = EPOCH_JD + ci * CHUNK_DAYS
        c1 = min(c0 + CHUNK_DAYS, end_jd)
        parts = [b"AEPH", struct.pack("<III", VERSION, ci, len(segs))]
        for s in segs:
            iv = s["interval_days"]
            r0 = int((c0 - s["init_jd"]) // iv)
            r1 = int(-((-(c1 - s["init_jd"])) // iv))
            r0 = max(0, min(r0, s["n"] - 1))
            r1 = max(r0 + 1, min(r1, s["n"]))
            rs = s["rsize"]
            block = s["data"][r0 * rs:r1 * rs]
            first = s["init_jd"] + r0 * iv
            parts.append(struct.pack(
                "<iiddii", s["center"], s["target"], first, iv, rs, r1 - r0,
            ))
            parts.append(struct.pack("<%dd" % len(block), *block))
        blob = b"".join(parts)
        total += len(blob)
        with open(os.path.join(OUT, "c%03d.bin" % ci), "wb") as f:
            f.write(blob)

    with open(os.path.join(OUT, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2)
    print("chunks", n_chunks, "bytes", total, "avg", total // n_chunks)


if __name__ == "__main__":
    sys.exit(main())
