/* Fable of Contents: draws a model from a parts list, pulls it apart, and explains it part by part.
   One file, no build step. Needs three.js r128 and its OrbitControls loaded first. */
"use strict";
(function () {
const $ = id => document.getElementById(id);
function fail(msg) { const e = $("err"); e.hidden = false; e.textContent = "Something went wrong: " + msg; }
window.addEventListener("error", e => fail(e.message || "script error"));
const params = new URLSearchParams(location.search);
const FAST = params.get("shot") === "1";            // screenshot mode, used by tools/check.py
const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- materials ---------- */
const MATS = {
  aluminium: { color: 0xc9d0d4, metalness: .85, roughness: .38 }, steel: { color: 0xa9b0b5, metalness: .9, roughness: .28 },
  copper: { color: 0xc77a48, metalness: .9, roughness: .3 }, brass: { color: 0xc9a24b, metalness: .9, roughness: .32 },
  gold: { color: 0xd8b24a, metalness: .95, roughness: .3 }, titanium: { color: 0x8c8f94, metalness: .8, roughness: .42 },
  darksteel: { color: 0x4b4f55, metalness: .85, roughness: .45 }, anodised: { color: 0x2c3238, metalness: .7, roughness: .5 },
  plastic: { color: 0x23272b, metalness: .05, roughness: .62 }, white: { color: 0xe9ecee, metalness: .05, roughness: .5 },
  red: { color: 0xb5382c, metalness: .2, roughness: .45 }, blue: { color: 0x2c5f9e, metalness: .2, roughness: .45 },
  yellow: { color: 0xd9a521, metalness: .2, roughness: .45 }, rubber: { color: 0x1b1b1b, metalness: 0, roughness: .9 },
  glass: { color: 0xbfe0ea, metalness: .1, roughness: .08 }, ceramic: { color: 0xdcd6c8, metalness: 0, roughness: .7 },
  carbon: { color: 0x1d2024, metalness: .4, roughness: .4 }, pcb: { color: 0x1f4a3a, metalness: .15, roughness: .55 },
  substrate: { color: 0x3f6b58, metalness: .2, roughness: .5 }, die: { color: 0x8d99a3, metalness: .95, roughness: .12 },
  chip: { color: 0x17191c, metalness: .2, roughness: .5 }, choke: { color: 0x4a4f55, metalness: .5, roughness: .55 }
};
const num = (v, d, lo, hi) => { v = Number(v); if (!isFinite(v)) v = d; return Math.min(hi, Math.max(lo, v)); };
const vec = (a, d) => Array.isArray(a) && a.length === 3 ? a.map(v => num(v, 0, -20000, 20000)) : d;
const rad = d => d * Math.PI / 180;

/* ---------- shapes ---------- */
function shape2d(pts) { const s = new THREE.Shape(); pts.forEach((p, i) => i ? s.lineTo(+p[0] || 0, -(+p[1] || 0)) : s.moveTo(+p[0] || 0, -(+p[1] || 0))); s.closePath(); return s; }
function roundRect(w, d, r) {
  r = Math.min(r || 0, w / 2, d / 2); const s = new THREE.Shape(), x = -w / 2, y = -d / 2;
  if (!r) { s.moveTo(x, y); s.lineTo(x + w, y); s.lineTo(x + w, y + d); s.lineTo(x, y + d); s.closePath(); return s; }
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + d - r); s.absarc(x + w - r, y + d - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + d); s.absarc(x + r, y + d - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false); return s;
}
function slab(shape, h, holes) {
  (Array.isArray(holes) ? holes : []).slice(0, 40).forEach(o => {
    const p = new THREE.Path();
    if (o.r) p.absarc(num(o.x, 0, -20000, 20000), -num(o.z, 0, -20000, 20000), num(o.r, 1, .05, 9000), 0, Math.PI * 2, true);
    else { const w = num(o.w, 1, .05, 9000), d = num(o.d, 1, .05, 9000), x = num(o.x, 0, -20000, 20000) - w / 2, y = -num(o.z, 0, -20000, 20000) - d / 2;
      p.moveTo(x, y); p.lineTo(x, y + d); p.lineTo(x + w, y + d); p.lineTo(x + w, y); p.closePath(); }
    shape.holes.push(p);
  });
  const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 40 });
  g.rotateX(-Math.PI / 2); g.translate(0, -h / 2, 0); return g;
}
function turn(g, axis, from) {
  if (from === "y") { if (axis === "x") g.rotateZ(Math.PI / 2); else if (axis === "z") g.rotateX(Math.PI / 2); }
  else { if (axis === "y") g.rotateX(Math.PI / 2); else if (axis === "x") g.rotateY(Math.PI / 2); }
  return g;
}
function geometry(s) {
  const sz = vec(s.size, [10, 10, 10]).map(v => Math.max(.02, Math.abs(v)));
  switch (s.type) {
    case "box": return new THREE.BoxGeometry(sz[0], sz[1], sz[2]);
    case "plate": return slab(roundRect(sz[0], sz[2], num(s.round, 0, 0, 9000)), sz[1], s.holes);
    case "extrude": { const pts = (s.outline || []).filter(p => Array.isArray(p) && p.length === 2).slice(0, 120);
      return pts.length < 3 ? null : slab(shape2d(pts), num(s.h, 1, .02, 9000), s.holes); }
    case "cyl": { const r = num(s.r, 5, 0, 9000);
      return turn(new THREE.CylinderGeometry(num(s.r2, r, 0, 9000), r, num(s.h, 10, .02, 20000), 56, 1, !!s.open), s.axis || "y", "y"); }
    case "torus": return turn(new THREE.TorusGeometry(num(s.R, 10, .05, 9000), num(s.r, 1, .02, 4000), 16, 80), s.axis || "y", "z");
    case "tube": { const pts = (s.path || []).filter(p => Array.isArray(p) && p.length === 3).slice(0, 60).map(p => new THREE.Vector3(+p[0] || 0, +p[1] || 0, +p[2] || 0));
      return pts.length < 2 ? null : new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, !!s.closed, "catmullrom", .15), Math.min(240, pts.length * 18), num(s.r, 2, .02, 4000), 14, !!s.closed); }
    case "lathe": { const pts = (s.profile || []).filter(p => Array.isArray(p) && p.length === 2).slice(0, 80).map(p => new THREE.Vector2(Math.abs(+p[0] || 0), +p[1] || 0));
      return pts.length < 2 ? null : turn(new THREE.LatheGeometry(pts, 64), s.axis || "y", "y"); }
    case "sphere": return new THREE.SphereGeometry(num(s.r, 5, .02, 9000), 44, 28);
  }
  return null;
}

