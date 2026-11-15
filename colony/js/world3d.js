/**
 * world3d.js — the 3D view: a light Three.js scene in a CAD / telemetry style.
 * The ground is a grid of tiles (one per simulation cell) whose colour is either the zone or one of
 * the four data layers; buildings, pipes, rovers, the astronaut and the Earth sit on top.
 * No dynamic shadows, no post-processing: all the detail is in the data.
 *
 * The view never changes the simulation. It reads the state every frame and reports clicks.
 */
import { C, cellAt, layerValue, illumination, earthElevationDeg, SCENARIOS } from "./simulation.js";
import { createModelFactory } from "./models3d.js";
import { getMode } from "./gameModes.js";

const ZONE_COLOR = { rim: 0xb9b3a6, plains: 0x8a8f9c, psr: 0x232a3d, tube: 0x4a3f36, jezero: 0xb5653a, psyche: 0x7c8794 };
const ZONE_HEIGHT = { rim: 0.7, plains: 0, psr: -1.1, jezero: 0, psyche: 0 };
const SUB_Y = -3.2;

/** Height of the ground at a cell, so everything stands on it. */
export function groundY(state, x, y, layer = "s") {
  if (layer === "u") return SUB_Y;
  const c = cellAt(state, x, y);
  return c ? ZONE_HEIGHT[c.zone] ?? 0 : 0;
}

const lerp = (a, b, t) => a + (b - a) * t;
function rgb(THREE, r, g, b) { return new THREE.Color(r, g, b); }
/** Colour of a data-layer value. */
function layerColor(THREE, layer, v) {
  if (v === null || v === undefined) return rgb(THREE, 0.12, 0.14, 0.2);
  if (layer === 1) return v < 0.45 ? rgb(THREE, 0.95, lerp(0.15, 0.55, v / 0.45), 0.15) : rgb(THREE, lerp(0.9, 0.2, (v - 0.45) / 0.55), 0.85, 0.3);
  if (layer === 2) return v > 0 ? rgb(THREE, 0.98, 0.84, 0.3) : rgb(THREE, 0.1, 0.16, 0.42);
  if (layer === 3) return v < 0 ? rgb(THREE, 0.2, 0.85, 0.9) : rgb(THREE, lerp(0.2, 1, v), lerp(0.24, 0.5, v), lerp(0.34, 0.1, v));
  if (layer === 4) return v >= 1 ? rgb(THREE, 0.25, 0.9, 0.5) : v >= 0.75 ? rgb(THREE, 0.3, 0.6, 1) : v >= 0.5 ? rgb(THREE, 0.95, 0.72, 0.3) : rgb(THREE, 1, 0.3, 0.3);
  return rgb(THREE, 0.5, 0.5, 0.5);
}

