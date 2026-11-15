/**
 * models3d.js — every 3D object, built from a handful of primitives in a clean CAD / telemetry style:
 * flat-shaded solids with dark outlines, no textures, no dynamic shadows. Each building carries a
 * status light on top (what it is doing) and a dust bar (how dirty it is), so the scene reads like a
 * live process diagram.
 *
 * One world unit = one grid cell. `THREE` is passed in so this file has no imports of its own.
 */

const STATUS_COLOR = {
  ok: 0x4ee68a, idle: 0xf2b84f, off: 0x6b7280, nopower: 0xff5c5c, unconnected: 0xff5c5c, broken: 0xff5c5c,
  breached: 0xff2020, cold: 0x7fb8ff, dry: 0xf2b84f, noCO2: 0xf2b84f, dead: 0x8b5a2b,
};
export const statusColor = (code) => STATUS_COLOR[code] ?? 0x6b7280;

/** Shape recipe per building: a list of parts [kind, colour, size..., position...]. */
const RECIPES = {
  habitat: [["cyl", 0xdfe6f5, 0.42, 0.42, 0.5, 0, 0.25, 0], ["dome", 0xdfe6f5, 0.42, 0, 0.5, 0], ["box", 0x4ea1ff, 0.22, 0.12, 0.05, 0, 0.3, 0.42]],
  tunnel: [["box", 0xb9c2d6, 0.96, 0.26, 0.4, 0, 0.13, 0], ["box", 0x4ea1ff, 0.06, 0.3, 0.44, 0, 0.15, 0]],
  airlock_n2: [["box", 0xc9d2e6, 0.6, 0.5, 0.6, 0, 0.25, 0], ["box", 0xf2b84f, 0.3, 0.36, 0.05, 0, 0.2, 0.3], ["cyl", 0x9ad0ff, 0.08, 0.08, 0.4, 0.32, 0.25, 0]],
  suitport: [["box", 0xc9d2e6, 0.7, 0.4, 0.4, 0, 0.2, 0], ["box", 0xffffff, 0.16, 0.36, 0.14, -0.18, 0.25, 0.26], ["box", 0xffffff, 0.16, 0.36, 0.14, 0.18, 0.25, 0.26]],
  solar: [["box", 0x55607a, 0.06, 0.3, 0.06, 0, 0.15, 0], ["panel", 0x2f5fd0, 0.9, 0.04, 0.6, 0, 0.34, 0, -0.5]],
  vsat: [["cyl", 0x8a93a8, 0.05, 0.07, 1.6, 0, 0.8, 0], ["box", 0x2f5fd0, 0.9, 0.9, 0.04, 0, 1.25, 0], ["box", 0x55607a, 0.3, 0.1, 0.3, 0, 0.05, 0]],
  kilopower: [["cyl", 0x8a93a8, 0.16, 0.2, 0.5, 0, 0.25, 0], ["cyl", 0xb48cff, 0.1, 0.1, 0.5, 0, 0.75, 0], ["cyl", 0xdfe6f5, 0.42, 0.42, 0.03, 0, 1.02, 0]],
  battery: [["box", 0x3d4a66, 0.7, 0.36, 0.5, 0, 0.18, 0], ["box", 0x4ee68a, 0.5, 0.04, 0.3, 0, 0.38, 0]],
  rfc: [["cyl", 0x4ea1ff, 0.2, 0.2, 0.55, -0.22, 0.28, 0], ["cyl", 0xff8a5c, 0.2, 0.2, 0.55, 0.22, 0.28, 0], ["box", 0x3d4a66, 0.8, 0.12, 0.5, 0, 0.06, 0]],
  laser_tx: [["cyl", 0x8a93a8, 0.08, 0.14, 0.7, 0, 0.35, 0], ["box", 0xff5c5c, 0.3, 0.2, 0.3, 0, 0.8, 0]],
  laser_rx: [["cyl", 0x8a93a8, 0.06, 0.1, 0.4, 0, 0.2, 0], ["dish", 0xdfe6f5, 0.4, 0, 0.55, 0]],
  radiator: [["box", 0x55607a, 0.06, 0.5, 0.06, 0, 0.25, 0], ["box", 0xe8ecf5, 0.9, 0.6, 0.03, 0, 0.5, 0]],
  ice_extractor: [["box", 0x3d6a8a, 0.7, 0.3, 0.7, 0, 0.15, 0], ["cone", 0xbfe6ff, 0.3, 0.5, 0, 0.55, 0], ["cyl", 0x8a93a8, 0.06, 0.06, 0.5, 0.3, 0.4, 0.3]],
  regolith_mine: [["box", 0x8a6a3a, 0.7, 0.3, 0.6, 0, 0.15, 0], ["box", 0xf2b84f, 0.12, 0.12, 0.7, 0.2, 0.45, 0, 0, 0.6], ["cyl", 0x55607a, 0.18, 0.18, 0.12, 0.2, 0.6, 0.3]],
  electrolyzer: [["box", 0x2f5fd0, 0.6, 0.5, 0.5, 0, 0.25, 0], ["cyl", 0x9ad0ff, 0.1, 0.1, 0.6, -0.2, 0.6, 0], ["cyl", 0xff8a5c, 0.1, 0.1, 0.6, 0.2, 0.6, 0]],
  ilmenite_reactor: [["cyl", 0x7a3e20, 0.34, 0.4, 0.5, 0, 0.25, 0], ["dish", 0xf2d24f, 0.5, 0, 0.75, 0], ["cyl", 0xff8a24, 0.12, 0.12, 0.2, 0, 0.55, 0]],
  cryo_plant: [["box", 0x9ad0ff, 0.6, 0.45, 0.6, 0, 0.23, 0], ["cyl", 0xffffff, 0.14, 0.14, 0.3, 0, 0.6, 0]],
  cryo_tank: [["sphere", 0xe8ecf5, 0.3, -0.22, 0.32, 0], ["sphere", 0x9ad0ff, 0.3, 0.22, 0.32, 0], ["box", 0x55607a, 0.9, 0.06, 0.4, 0, 0.03, 0]],
  fabricator: [["box", 0x6b7280, 0.8, 0.5, 0.7, 0, 0.25, 0], ["box", 0xf2b84f, 0.5, 0.06, 0.4, 0, 0.53, 0]],
  sabatier: [["cyl", 0xc0552a, 0.25, 0.25, 0.7, 0, 0.35, 0], ["cyl", 0x8a93a8, 0.08, 0.08, 0.9, 0.3, 0.45, 0]],
  co2_scrubber: [["box", 0x8a93a8, 0.5, 0.5, 0.4, 0, 0.25, 0], ["cyl", 0x55607a, 0.14, 0.14, 0.1, 0, 0.55, 0]],
  biodome: [["cyl", 0x3d4a66, 0.46, 0.46, 0.12, 0, 0.06, 0], ["dome", 0x4ee68a, 0.46, 0, 0.12, 0, 0.45]],
  bioremediation: [["box", 0x6a4a2a, 0.7, 0.3, 0.6, 0, 0.15, 0], ["cyl", 0x4ee68a, 0.16, 0.16, 0.4, 0, 0.5, 0]],
  cupola: [["cyl", 0xb9c2d6, 0.3, 0.3, 0.2, 0, 0.1, 0], ["dome", 0x9ad0ff, 0.3, 0, 0.2, 0, 0.5]],
  geodesic_biosphere: [["cyl", 0x3d4a66, 0.49, 0.49, 0.1, 0, 0.05, 0], ["dome", 0x7fe6b0, 0.49, 0, 0.1, 0, 0.4, 1.5]],
  lab: [["box", 0xc9b8ff, 0.7, 0.4, 0.6, 0, 0.2, 0], ["cyl", 0xb48cff, 0.05, 0.05, 0.5, 0.25, 0.65, 0.2], ["sphere", 0xb48cff, 0.08, 0.25, 0.92, 0.2]],
  rover_bay: [["box", 0x55607a, 0.9, 0.3, 0.8, 0, 0.15, 0], ["box", 0xf2b84f, 0.9, 0.05, 0.1, 0, 0.32, 0.36]],
  seismic_radar: [["cyl", 0x8a93a8, 0.05, 0.1, 0.5, 0, 0.25, 0], ["dish", 0xc9a27a, 0.36, 0, 0.6, 0]],
  lava_seal: [["cyl", 0x8a93a8, 0.45, 0.45, 0.3, 0, 0.15, 0], ["cyl", 0xf2b84f, 0.3, 0.3, 0.32, 0, 0.16, 0]],
  telescope: [["cyl", 0x3d4a66, 0.3, 0.36, 0.3, 0, 0.15, 0], ["cyl", 0xdfe6f5, 0.2, 0.26, 0.8, 0, 0.7, 0, 0.5]],
  eds: [["box", 0x1f6f8a, 0.8, 0.06, 0.8, 0, 0.03, 0], ["cyl", 0x5ff0d0, 0.05, 0.05, 0.6, 0, 0.3, 0], ["sphere", 0x5ff0d0, 0.1, 0, 0.65, 0]],
  sinter_laser: [["box", 0x55607a, 0.5, 0.3, 0.5, 0, 0.15, 0], ["cyl", 0xff5c5c, 0.06, 0.1, 0.5, 0, 0.5, 0, 0.6]],
  heavy_pad: [["cyl", 0x4a4f5c, 0.5, 0.5, 0.06, 0, 0.03, 0], ["cyl", 0xf2b84f, 0.34, 0.34, 0.07, 0, 0.035, 0], ["cyl", 0x4a4f5c, 0.28, 0.28, 0.08, 0, 0.04, 0]],
  ntr_assembly: [["box", 0x55607a, 0.9, 0.2, 0.9, 0, 0.1, 0], ["cyl", 0xe8ecf5, 0.16, 0.2, 1.3, 0, 0.85, 0], ["cone", 0xff8a5c, 0.16, 0.3, 0, 1.65, 0], ["box", 0x8a93a8, 0.06, 1.4, 0.06, 0.36, 0.7, 0.36]],
};

