# Pull-Apart

A web page that draws a 3D model from a parts list, pulls it apart in order and explains each part. Models are plain JSON files, written by an AI from a description.

## Where things go

- `index.html`, `style.css`, `viewer.js`: the page. No build step, no dependencies to install. three.js loads from a CDN.
- `models/<id>.json`: one model each. `models/<id>.jpg` and `<id>-whole.jpg` are its pictures. `models/index.json` is the gallery list, rebuilt by `tools/index.py`.
- `prompt.txt`: the model format and the rules for writing one. It is the single source: the Claude page sends it to Claude, and the `make-model` skill reads it.
- `tools/check.py`: validates a model and renders its pictures. `tools/build.py`: packs everything into `dist/claude-page.html` for publishing as a Claude page.
- `.agents/skills/make-model/`: the skill for adding a model with a coding agent.

## Rules

- The page never runs code from a model file. It reads values and clamps them. Keep it that way.
- A change to the format goes into `prompt.txt`, `tools/check.py` and `viewer.js` together.
- After changing `viewer.js`, run `python3 tools/check.py models/graphics-card.json --shot` and look at the pictures.
- Every model says in `note` how generic it is and what was checked, and lists the pages it was checked against in `sources`.
- No keys, tokens or personal data in this repository. It is meant to be public.

## How this project fits

It owns the viewer, the model format and the models. It reads nothing from other projects and sends nothing to them.
