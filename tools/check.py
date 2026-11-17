#!/usr/bin/env python3
"""Check a model file against the format, and optionally render it to a picture.

    python3 tools/check.py models/graphics-card.json            # validate
    python3 tools/check.py models/graphics-card.json --shot     # validate, then save models/<id>.jpg (pulled apart) and <id>-whole.jpg
"""
import json, os, subprocess, sys, threading, http.server, functools, shutil, tempfile

SHAPES = {"box", "plate", "extrude", "cyl", "tube", "lathe", "torus", "sphere"}
MATS = set("aluminium steel darksteel titanium copper brass gold anodised plastic white red blue yellow rubber glass ceramic carbon pcb substrate die chip choke".split())
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def v3(a): return isinstance(a, list) and len(a) == 3 and all(isinstance(x, (int, float)) for x in a)

def validate(m):
    errs, warns = [], []
    if not isinstance(m.get("title"), str): errs.append("title is missing")
    parts = m.get("parts")
    if not isinstance(parts, list) or not parts: return ["parts is missing or empty"], warns
    if not 3 <= len(parts) <= 60: warns.append(f"{len(parts)} parts; 8 to 20 reads best")
    ids = set()
    for i, p in enumerate(parts):
        pid = p.get("id"); where = f"part {pid or i}"
        if not isinstance(pid, str): errs.append(f"{where}: id is missing")
        elif pid in ids: errs.append(f"{where}: id used twice")
        ids.add(pid)
        if not isinstance(p.get("name"), str): errs.append(f"{where}: name is missing")
        for k in ("pos", "rot", "explode"):
            if k in p and not v3(p[k]): errs.append(f"{where}: {k} must be three numbers")
        if not any(p.get("explode", [0, 0, 0])): warns.append(f"{where}: does not move when pulled apart")
        shapes = p.get("shapes")
        if not isinstance(shapes, list) or not shapes: errs.append(f"{where}: shapes is missing or empty"); continue
        for s in shapes:
            t = s.get("type")
            if t not in SHAPES: errs.append(f"{where}: unknown shape type {t!r}")
            if "material" in s and s["material"] not in MATS: warns.append(f"{where}: unknown material {s['material']!r} (drawn as plastic)")
            if t in ("box", "plate") and not v3(s.get("size")): errs.append(f"{where}: {t} needs size [x,y,z]")
            if t == "extrude" and len(s.get("outline", [])) < 3: errs.append(f"{where}: extrude needs an outline of 3 or more points")
            if t == "tube" and len(s.get("path", [])) < 2: errs.append(f"{where}: tube needs a path of 2 or more points")
            if t == "lathe" and len(s.get("profile", [])) < 2: errs.append(f"{where}: lathe needs a profile of 2 or more points")
            if t in ("cyl", "sphere") and not isinstance(s.get("r"), (int, float)): errs.append(f"{where}: {t} needs r")
    steps = m.get("steps", [])
    if not steps: warns.append("no steps: the tour will have nothing to say")
    for s in steps:
        if s.get("part") not in ids: errs.append(f"step refers to unknown part {s.get('part')!r}")
        if not isinstance(s.get("say"), str) or not s["say"].strip(): errs.append(f"step for {s.get('part')!r} has no text")
    told = {s.get("part") for s in steps}
    for pid in ids - told: warns.append(f"part {pid}: no step explains it")
    for s in m.get("sources", []):
        if not str(s.get("url", "")).startswith("https://"): errs.append("each source needs an https url")
    return errs, warns

def shots(path):
    mid = os.path.splitext(os.path.basename(path))[0]
    tmp = tempfile.mkdtemp()
    for f in ("index.html", "style.css", "viewer.js"): shutil.copy(os.path.join(ROOT, f), tmp)
    os.mkdir(os.path.join(tmp, "models")); shutil.copy(path, os.path.join(tmp, "models", mid + ".json"))
    json.dump([{"id": mid, "file": mid + ".json", "title": mid, "parts": 0}], open(os.path.join(tmp, "models", "index.json"), "w"))
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    handler = functools.partial(Quiet, directory=tmp)
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler); threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{srv.server_port}/index.html?shot=1&clean=1"
    out = []
    for name, q in ((mid + ".jpg", "&open=1"), (mid + "-whole.jpg", "")):
        png = os.path.join(tmp, "shot.png")
        try:
            run = subprocess.run([CHROME, "--headless=new", "--use-angle=metal", "--hide-scrollbars",
                                  "--enable-logging=stderr", "--v=0", "--window-size=800,600", "--virtual-time-budget=4000", f"--screenshot={png}", f"{base}{q}#{mid}"],
                                 capture_output=True, text=True, timeout=90)
        except subprocess.TimeoutExpired:
            print("render timed out"); break
        for line in run.stderr.splitlines():
            if "CONSOLE" in line and ("Uncaught" in line or "Error" in line) and "404" not in line: print("PAGE ERROR:", line.split("CONSOLE", 1)[1][:200])
        dest = os.path.join(os.path.dirname(os.path.abspath(path)), name)
        subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", "70", png, "--out", dest], stdout=subprocess.DEVNULL, check=True)
        out.append(dest)
    srv.shutdown(); shutil.rmtree(tmp, ignore_errors=True)
    return out

if __name__ == "__main__":
    if len(sys.argv) < 2: sys.exit(__doc__)
    path = sys.argv[1]
    try: m = json.load(open(path))
    except Exception as e: sys.exit(f"not valid JSON: {e}")
    errs, warns = validate(m)
    for w in warns: print("warning:", w)
    for e in errs: print("ERROR:", e)
    print(f"{len(m.get('parts', []))} parts, {len(m.get('steps', []))} steps, {len(errs)} errors, {len(warns)} warnings")
    if errs: sys.exit(1)
    if "--shot" in sys.argv:
        for p in shots(path): print("saved", p)
