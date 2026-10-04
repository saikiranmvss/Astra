/* Runs the Python engine (Pyodide) off the main thread. */
importScripts("pyodide/pyodide.js");

let ready = null;

async function boot() {
  const base = new URL("./", self.location.href).href;
  const py = await loadPyodide({ indexURL: base + "pyodide/" });
  const manifest = await (await fetch("py/manifest.json", { cache: "no-cache" })).json();
  py.FS.mkdirTree("/home/pyodide/astro_engine");
  const files = manifest.files.concat(["bridge.py"]);
  await Promise.all(files.map(async (f) => {
    const res = await fetch("py/" + f + "?v=" + manifest.version);
    if (!res.ok) throw new Error("failed to load " + f);
    py.FS.writeFile("/home/pyodide/" + f, await res.text());
  }));
  py.runPython("import sys\nsys.path.insert(0, '/home/pyodide')\nfrom bridge import run");
  return { py, run: py.globals.get("run"), version: manifest.version };
}

self.onmessage = async (ev) => {
  const { id, kind, params } = ev.data;
  try {
    if (!ready) ready = boot();
    const eng = await ready;
    if (kind === "ping") {
      self.postMessage({ id, ok: true, result: { version: eng.version } });
      return;
    }
    const out = await eng.run(kind, JSON.stringify(params));
    self.postMessage({ id, ok: true, result: JSON.parse(out) });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err && err.message ? err.message : err) });
  }
};
