// Runs the engine inside Pyodide (WebAssembly) under Node to measure the
// browser execution path. Usage: node tests/pyodide_node_test.mjs <node_modules dir>
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const require = createRequire(path.join(process.argv[2], "x.js"));
const { loadPyodide } = require("pyodide");

const t0 = Date.now();
const py = await loadPyodide({ indexURL: path.join(root, "web", "pyodide") + path.sep });
console.log("pyodide boot ms", Date.now() - t0);

const manifest = JSON.parse(fs.readFileSync(path.join(root, "web", "py", "manifest.json")));
py.FS.mkdirTree("/home/pyodide/astro_engine");
for (const f of manifest.files) {
  py.FS.writeFile("/home/pyodide/" + f, fs.readFileSync(path.join(root, "web", "py", f)));
}
globalThis.readChunk = (i) => new Uint8Array(
  fs.readFileSync(path.join(root, "web", "eph", `c${String(i).padStart(3, "0")}.bin`)));
py.runPython(`
import sys, json
sys.path.insert(0, "/home/pyodide")
from js import readChunk
from astro_engine import api, ephemeris
ephemeris.set_default(ephemeris.Ephemeris(lambda i: readChunk(i).to_bytes()))
`);
for (const [kind, params] of [
  ["chart", { date: "1998-12-10", time: "18:10", tz_minutes: 330, lat: 18.576216339514087, lon: 83.3587995791954 }],
  ["chart", { date: "1998-12-10", time: "18:10", tz_minutes: 330, lat: 18.576216339514087, lon: 83.3587995791954 }],
  ["panchanga", { date: "2027-01-08", lat: 17.385, lon: 78.4867, tz_minutes: 330 }],
  ["panchanga", { date: "2027-04-07", lat: 17.385, lon: 78.4867, tz_minutes: 330 }],
]) {
  const t = Date.now();
  py.globals.set("P", JSON.stringify(params));
  const out = JSON.parse(py.runPython(`json.dumps(api.dispatch("${kind}", json.loads(P)))`));
  const ms = Date.now() - t;
  if (kind === "chart") {
    console.log(kind, ms, "ms", out.chart.lagna.rashi.name, out.chart.grahas.Moon.nakshatra.name,
      "D10", out.vargas.D10.positions.Lagna.sign, out.dasha.current.map((d) => d.lord).join(">"));
  } else {
    console.log(kind, ms, "ms", out.sunrise, out.tithi[0].name, out.lunar_month.name, out.year.samvatsara);
  }
}