export function createModelFactory(THREE) {
  const matCache = new Map(), geoCache = new Map();
  const mat = (color, opts = {}) => {
    const key = `${color}|${opts.opacity ?? 1}`;
    if (!matCache.has(key)) matCache.set(key, new THREE.MeshLambertMaterial({ color, flatShading: true, transparent: (opts.opacity ?? 1) < 1, opacity: opts.opacity ?? 1 }));
    return matCache.get(key);
  };
  const lineMat = new THREE.LineBasicMaterial({ color: 0x0b1020, transparent: true, opacity: 0.55 });
  const geo = (key, make) => { if (!geoCache.has(key)) geoCache.set(key, make()); return geoCache.get(key); };

  /** A solid with a dark outline: the "CAD" look. */
  function solid(geometry, color, opts) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geometry, mat(color, opts)));
    g.add(new THREE.LineSegments(geo(`e${geometry.uuid}`, () => new THREE.EdgesGeometry(geometry, 30)), lineMat));
    return g;
  }

  function part(p) {
    const [kind, color] = p;
    let m;
    if (kind === "box") { const [, , w, h, d, x, y, z, rx = 0, rz = 0] = p; m = solid(geo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)), color); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); }
    else if (kind === "panel") { const [, , w, h, d, x, y, z, rx = 0] = p; m = solid(geo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)), color); m.position.set(x, y, z); m.rotation.x = rx; }
    else if (kind === "cyl") { const [, , rt, rb, h, x, y, z, rx = 0] = p; m = solid(geo(`c${rt},${rb},${h}`, () => new THREE.CylinderGeometry(rt, rb, h, 12)), color); m.position.set(x, y, z); m.rotation.x = rx; }
    else if (kind === "cone") { const [, , r, h, x, y, z] = p; m = solid(geo(`k${r},${h}`, () => new THREE.ConeGeometry(r, h, 10)), color); m.position.set(x, y, z); }
    else if (kind === "sphere") { const [, , r, x, y, z] = p; m = solid(geo(`s${r}`, () => new THREE.SphereGeometry(r, 10, 8)), color); m.position.set(x, y, z); }
    else if (kind === "dome") { const [, , r, x, y, z, opacity = 1, squash = 1] = p; m = solid(geo(`d${r}`, () => new THREE.SphereGeometry(r, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2)), color, { opacity }); m.position.set(x, y, z); m.scale.y = squash > 1 ? 1 : 1; }
    else if (kind === "dish") { const [, , r, x, y, z] = p; m = solid(geo(`h${r}`, () => new THREE.SphereGeometry(r, 12, 5, 0, Math.PI * 2, 0, Math.PI / 3)), color); m.position.set(x, y + r * 0.5, z); m.rotation.x = Math.PI; }
    return m;
  }

  /**
   * A building: its shape, a status light and a dust bar.
   * Returns { group, setStatus(code), setDust(0..1), setHealth(0..100) }.
   */
  function building(type) {
    const group = new THREE.Group();
    const body = new THREE.Group();
    for (const p of RECIPES[type] ?? [["box", 0x8a93a8, 0.6, 0.4, 0.6, 0, 0.2, 0]]) body.add(part(p));
    group.add(body);
    const top = type === "vsat" || type === "ntr_assembly" ? 2.0 : type === "kilopower" ? 1.25 : 1.05;
    const lightMat = new THREE.MeshBasicMaterial({ color: STATUS_COLOR.ok });
    const light = new THREE.Mesh(geo("light", () => new THREE.SphereGeometry(0.07, 8, 6)), lightMat);
    light.position.set(0.36, top, -0.36);
    group.add(light);
    // dust bar: grey track with an orange fill, only shown when there is dust
    const track = new THREE.Mesh(geo("track", () => new THREE.BoxGeometry(0.7, 0.03, 0.05)), new THREE.MeshBasicMaterial({ color: 0x1b2440 }));
    const fill = new THREE.Mesh(geo("fill", () => new THREE.BoxGeometry(1, 0.035, 0.055)), new THREE.MeshBasicMaterial({ color: 0xf08a24 }));
    track.position.set(0, top + 0.12, 0.42); fill.position.set(0, top + 0.12, 0.42);
    group.add(track, fill);
    track.visible = fill.visible = false;
    return {
      group,
      setStatus(code) { lightMat.color.setHex(statusColor(code)); },
      setDust(d) { const on = d > 0.03; track.visible = fill.visible = on; if (on) { fill.scale.x = Math.max(0.02, 0.7 * d); fill.position.x = -0.35 + (0.7 * d) / 2; } },
      setHealth(hp) { body.rotation.z = hp < 100 ? ((100 - hp) / 100) * 0.25 : 0; body.position.y = hp < 100 ? -((100 - hp) / 100) * 0.12 : 0; }, // sunk and tilted when damaged
    };
  }

  function astronaut() {
    const g = new THREE.Group();
    g.add(part(["cyl", 0xf5f7fb, 0.11, 0.13, 0.32, 0, 0.3, 0]), part(["sphere", 0xf5f7fb, 0.12, 0, 0.56, 0]), part(["box", 0x4ea1ff, 0.14, 0.08, 0.04, 0, 0.57, 0.1]), part(["box", 0xc9d2e6, 0.16, 0.2, 0.08, 0, 0.36, -0.12]));
    g.add(part(["cyl", 0xdfe6f5, 0.05, 0.05, 0.16, -0.06, 0.08, 0]), part(["cyl", 0xdfe6f5, 0.05, 0.05, 0.16, 0.06, 0.08, 0]));
    return g;
  }
  function rover() {
    const g = new THREE.Group();
    g.add(part(["box", 0xf2b84f, 0.5, 0.14, 0.34, 0, 0.2, 0]), part(["box", 0x2f5fd0, 0.3, 0.02, 0.3, 0, 0.3, 0]));
    for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) { const w = part(["cyl", 0x2a3140, 0.09, 0.09, 0.06, x, 0.09, z]); w.rotation.x = Math.PI / 2; g.add(w); }
    return g;
  }
  function crystal() {
    const g = new THREE.Group();
    const m = new THREE.Mesh(geo("crystal", () => new THREE.OctahedronGeometry(0.22)), new THREE.MeshBasicMaterial({ color: 0xb48cff }));
    m.position.y = 0.35; m.scale.y = 1.6; g.add(m);
    return g;
  }
  function pipe() {
    return new THREE.Mesh(geo("pipe", () => new THREE.BoxGeometry(0.34, 0.07, 0.34)), mat(0x4ea1ff));
  }
  /** The Earth: a blue sphere with green patches, low on the horizon. */
  function earth() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.SphereGeometry(1.6, 20, 14), new THREE.MeshBasicMaterial({ color: 0x3b7bd6 })));
    for (const [a, b, s] of [[0.4, 0.5, 0.5], [2.2, -0.3, 0.6], [3.6, 0.6, 0.4], [5.1, -0.5, 0.45]]) {
      const c = new THREE.Mesh(new THREE.SphereGeometry(s, 8, 6), new THREE.MeshBasicMaterial({ color: 0x4ee68a }));
      c.position.set(1.4 * Math.cos(a) * Math.cos(b), 1.4 * Math.sin(b), 1.4 * Math.sin(a) * Math.cos(b)); g.add(c);
    }
    return g;
  }
  /** Ring drawn on the ground (EDS reach, selection). */
  function ring(radius, color) {
    const pts = [];
    for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]]) pts.push(new THREE.Vector3(x * radius, 0.04, z * radius));
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color }));
  }

  return { building, astronaut, rover, crystal, pipe, earth, ring, mat };
}

export const BUILDING_TYPES_WITH_MODEL = Object.keys(RECIPES);
