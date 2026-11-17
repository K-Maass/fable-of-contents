#!/usr/bin/env python3
"""Rebuild models/index.json from the model files in models/. Run after adding or changing a model."""
import json, os, glob
root = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models")
order = {"graphics-card": 0, "rocket-engine": 1}
rows = []
for path in sorted(glob.glob(os.path.join(root, "*.json"))):
    mid = os.path.splitext(os.path.basename(path))[0]
    if mid == "index": continue
    m = json.load(open(path))
    rows.append({"id": mid, "file": mid + ".json", "title": m.get("title", mid), "parts": len(m.get("parts", [])), "summary": m.get("summary", "")})
rows.sort(key=lambda r: (order.get(r["id"], 9), r["title"]))
json.dump(rows, open(os.path.join(root, "index.json"), "w"), indent=1)
print(len(rows), "models:", ", ".join(r["id"] for r in rows))
