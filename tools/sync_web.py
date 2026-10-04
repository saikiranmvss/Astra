"""Copy the Python engine into web/py and write the file manifest the
browser loader uses. Optionally copy a Pyodide runtime into web/pyodide.

    python tools/sync_web.py [--pyodide-dir PATH]
"""
import hashlib
import json
import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, "engine", "astro_engine")
DST = os.path.join(ROOT, "web", "py", "astro_engine")
PYODIDE_FILES = ("pyodide.js", "pyodide.asm.js", "pyodide.asm.wasm",
                 "python_stdlib.zip", "pyodide-lock.json")


def main(argv):
    if os.path.isdir(DST):
        shutil.rmtree(DST)
    os.makedirs(DST)
    files = []
    digest = hashlib.sha256()
    for name in sorted(os.listdir(SRC)):
        if not name.endswith(".py"):
            continue
        shutil.copy2(os.path.join(SRC, name), os.path.join(DST, name))
        files.append("astro_engine/" + name)
        with open(os.path.join(SRC, name), "rb") as f:
            digest.update(f.read())
    manifest = {"files": files, "version": digest.hexdigest()[:12]}
    with open(os.path.join(ROOT, "web", "py", "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2)
    print("engine files", len(files), "version", manifest["version"])

    if "--pyodide-dir" in argv:
        src = argv[argv.index("--pyodide-dir") + 1]
        out = os.path.join(ROOT, "web", "pyodide")
        os.makedirs(out, exist_ok=True)
        for name in PYODIDE_FILES:
            shutil.copy2(os.path.join(src, name), os.path.join(out, name))
        print("pyodide runtime copied from", src)


if __name__ == "__main__":
    main(sys.argv[1:])
