#!/usr/bin/env python3
"""Build dist/claude-page.html: the whole project as one file for publishing as a Claude page.
The published page has the models built in and, inside Claude, can ask Claude for new ones."""
import base64, json, os, re
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
read = lambda *p: open(os.path.join(root, *p), encoding="utf-8").read()
html = read("index.html")
body = re.search(r"<body>(.*)</body>", html, re.S).group(1)
body = body.replace('<script src="viewer.js"></script>', "")
font = re.search(r'<link rel="stylesheet" href="https://fonts[^>]+>', html).group(0)
index = json.loads(read("models", "index.json"))
models = {m["id"]: json.loads(read("models", m["file"])) for m in index}
thumbs = {}
for m in index:
    p = os.path.join(root, "models", m["id"] + ".jpg")
    if os.path.exists(p): thumbs[m["id"]] = "data:image/jpeg;base64," + base64.b64encode(open(p, "rb").read()).decode()
data = json.dumps({"index": index, "models": models, "thumbs": thumbs}).replace("</", "<\\/")
page = (f'<title>Pull-Apart</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n{font}\n<style>\n{read("style.css")}</style>\n{body}'
        f'<script>window.PULL_APART_MODELS = {data};\nwindow.PULL_APART_PROMPT = {json.dumps(read("prompt.txt"))};</script>\n<script>\n{read("viewer.js")}</script>\n')
os.makedirs(os.path.join(root, "dist"), exist_ok=True)
open(os.path.join(root, "dist", "claude-page.html"), "w", encoding="utf-8").write(page)
print("dist/claude-page.html", len(page) // 1024, "KB,", len(models), "models")