export class World3D {
  /**
   * @param {object} THREE      the three.js module
   * @param {HTMLElement} container
   * @param {{onPick?:(x:number,y:number,layer:string)=>void, onHover?:(x:number|null,y:number|null,layer:string)=>void}} handlers
   */
  constructor(THREE, container, handlers = {}) {
    this.T = THREE; this.container = container; this.handlers = handlers;
    this.layer = 0; this.view = "s"; this.modeId = "realista";
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "low-power" });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 400);
    this.cam = { theta: -0.5, phi: 0.82, dist: 40, target: new THREE.Vector3(C.GRID_W / 2, 0, C.GRID_H / 2) };
    this.ambient = new THREE.AmbientLight(0xffffff, 0.55);
    this.sun = new THREE.DirectionalLight(0xffffff, 1.1);
    this.sun.position.set(-20, 30, -10);
    this.lamp = new THREE.PointLight(0xffffff, 0, 12, 1.5); // the astronaut's light (horror, underground)
    this.scene.add(this.ambient, this.sun, this.lamp);
    this.models = createModelFactory(THREE);
    this.surface = new THREE.Group(); this.under = new THREE.Group(); this.under.visible = false;
    this.scene.add(this.surface, this.under);
    this.objs = { buildings: new Map(), rovers: new Map(), crystals: new Map(), pipes: new Map(), rings: [] };
    this.pipeSig = "";
    this.colorT = 0; this.time = 0;
    this._makeSky();
    this._makeCursor();
    this._bindInput();
    this.resize();
  }

  // ───────────── construction ─────────────
  _makeSky() {
    const T = this.T, n = 500, pos = new Float32Array(n * 3);
    let s = 12345;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < n; i++) { const a = r() * Math.PI * 2, e = r() * 1.2, d = 150; pos[i * 3] = Math.cos(a) * Math.cos(e) * d + 14; pos[i * 3 + 1] = Math.sin(e) * d; pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * d + 10; }
    const g = new T.BufferGeometry(); g.setAttribute("position", new T.BufferAttribute(pos, 3));
    this.stars = new T.Points(g, new T.PointsMaterial({ color: 0xffffff, size: 0.7, sizeAttenuation: true }));
    this.scene.add(this.stars);
    this.earth = this.models.earth();
    this.scene.add(this.earth);
  }
  _makeCursor() {
    this.hoverRing = this.models.ring(0.5, 0xffffff); this.hoverRing.visible = false;
    this.selectRing = this.models.ring(0.52, 0xf2d24f); this.selectRing.visible = false;
    this.scene.add(this.hoverRing, this.selectRing);
    this.player = this.models.astronaut();
    this.scene.add(this.player);
  }

  /** Build the ground for a state (new game, loaded game or a new world after launch). */
  rebuild(state) {
    const T = this.T;
    for (const g of [this.surface, this.under]) while (g.children.length) g.remove(g.children[0]);
    for (const m of Object.values(this.objs)) if (m instanceof Map) m.clear();
    this.objs.rings = []; this.pipeSig = "";
    const n = C.GRID_W * C.GRID_H;
    const box = new T.BoxGeometry(0.97, 1, 0.97);
    this.tiles = new T.InstancedMesh(box, new T.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), n);
    this.subTiles = new T.InstancedMesh(box, new T.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), n);
    const m = new T.Matrix4(), q = new T.Quaternion(), white = new T.Color(1, 1, 1);
    for (let y = 0; y < C.GRID_H; y++) for (let x = 0; x < C.GRID_W; x++) {
      const i = y * C.GRID_W + x, c = state.grid[i], h = ZONE_HEIGHT[c.zone] ?? 0;
      // each tile is a column down to a common base, so height steps read as cliffs
      const depth = h + 1.6;
      m.compose(new T.Vector3(x + 0.5, h - depth / 2, y + 0.5), q, new T.Vector3(1, depth, 1));
      this.tiles.setMatrixAt(i, m); this.tiles.setColorAt(i, white);
      const open = state.sub[i].open;
      m.compose(new T.Vector3(x + 0.5, SUB_Y - 0.1, y + 0.5), q, new T.Vector3(open ? 1 : 0.0001, 0.2, open ? 1 : 0.0001));
      this.subTiles.setMatrixAt(i, m); this.subTiles.setColorAt(i, white);
    }
    this.surface.add(this.tiles); this.under.add(this.subTiles);
    this.buildingLayerS = new T.Group(); this.buildingLayerU = new T.Group();
    this.surface.add(this.buildingLayerS); this.under.add(this.buildingLayerU);
    this.colorT = 0;
    this._recolor(state);
  }

  setMode(modeId) {
    this.modeId = modeId;
    const m = getMode(modeId), T = this.T;
    this.scene.background = new T.Color(m.palette.bg);
    this.scene.fog = m.rules.lightCone ? new T.FogExp2(0x010402, 0.016) : null;
  }
  setLayer(n) { this.layer = n === this.layer ? 0 : n; this.colorT = 0; }
  setView(v) { this.view = v === "u" ? "u" : "s"; this.surface.visible = this.view === "s"; this.under.visible = this.view === "u"; this.colorT = 0; }
  focus(x, y) { this.cam.target.set(x + 0.5, this.view === "u" ? SUB_Y : 0, y + 0.5); }
  select(x, y, layerId) { this.sel = x === null ? null : { x, y, layer: layerId }; }

  // ───────────── per-frame sync ─────────────
  _recolor(state) {
    const T = this.T, horror = getMode(this.modeId).rules.lightCone;
    for (let y = 0; y < C.GRID_H; y++) for (let x = 0; x < C.GRID_W; x++) {
      const i = y * C.GRID_W + x, c = state.grid[i];
      let col;
      if (this.layer) col = layerColor(T, this.layer, layerValue(state, this.layer, x, y, "s"));
      else {
        col = new T.Color(ZONE_COLOR[c.zone] ?? 0x888888);
        if (c.paved) col = new T.Color(0x3c4a6e);                          // sintered glass
        else { const k = 1 - 0.25 * (1 - c.stability / 100); col.multiplyScalar(k); if (c.dust > 0.2) col.lerp(new T.Color(0xd9b98a), Math.min(0.5, c.dust)); }
        if (c.ice > 0 && c.zone === "psr") col.lerp(new T.Color(0x6fb6e8), 0.18);
        if ((x + y) % 2) col.multiplyScalar(0.96);                         // faint checker so the grid reads
        if (horror) { const g = (col.r + col.g + col.b) / 3; col.setRGB(g * 0.35, g * 1.1, g * 0.5); }
      }
      this.tiles.setColorAt(i, col);
      const sc = state.sub[i];
      if (sc.open) this.subTiles.setColorAt(i, this.layer === 4 ? layerColor(T, 4, layerValue(state, 4, x, y, "u")) : new T.Color((x + y) % 2 ? 0x54473c : 0x4a3f36));
    }
    this.tiles.instanceColor.needsUpdate = true; this.subTiles.instanceColor.needsUpdate = true;
  }

  _syncBuildings(state) {
    const seen = new Set();
    for (const b of state.buildings) {
      seen.add(b.id);
      let o = this.objs.buildings.get(b.id);
      if (!o) {
        o = this.models.building(b.type);
        o.group.position.set(b.x + 0.5, groundY(state, b.x, b.y, b.layer), b.y + 0.5);
        (b.layer === "u" ? this.buildingLayerU : this.buildingLayerS).add(o.group);
        this.objs.buildings.set(b.id, o);
      }
      o.setStatus(b.status); o.setDust(b.dust); o.setHealth(b.hp);
      o.group.visible = true;
    }
    for (const [id, o] of this.objs.buildings) if (!seen.has(id)) { o.group.parent?.remove(o.group); this.objs.buildings.delete(id); }
  }
  _syncPipes(state) {
    let sig = "";
    for (let i = 0; i < state.grid.length; i++) { if (state.grid[i].pipe) sig += `s${i},`; if (state.sub[i].pipe) sig += `u${i},`; }
    if (sig === this.pipeSig) return;
    this.pipeSig = sig;
    for (const [, m] of this.objs.pipes) m.parent?.remove(m);
    this.objs.pipes.clear();
    const add = (i, layerId) => {
      const x = i % C.GRID_W, y = Math.floor(i / C.GRID_W), m = this.models.pipe();
      m.position.set(x + 0.5, groundY(state, x, y, layerId) + 0.04, y + 0.5);
      (layerId === "u" ? this.buildingLayerU : this.buildingLayerS).add(m);
      this.objs.pipes.set(`${layerId}${i}`, m);
    };
    for (let i = 0; i < state.grid.length; i++) { if (state.grid[i].pipe) add(i, "s"); if (state.sub[i].pipe) add(i, "u"); }
  }
  _syncMovers(state) {
    const seen = new Set();
    for (const r of state.rovers) {
      seen.add(r.id);
      let m = this.objs.rovers.get(r.id);
      if (!m) { m = this.models.rover(); this.buildingLayerS.add(m); this.objs.rovers.set(r.id, m); }
      const gx = Math.round(r.x), gy = Math.round(r.y);
      m.position.set(r.x + 0.5, groundY(state, gx, gy) + 0.02, r.y + 0.5);
      m.rotation.z = r.stuck ? 0.5 : 0;
    }
    for (const [id, m] of this.objs.rovers) if (!seen.has(id)) { m.parent?.remove(m); this.objs.rovers.delete(id); }
    const keys = new Set(state.crystals.map((c) => `${c.x},${c.y}`));
    for (const c of state.crystals) {
      const k = `${c.x},${c.y}`;
      if (!this.objs.crystals.has(k)) { const m = this.models.crystal(); m.position.set(c.x + 0.5, groundY(state, c.x, c.y), c.y + 0.5); this.buildingLayerS.add(m); this.objs.crystals.set(k, m); }
    }
    for (const [k, m] of this.objs.crystals) { if (!keys.has(k)) { m.parent?.remove(m); this.objs.crystals.delete(k); } else m.rotation.y = this.time * 1.5; }
    // the astronaut
    const p = state.player;
    this.player.visible = (p.layer === "u") === (this.view === "u");
    const ty = groundY(state, p.x, p.y, p.layer);
    this.player.position.x = lerp(this.player.position.x, p.x + 0.5, 0.25);
    this.player.position.z = lerp(this.player.position.z, p.y + 0.5, 0.25);
    this.player.position.y = lerp(this.player.position.y, ty, 0.25);
  }
  _syncRings(state) {
    for (const r of this.objs.rings) r.parent?.remove(r);
    this.objs.rings = [];
    if (this.layer !== 3 || this.view !== "s") return;
    for (const b of state.buildings) if (b.type === "eds") {
      const r = this.models.ring(C.EDS_RADIUS + 0.5, 0x5ff0d0);
      r.position.set(b.x + 0.5, groundY(state, b.x, b.y) + 0.05, b.y + 0.5);
      this.scene.add(r); this.objs.rings.push(r);
    }
  }
  _syncLight(state) {
    const horror = getMode(this.modeId).rules.lightCone;
    const lit = illumination(state, 13, 8) > 0, sc = SCENARIOS[state.scenario];
    const day = lit ? 1 : 0;
    // at night a faint cool fill light stands in for earthshine, so the base stays readable
    this.sun.intensity = lerp(this.sun.intensity, horror ? 0.25 * day : (day ? 1.15 : 0.3) * (state.events.storm ? 0.35 : 1), 0.05);
    this.sun.color.setHex(day ? 0xffffff : 0x9fb8ff);
    this.ambient.intensity = lerp(this.ambient.intensity, this.view === "u" ? 0.5 : horror ? (this.layer ? 0.7 : 0.13) : this.layer ? 0.95 : day ? 0.6 : 0.5, 0.05);
    // the sun circles low around the horizon over the cycle
    const a = ((state.t % sc.cycleH) / sc.cycleH) * Math.PI * 2;
    this.sun.position.set(14 + Math.cos(a) * 40, 14, 10 + Math.sin(a) * 40);
    const p = this.player.position;
    this.lamp.position.set(p.x, p.y + 1.6, p.z);
    this.lamp.intensity = horror ? 16 : this.view === "u" ? 6 : day ? 0 : 3; // three r160 uses physical units: this is a hand lamp, not a floodlight
    // Earth low over the horizon, rocking with libration
    const el = (earthElevationDeg(state) * Math.PI) / 180;
    this.earth.visible = state.scenario === "moon" && this.view === "s";
    this.earth.position.set(14, Math.sin(el) * 90, 10 - Math.cos(el) * 90);
    this.earth.rotation.y = state.t * 0.26;
    this.stars.visible = this.view === "s";
  }

  /** Read the state and update the scene. `dt` in real seconds. */
  sync(state, dt = 0.016) {
    if (!this.tiles) this.rebuild(state);
    this.time += dt;
    this.colorT -= dt;
    if (this.colorT <= 0) { this._recolor(state); this._syncRings(state); this.colorT = 0.5; }
    this._syncBuildings(state); this._syncPipes(state); this._syncMovers(state); this._syncLight(state);
    if (this.sel && (this.sel.layer === "u") === (this.view === "u")) { this.selectRing.visible = true; this.selectRing.position.set(this.sel.x + 0.5, groundY(state, this.sel.x, this.sel.y, this.sel.layer) + 0.02, this.sel.y + 0.5); }
    else this.selectRing.visible = false;
    this._state = state;
  }

  render() {
    const c = this.cam, T = this.T;
    c.phi = Math.min(1.45, Math.max(0.25, c.phi)); c.dist = Math.min(60, Math.max(6, c.dist));
    this.camera.position.set(c.target.x + c.dist * Math.sin(c.phi) * Math.sin(c.theta), c.target.y + c.dist * Math.cos(c.phi), c.target.z + c.dist * Math.sin(c.phi) * Math.cos(c.theta));
    this.camera.lookAt(c.target instanceof T.Vector3 ? c.target : new T.Vector3());
    this.renderer.render(this.scene, this.camera);
  }
  resize() {
    const w = this.container.clientWidth || 800, h = this.container.clientHeight || 600;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = "100%"; this.renderer.domElement.style.height = "100%";
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  // ───────────── input ─────────────
  _cellFromEvent(ev) {
    if (!this.tiles) return null;
    const T = this.T, r = this.renderer.domElement.getBoundingClientRect();
    const v = new T.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    const ray = new T.Raycaster(); ray.setFromCamera(v, this.camera);
    const mesh = this.view === "u" ? this.subTiles : this.tiles;
    const hit = ray.intersectObject(mesh, false)[0];
    if (!hit || hit.instanceId === undefined) return null;
    const i = hit.instanceId;
    return { x: i % C.GRID_W, y: Math.floor(i / C.GRID_W), layer: this.view };
  }
  _bindInput() {
    const el = this.renderer.domElement;
    let drag = null;
    el.addEventListener("contextmenu", (e) => e.preventDefault());
    el.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, moved: 0, button: e.button, pan: e.button === 1 || e.shiftKey }; el.setPointerCapture(e.pointerId); });
    el.addEventListener("pointermove", (e) => {
      if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        drag.moved += Math.abs(dx) + Math.abs(dy); drag.x = e.clientX; drag.y = e.clientY;
        if (drag.moved > 6) {
          if (drag.pan) { // slide the target over the ground plane
            const k = this.cam.dist * 0.0016, c = Math.cos(this.cam.theta), s = Math.sin(this.cam.theta);
            this.cam.target.x -= (dx * c + dy * s) * k; this.cam.target.z -= (-dx * s + dy * c) * k;
            this.cam.target.x = Math.min(C.GRID_W, Math.max(0, this.cam.target.x)); this.cam.target.z = Math.min(C.GRID_H, Math.max(0, this.cam.target.z));
          } else if (drag.button === 2 || e.pointerType === "touch" || drag.button === 0) { this.cam.theta -= dx * 0.006; this.cam.phi -= dy * 0.005; }
        }
        return;
      }
      const c = this._cellFromEvent(e);
      this.hoverRing.visible = !!c;
      if (c && this._state) this.hoverRing.position.set(c.x + 0.5, groundY(this._state, c.x, c.y, c.layer) + 0.03, c.y + 0.5);
      this.handlers.onHover?.(c ? c.x : null, c ? c.y : null, this.view);
    });
    el.addEventListener("pointerup", (e) => {
      const d = drag; drag = null;
      if (!d || d.moved > 6 || d.button !== 0) return;
      const c = this._cellFromEvent(e);
      if (c) this.handlers.onPick?.(c.x, c.y, c.layer);
    });
    el.addEventListener("wheel", (e) => { e.preventDefault(); this.cam.dist *= e.deltaY > 0 ? 1.1 : 0.9; }, { passive: false });
    el.addEventListener("pointerleave", () => { this.hoverRing.visible = false; });
  }
}
