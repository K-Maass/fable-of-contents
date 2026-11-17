---
name: make-model
description: "Build a new pull-apart 3D model from a description and add it to this project's gallery. Use when asked to make, add or model something for Pull-Apart, for example 'make a model of a jet engine' or 'add a door lock'. Writes models/<id>.json, checks and renders it, and updates the gallery list."
---

# Make a model

Turn "a jet engine" into a parts list the page can draw, pull apart and explain.

1. Read `prompt.txt` for the format and the rules, and one existing model in `models/` as the quality bar.
2. Find out how the real thing is built. Open one or two reliable pages and note the parts, how they connect and the rough sizes. Put the pages you opened in the model's `sources` list.
3. Write `models/<id>.json`. Use a short lowercase id with hyphens. Aim for 8 to 20 parts at real size. Use repeated shapes (`array`, `radial`) for fins, blades, bolts and teeth, tubes that actually connect what they feed, and lathe profiles for turned parts.
4. Check and render it:

   ```bash
   python3 tools/check.py models/<id>.json --shot
   ```

   Fix every error. Then look at the two pictures it saves, `models/<id>.jpg` (pulled apart) and `models/<id>-whole.jpg` (assembled). Fix parts that float, intersect, overlap when pulled apart, or stay hidden. Repeat until it reads as the real thing at a glance.
5. Write the `steps` in the order energy, force, fluid or signal moves through it. One or two plain sentences per part. A number only if a page you opened gives it.
6. Add `summary` and `note` (how generic or simplified it is, and what was checked).
7. Update the gallery list and look at it in the page:

   ```bash
   python3 tools/index.py
   python3 -m http.server 8000
   ```

   Then open `http://localhost:8000/#<id>`.

Don't invent facts about the machine. If a page can't be opened, say in `note` that the model was not checked against a source.
