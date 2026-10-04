"""Browser bridge: runs engine requests and fetches ephemeris chunks.

Chunks covering the request's date span are fetched in parallel before the
computation starts; any chunk still missing is fetched on demand.
"""
import asyncio
import json

from pyodide.http import pyfetch

from astro_engine import api, ephemeris
from astro_engine.timescale import julian_day

_eph = ephemeris.Ephemeris()
ephemeris.set_default(_eph)

_DATE_KEYS = ("date", "start", "end", "birth_date")


def _dates(obj, out):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k in _DATE_KEYS and isinstance(v, str) and len(v) >= 10:
                try:
                    y, m, d = (int(x) for x in v[:10].split("-"))
                    out.append(julian_day(y, m, d))
                except ValueError:
                    pass
            elif k == "year" and isinstance(v, (int, float, str)):
                try:
                    y = int(v)
                    out.extend([julian_day(y, 1, 1), julian_day(y, 12, 31)])
                except ValueError:
                    pass
            elif isinstance(v, (dict, list)):
                _dates(v, out)
    elif isinstance(obj, list):
        for v in obj:
            _dates(v, out)


def _span(kind, params):
    jds = []
    _dates(params, jds)
    if not jds:
        return None
    a, b = min(jds) - 60.0, max(jds) + 60.0
    if kind == "transits":
        b = max(b, min(jds) + float(params.get("years", 100)) * 365.25 + 60.0,
                max(jds) + 5 * 365.25 + 90.0)
    return a, b


async def _fetch(index):
    resp = await pyfetch("eph/c%03d.bin" % index)
    if not resp.ok:
        raise RuntimeError("could not load ephemeris chunk %d" % index)
    _eph.add_chunk(index, await resp.bytes())


async def _prefetch(kind, params):
    span = _span(kind, params)
    if not span:
        return
    lo = max(ephemeris.FIRST_JD, span[0])
    hi = min(ephemeris.LAST_JD - 1.0, span[1])
    if hi < lo:
        return
    need = [i for i in range(ephemeris.chunk_index(lo), ephemeris.chunk_index(hi) + 1)
            if i not in _eph.chunks]
    for k in range(0, len(need), 24):
        await asyncio.gather(*(_fetch(i) for i in need[k:k + 24]))


async def run(kind, params_json):
    params = json.loads(params_json)
    await _prefetch(kind, params)
    for _ in range(400):
        try:
            return json.dumps(api.dispatch(kind, params))
        except ephemeris.MissingChunk as exc:
            await _fetch(exc.index)
    raise RuntimeError("ephemeris loading did not converge")