/* ---------- scene ---------- */
const stage = $("stage");
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: FAST });
renderer.setPixelRatio(FAST ? 2 : Math.min(window.devicePixelRatio || 1, 2));
renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.insertBefore(renderer.domElement, stage.firstChild);
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(32, 1, .05, 400);
const controls = new THREE.OrbitControls(camera, renderer.domElement);
Object.assign(controls, { enableDamping: true, dampingFactor: .08, enablePan: false, minDistance: 1, maxDistance: 60, autoRotateSpeed: 1.1 });
scene.add(new THREE.HemisphereLight(0xffffff, 0x8a94a0, .4));
const sun = new THREE.DirectionalLight(0xffffff, 1.1); sun.position.set(4, 9, 5); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 40 }); sun.shadow.bias = -.0004; scene.add(sun);
const fill = new THREE.DirectionalLight(0xbcd8ff, .35); fill.position.set(-6, 3, -4); scene.add(fill);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: .16 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
(function environment() { // a soft studio gradient so metals have something to reflect
  const c = document.createElement("canvas"); c.width = 512; c.height = 256; const x = c.getContext("2d");
  const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, "#ffffff"); g.addColorStop(.45, "#cfd9df"); g.addColorStop(.55, "#8f9aa3"); g.addColorStop(1, "#3c444b");
  x.fillStyle = g; x.fillRect(0, 0, 512, 256); x.fillStyle = "#ffffff"; x.fillRect(60, 40, 110, 46); x.fillRect(300, 30, 150, 36); x.fillStyle = "#ffe9c4"; x.fillRect(200, 96, 60, 20);
  const t = new THREE.CanvasTexture(c); t.mapping = THREE.EquirectangularReflectionMapping; t.encoding = THREE.sRGBEncoding;
  const p = new THREE.PMREMGenerator(renderer); scene.environment = p.fromEquirectangular(t).texture; t.dispose(); p.dispose();
})();
const lineMat = new THREE.LineBasicMaterial({ color: 0x1c2a33, transparent: true, opacity: .55 }), HIGHLIGHT = new THREE.Color(0xd9952a), BLACK = new THREE.Color(0);
function theme() {
  const cs = getComputedStyle(document.documentElement), sheet = cs.getPropertyValue("--sheet").trim() || "#f4f7f8";
  renderer.setClearColor(new THREE.Color(sheet)); const dark = new THREE.Color(sheet).getHSL({}).l < .4;
  lineMat.color.set(dark ? 0x0a1218 : 0x1c2a33); HIGHLIGHT.set(cs.getPropertyValue("--ochre").trim() || "#d9952a");
}
theme(); matchMedia("(prefers-color-scheme: dark)").addEventListener("change", theme);
new MutationObserver(theme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

/* ---------- build a model from a parts list ---------- */
let root = null, parts = [], model = null, selected = null, stages = 1, apart = 0, target = 0, stepIndex = -1, fits = null, focus = null;
function build(spec) {
  if (!spec || !Array.isArray(spec.parts) || !spec.parts.length) throw new Error("this file has no parts");
  if (root) { scene.remove(root); root.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  root = new THREE.Group(); parts = []; selected = null; stepIndex = -1; fits = null; focus = null; apart = 0; target = 0; scene.add(root);
  const seen = new Set();
  spec.parts.slice(0, 60).forEach((p, i) => {
    const id = String(p.id || "part" + i); if (seen.has(id)) return; seen.add(id);
    const part = { id, name: String(p.name || id).slice(0, 40), group: new THREE.Group(), mats: [], spinners: [],
      home: vec(p.pos, [0, 0, 0]), explode: vec(p.explode, [0, 0, 0]), stage: Math.round(num(p.stage, 0, 0, 12)), spin: num(p.spin, 0, -600, 600), axis: p.spinAxis || "y" };
    const body = new THREE.Group();
    (Array.isArray(p.shapes) ? p.shapes : [p.shape || p]).slice(0, 16).forEach(s => {
      const g = s && geometry(s); if (!g) return;
      const m = new THREE.MeshStandardMaterial(MATS[s.material] || MATS[p.material] || MATS.plastic);
      if (/^#[0-9a-f]{6}$/i.test(s.color || "")) m.color.set(s.color);
      m.color.convertSRGBToLinear(); m.envMapIntensity = m.metalness > .4 ? 1 : .25;
      if (s.type === "lathe" || s.type === "tube" || s.open) m.side = THREE.DoubleSide; part.mats.push(m);
      const edges = new THREE.EdgesGeometry(g, 28), sp = vec(s.pos, [0, 0, 0]), sr = vec(s.rot, [0, 0, 0]);
      const radial = Math.round(num(s.radial, 1, 1, 64)), arr = s.array || {}, count = Math.round(num(arr.count, 1, 1, 140)), step = vec(arr.step, [0, 0, 0]);
      const rax = s.radialAxis || "y";
      for (let k = 0; k < radial; k++) for (let n = 0; n < count; n++) {
        const o = new THREE.Group(), mesh = new THREE.Mesh(g, m); mesh.castShadow = mesh.receiveShadow = true; mesh.userData.pid = id;
        o.add(mesh, new THREE.LineSegments(edges, lineMat)); o.rotation.set(rad(sr[0]), rad(sr[1]), rad(sr[2]));
        o.position.set(sp[0] + step[0] * n, sp[1] + step[1] * n, sp[2] + step[2] * n);
        const spoke = new THREE.Group(); spoke.add(o); spoke.rotation[rax === "x" ? "x" : rax === "z" ? "z" : "y"] = k * Math.PI * 2 / radial; body.add(spoke);
      }
    });
    if (!body.children.length) return;
    const pr = vec(p.rot, [0, 0, 0]), spots = Array.isArray(p.at) && p.at.length ? p.at.slice(0, 48).map(a => vec(a, [0, 0, 0])) : [[0, 0, 0]];
    spots.forEach((a, n) => { const inst = n ? body.clone() : body; inst.position.set(a[0], a[1], a[2]); inst.rotation.set(rad(pr[0]), rad(pr[1]), rad(pr[2]));
      part.group.add(inst); if (part.spin) part.spinners.push(inst); });
    root.add(part.group); parts.push(part);
  });
  if (!parts.length) throw new Error("none of the parts could be drawn");
  stages = Math.max(...parts.map(p => p.stage)) + 1; setParts(0);
  const box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
  const unit = 3.2 / Math.max(size.x, size.y, size.z, 1e-6); root.scale.setScalar(unit); root.position.set(-mid.x * unit, -box.min.y * unit + .02, -mid.z * unit);
  model = spec; const title = String(spec.title || "Model").slice(0, 60);
  $("title").textContent = title; $("sub").textContent = String(spec.summary || "Drag to turn it. Pull the slider to take it apart. Tap a part to see what it does.").slice(0, 240);
  const blk = $("block"); blk.textContent = ""; const b = document.createElement("b"); b.textContent = title.slice(0, 40);
  blk.append(b, document.createTextNode("Exploded view · " + parts.length + " parts"), document.createElement("br"), document.createTextNode(String(spec.size || "sizes in mm").slice(0, 40)));
  const chips = $("chips"); chips.textContent = "";
  parts.forEach(p => { const c = document.createElement("button"); c.textContent = p.name; c.setAttribute("aria-pressed", "false"); c.onclick = () => { stopTour(); select(p, true); }; p.chip = c; chips.append(c); });
  const note = $("modelnote"); note.textContent = String(spec.note || "This model and its explanation were written by an AI and may contain mistakes.").slice(0, 400);
  const src = $("sources"); src.textContent = "";
  (Array.isArray(spec.sources) ? spec.sources : []).slice(0, 8).forEach((s, i) => { if (!s || !/^https:\/\//.test(s.url || "")) return;
    const a = document.createElement("a"); a.href = s.url; a.target = "_blank"; a.rel = "noopener"; a.textContent = String(s.title || s.url).slice(0, 90);
    src.append(document.createTextNode(i ? " · " : "Checked against: "), a); });
  $("apart").value = 0; frame(); showStep(-1);
}
const ease = t => t * t * (3 - 2 * t);
function setParts(t) {
  apart = t;
  parts.forEach(p => { const start = stages > 1 ? p.stage / (stages - 1) * .55 : 0, k = ease(Math.min(1, Math.max(0, (t - start) / .45)));
    p.group.position.set(p.home[0] + p.explode[0] * k, p.home[1] + p.explode[1] * k, p.home[2] + p.explode[2] * k); });
}
const fitAt = t => ({ mid: fits[0].mid.clone().lerp(fits[1].mid, t), dist: fits[0].dist + (fits[1].dist - fits[0].dist) * t });
function place(t) { // move the parts and keep the camera's relative zoom as the model grows
  if (fits && !focus) { const a = fitAt(apart), b = fitAt(t), off = camera.position.clone().sub(controls.target).multiplyScalar(b.dist / a.dist);
    controls.target.copy(b.mid); camera.position.copy(b.mid).add(off); }
  setParts(t);
}
function frame() {
  const keep = apart;
  fits = [0, 1].map(t => { setParts(t); const s = new THREE.Box3().setFromObject(root).getBoundingSphere(new THREE.Sphere());
    return { mid: s.center.clone(), dist: s.radius / Math.sin(rad(camera.fov / 2)) * (camera.aspect < 1 ? .86 / camera.aspect : .9) }; });
  setParts(keep); const f = fitAt(keep); controls.target.copy(f.mid);
  camera.position.copy(f.mid).add(new THREE.Vector3(.62, .5, .8).normalize().multiplyScalar(f.dist)); controls.update();
}
function select(p, fromUser) {
  selected = p;
  parts.forEach(o => { const on = o === p, ghost = p && !on; o.chip.setAttribute("aria-pressed", String(on));
    o.mats.forEach(m => { m.emissive.copy(on ? HIGHLIGHT : BLACK); m.emissiveIntensity = on ? .45 : 0; m.transparent = !!ghost; m.opacity = ghost ? .28 : 1; m.depthWrite = !ghost; }); });
  lineMat.opacity = p ? .3 : .55;
  if (p && fromUser) showStep((model.steps || []).findIndex(s => s.part === p.id), p);
  if (p && target < .5) { $("apart").value = 1000; target = 1; }
}
function showStep(i, part) {
  const steps = model.steps || []; stepIndex = i;
  if (i < 0 && !part) { select(null); $("stepn").textContent = "Explanation"; $("stepname").textContent = "How it works"; $("steptext").textContent = "Start the tour, step through the parts, or tap any part."; return; }
  const s = steps[i], p = part || parts.find(o => o.id === (s && s.part));
  if (p && selected !== p) select(p);
  $("stepn").textContent = s ? "Part " + (i + 1) + " of " + steps.length : "Part"; $("stepname").textContent = p ? p.name : "";
  $("steptext").textContent = s ? String(s.say) : "No explanation was written for this part.";
}

/* ---------- tour: the camera visits each part while its explanation shows ---------- */
let tour = null, voice = null;
function lookAt(p) { const s = new THREE.Box3().setFromObject(p.group).getBoundingSphere(new THREE.Sphere()), whole = fitAt(1).dist;
  focus = { mid: s.center.clone(), dist: Math.min(whole, Math.max(s.radius * 4.2, whole * .38)) }; }
function tourStep(i) {
  const steps = model.steps || []; if (!tour) return;
  if (i >= steps.length) { stopTour(true); return; }
  tour.i = i; showStep(i); if (selected) lookAt(selected);
  if (!tour.spoken) tour.timer = setTimeout(() => tourStep(i + 1), Math.max(3500, String(steps[i].say).split(/\s+/).length * 400));
}
function startTour() {
  if (!(model.steps || []).length) return; stopTour();
  $("apart").value = 1000; target = 1; tour = { i: -1, spoken: false }; $("tour").textContent = "Stop tour"; controls.autoRotate = !still;
  if (voice) { tour.spoken = true;
    voice.speak(model.steps.slice(0, 60).map((s, i) => ({ text: String(s.say).slice(0, 1900), id: String(i) }))).then(() => stopTour(true)).catch(() => { if (tour) { tour.spoken = false; tourStep(Math.max(0, tour.i)); } }); }
  else setTimeout(() => tourStep(0), still ? 0 : 900);
}
function stopTour(finished) {
  if (!tour) return; clearTimeout(tour.timer); const spoke = tour.spoken; tour = null; $("tour").textContent = "Start tour"; controls.autoRotate = false;
  if (spoke && voice && !finished) voice.stop();
  if (finished) { showStep(-1); $("apart").value = 0; target = 0; }
  focus = Object.assign(fitAt(finished ? 0 : target), { once: true });
}

/* ---------- controls ---------- */
$("apart").addEventListener("input", e => { target = e.target.value / 1000; });
$("next").onclick = () => { stopTour(); const n = (model.steps || []).length; if (n) showStep((stepIndex + 1) % n); };
$("prev").onclick = () => { stopTour(); const n = (model.steps || []).length; if (n) showStep((stepIndex - 1 + n) % n); };
$("whole").onclick = () => { stopTour(); showStep(-1); $("apart").value = 0; target = 0; };
$("tour").onclick = () => tour ? stopTour() : startTour();
function clean(on) { document.body.classList.toggle("clean", on); $("exitclean").hidden = !on || FAST; setTimeout(resize, 30); }
$("clean").onclick = () => clean(true); $("exitclean").onclick = () => clean(false);
document.addEventListener("keydown", e => {
  if (/INPUT|TEXTAREA/.test(document.activeElement.tagName) || $("view").hidden || e.metaKey || e.ctrlKey) return;
  if (e.key === "c") clean(!document.body.classList.contains("clean"));
  else if (e.key === "t") $("tour").click();
  else if (e.key === " ") { e.preventDefault(); target = target > .5 ? 0 : 1; $("apart").value = target * 1000; }
  else if (e.key === "Escape") clean(false);
});
const ray = new THREE.Raycaster(); let down = null;
renderer.domElement.addEventListener("pointerdown", e => { down = [e.clientX, e.clientY]; focus = null; });
renderer.domElement.addEventListener("pointerup", e => {
  if (!down || !root || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
  const r = renderer.domElement.getBoundingClientRect();
  ray.setFromCamera({ x: (e.clientX - r.left) / r.width * 2 - 1, y: -(e.clientY - r.top) / r.height * 2 + 1 }, camera);
  const hit = ray.intersectObjects(root.children, true).find(h => h.object.isMesh && h.object.userData.pid), p = hit && parts.find(o => o.id === hit.object.userData.pid);
  stopTour(); if (p) select(p, true); else showStep(-1);
});
function resize() { const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); if (root) { const k = apart; frame(); setParts(k); } }
new ResizeObserver(resize).observe(stage);
let last = performance.now(); const tmp = new THREE.Vector3();
let frames = 0;
function tick(now) {
  if (FAST && root && ++frames > 12) return;  // screenshot mode: draw a few frames, then go idle so the capture can finish
  requestAnimationFrame(tick); if ($("view").hidden || !root) return;
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (Math.abs(target - apart) > .0005) place(still || FAST ? target : apart + (target - apart) * Math.min(1, dt * 7));
  if (!still) parts.forEach(p => p.spinners.forEach(s => { s.rotation[p.axis === "x" ? "x" : p.axis === "z" ? "z" : "y"] -= p.spin * dt * Math.PI / 30 * (1 - Math.min(1, apart * 2.5)); }));
  if (focus) { const k = still ? 1 : Math.min(1, dt * 3), off = camera.position.clone().sub(controls.target);
    controls.target.lerp(focus.mid, k); off.setLength(off.length() + (focus.dist - off.length()) * k); camera.position.copy(controls.target).add(off);
    if (focus.once && controls.target.distanceTo(focus.mid) < .01 && Math.abs(off.length() - focus.dist) < .02) focus = null; }
  controls.update(); renderer.render(scene, camera);
  const c = $("callout");
  if (selected) { new THREE.Box3().setFromObject(selected.group).getCenter(tmp).project(camera);
    c.hidden = false; c.textContent = selected.name; c.style.left = ((tmp.x + 1) / 2 * stage.clientWidth) + "px"; c.style.top = ((1 - tmp.y) / 2 * stage.clientHeight) + "px"; }
  else c.hidden = true;
}
requestAnimationFrame(tick);

/* ---------- gallery and routing ---------- */
const embedded = window.FABLE_MODELS || null; let index = [];
const getJSON = url => fetch(url, { cache: "no-store" }).then(r => { if (!r.ok) throw new Error(url + " " + r.status); return r.json(); });
function open(spec) { $("gallery").hidden = true; $("view").hidden = false; resize(); build(spec);
  if (params.get("open") === "1") { $("apart").value = 1000; target = 1; place(1); } if (params.get("clean") === "1") clean(true); }
async function route() {
  const id = decodeURIComponent(location.hash.slice(1)); stopTour(); clean(false);
  if (!id) { $("view").hidden = true; $("gallery").hidden = false; return; }
  const entry = index.find(m => m.id === id); if (!entry) { location.hash = ""; return; }
  try { open(embedded ? embedded.models[id] : await getJSON("models/" + entry.file)); } catch (e) { fail("could not load " + id + " (" + e.message + ")"); }
}
function cards() {
  const box = $("cards"); box.textContent = "";
  index.forEach(m => { const a = document.createElement("a"); a.className = "card"; a.href = "#" + m.id;
    const pic = document.createElement("div"); pic.className = "pic"; const thumb = embedded ? embedded.thumbs && embedded.thumbs[m.id] : "models/" + m.id + ".jpg";
    if (thumb) { const img = document.createElement("img"); img.alt = ""; img.loading = "lazy"; img.src = thumb; img.onerror = () => img.remove(); pic.append(img); }
    const h = document.createElement("b"); h.textContent = m.title; const s = document.createElement("span"); s.textContent = m.parts + " parts";
    const d = document.createElement("p"); d.textContent = m.summary || ""; a.append(pic, h, s, d); box.append(a); });
}
$("file").addEventListener("change", e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader();
  r.onload = () => { try { open(JSON.parse(r.result)); } catch (err) { fail("that file is not a model (" + err.message + ")"); } }; r.readAsText(f); e.target.value = ""; });
(async function start() {
  try { index = embedded ? embedded.index : await getJSON("models/index.json"); } catch (e) { fail("could not load the model list. Open the page through a local web server, not as a file."); }
  cards(); window.addEventListener("hashchange", route); route();
})();

/* ---------- inside Claude: build new models, read aloud, listen ---------- */
(async function claude() {
  const use = window.claude && window.claude.use ? n => window.claude.use(n).catch(() => null) : () => Promise.resolve(null);
  const rules = window.FABLE_PROMPT, sample = rules ? await use("sample") : null;
  if (sample) {
    const ask = $("ask"), q = $("q"), btn = $("askbtn"), state = $("askstate"); ask.hidden = false; let ctl = null;
    const run = async () => {
      const text = q.value.trim(); if (!text) { q.focus(); return; } if (ctl) { ctl.abort(); return; }
      ctl = new AbortController(); btn.textContent = "Stop"; state.classList.remove("err"); state.textContent = "Thinking...";
      try {
        const data = await sample.json(rules + "\n\nModel and explain this: " + text, { modelTier: "complex", signal: ctl.signal, cache: false,
          onText: ({ text }) => { state.textContent = "Drawing... " + text.length + " characters so far"; } });
        open(data); state.textContent = "Built. The model and its explanation come from Claude and can be wrong.";
      } catch (e) { const code = e && e.code; state.classList.add("err");
        state.textContent = code === "not_granted" ? "You declined, so nothing was sent. The saved models still work."
          : code === "rate_limited" ? "Too many requests at once. Wait a minute and try again."
          : code === "invalid_json" ? "Claude's answer was cut off or wasn't a model. Try a simpler object."
          : ctl.signal.aborted ? "Stopped." : "That didn't work (" + (code || e.message || "unknown") + "). Try again."; }
      ctl = null; btn.textContent = "Build it";
    };
    btn.onclick = run; q.addEventListener("keydown", e => { if (e.key === "Enter") run(); });
  }
  const tts = await use("tts");
  if (tts) { voice = tts; tts.onLine(({ id }) => { const i = Number(id); if (tour && isFinite(i)) tourStep(i); }); $("tour").title = "Reads the explanation aloud"; }
  const dict = sample ? await use("dictation") : null;
  if (dict) { const mic = $("mic"), q = $("q"); mic.hidden = false; let on = false, base = "";
    dict.onPartial(({ text }) => { q.value = (base + " " + text).trim(); }); dict.onFinal(({ text }) => { base = (base + " " + text).trim(); q.value = base; });
    dict.onState(({ state: s }) => { on = s === "listening"; mic.textContent = on ? "Stop" : "Speak"; });
    mic.onclick = () => { if (on) { dict.stop().catch(() => {}); return; } base = q.value.trim(); dict.start().catch(() => { mic.hidden = true; }); }; }
})();
})();
