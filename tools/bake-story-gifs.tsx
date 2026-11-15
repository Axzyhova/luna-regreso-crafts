// Developer tool: renders one intro scene with the game's own drawScene() into a GIF89a file.
// Run it as described in tools/README.md. It has no dependencies: the encoder below is self-contained
// (median-cut palette of 255 colours + LZW + frame differencing with a transparent index).
import { drawScene, type SceneId } from "@/components/game/StoryAnimation";

const W = 320, H = 160;
const DELAY = 8;            // 1/100 s per frame → 12.5 fps
const FRAMES = 88;          // 88 × 0.08 s ≈ one 7 s loop (the scene's LOOP)
const STEP = DELAY / 100;
const TRANSP = 255;         // palette index kept free for "unchanged pixel"

type Rgb = [number, number, number];

function medianCut(hist: Map<number, number>, n: number): Rgb[] {
  type Item = { r: number; g: number; b: number; c: number };
  const items: Item[] = [];
  for (const [k, c] of hist) items.push({ r: (k >> 12) & 63, g: (k >> 6) & 63, b: k & 63, c });
  const boxes: Item[][] = [items];
  const range = (bx: Item[]) => {
    let r0 = 63, r1 = 0, g0 = 63, g1 = 0, b0 = 63, b1 = 0;
    for (const i of bx) { r0 = Math.min(r0, i.r); r1 = Math.max(r1, i.r); g0 = Math.min(g0, i.g); g1 = Math.max(g1, i.g); b0 = Math.min(b0, i.b); b1 = Math.max(b1, i.b); }
    return [r1 - r0, g1 - g0, b1 - b0] as const;
  };
  const score = (bx: Item[]) => { const [a, b, c] = range(bx); let pop = 0; for (const i of bx) pop += i.c; return Math.max(a, b, c) * Math.sqrt(pop); };
  while (boxes.length < n) {
    let bi = -1, best = 0;
    boxes.forEach((bx, i) => { if (bx.length < 2) return; const s = score(bx); if (s > best) { best = s; bi = i; } });
    if (bi < 0) break;
    const bx = boxes[bi]!, [a, b, c] = range(bx);
    const ch = a >= b && a >= c ? "r" : b >= c ? "g" : "b";
    bx.sort((p, q) => p[ch] - q[ch]);
    let total = 0; for (const i of bx) total += i.c;
    let acc = 0, cut = 1;
    for (let i = 0; i < bx.length - 1; i++) { acc += bx[i]!.c; cut = i + 1; if (acc >= total / 2) break; }
    boxes.splice(bi, 1, bx.slice(0, cut), bx.slice(cut));
  }
  const exp = (v: number) => Math.min(255, Math.round((v * 255) / 63));
  return boxes.map((bx) => {
    let r = 0, g = 0, b = 0, t = 0;
    for (const i of bx) { r += i.r * i.c; g += i.g * i.c; b += i.b * i.c; t += i.c; }
    return [exp(r / t), exp(g / t), exp(b / t)] as Rgb;
  });
}

/** GIF flavour of LZW, with the usual "clear" code when the 4096-entry table fills up. */
function lzw(index: Uint8Array, minCode = 8): number[] {
  const out: number[] = [minCode];
  let sub: number[] = [];
  const flushSub = (force: boolean) => { if (sub.length === 255 || (force && sub.length)) { out.push(sub.length, ...sub); sub = []; } };
  const clear = 1 << minCode, eoi = clear + 1;
  let next = eoi + 1, size = minCode + 1, cur = 0, shift = 0;
  const pushBytes = (min: number) => { while (shift >= min) { sub.push(cur & 255); cur >>= 8; shift -= 8; flushSub(false); } };
  const emit = (code: number) => { cur |= code << shift; shift += size; pushBytes(8); };
  let table = new Map<number, number>();
  let prefix = index[0]!;
  emit(clear);
  for (let i = 1; i < index.length; i++) {
    const k = index[i]!, key = (prefix << 8) | k, hit = table.get(key);
    if (hit === undefined) {
      emit(prefix);
      if (next === 4096) { emit(clear); next = eoi + 1; size = minCode + 1; table = new Map(); }
      else { if (next >= 1 << size) size++; table.set(key, next++); }
      prefix = k;
    } else prefix = hit;
  }
  emit(prefix); emit(eoi); pushBytes(1);
  flushSub(true);
  out.push(0);
  return out;
}

async function render(scene: SceneId) {
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const g = cv.getContext("2d", { willReadFrequently: true })!;
  const frames: Uint8ClampedArray[] = [];
  const hist = new Map<number, number>();
  for (let i = 0; i < FRAMES; i++) {
    g.clearRect(0, 0, W, H);
    drawScene(g, scene, i * STEP);
    const d = g.getImageData(0, 0, W, H).data;
    frames.push(d);
    for (let p = 0; p < d.length; p += 4) { const k = ((d[p]! >> 2) << 12) | ((d[p + 1]! >> 2) << 6) | (d[p + 2]! >> 2); hist.set(k, (hist.get(k) ?? 0) + 1); }
  }
  const pal = medianCut(hist, 255);
  const nearest = new Int16Array(1 << 18).fill(-1);
  const toIdx = (r: number, gg: number, b: number) => {
    const k = ((r >> 2) << 12) | ((gg >> 2) << 6) | (b >> 2);
    let v = nearest[k]!;
    if (v < 0) {
      let best = 1e9;
      for (let j = 0; j < pal.length; j++) { const q = pal[j]!; const dd = (q[0] - r) ** 2 + (q[1] - gg) ** 2 + (q[2] - b) ** 2; if (dd < best) { best = dd; v = j; } }
      nearest[k] = v;
    }
    return v;
  };
  const bytes: number[] = [];
  const w16 = (v: number) => bytes.push(v & 255, v >> 8);
  bytes.push(...[..."GIF89a"].map((c) => c.charCodeAt(0)));
  w16(W); w16(H); bytes.push(0xf7, 0, 0);
  for (let j = 0; j < 256; j++) bytes.push(...(pal[j] ?? [0, 0, 0]));
  bytes.push(0x21, 0xff, 0x0b, ...[..."NETSCAPE2.0"].map((c) => c.charCodeAt(0)), 0x03, 0x01, 0, 0, 0); // loop forever
  const shown = new Uint8Array(W * H); // what the viewer currently sees, as palette indexes
  let totalChanged = 0;
  frames.forEach((d, f) => {
    const idx = new Uint8Array(W * H);
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const p = y * W + x;
      let v = toIdx(d[p * 4]!, d[p * 4 + 1]!, d[p * 4 + 2]!);
      if (f > 0) { // keep the pixel as it is when the new colour is (nearly) the displayed one
        const a = pal[shown[p]!]!, b = pal[v]!;
        if ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2 <= 12) v = shown[p]!;
      }
      idx[p] = v;
      if (f === 0 || v !== shown[p]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 < 0) { x0 = 0; y0 = 0; x1 = 0; y1 = 0; } // nothing changed: a 1-pixel transparent frame
    const fw = x1 - x0 + 1, fh = y1 - y0 + 1, sub = new Uint8Array(fw * fh);
    for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
      const p = (y + y0) * W + (x + x0);
      const changed = f === 0 || idx[p] !== shown[p];
      sub[y * fw + x] = changed ? idx[p]! : TRANSP;
      if (changed) { shown[p] = idx[p]!; totalChanged++; }
    }
    bytes.push(0x21, 0xf9, 0x04, (1 << 2) | 1, DELAY & 255, DELAY >> 8, TRANSP, 0); // keep the frame, index 255 is transparent
    bytes.push(0x2c); w16(x0); w16(y0); w16(fw); w16(fh); bytes.push(0);
    bytes.push(...lzw(sub));
  });
  bytes.push(0x3b);
  return { bytes: new Uint8Array(bytes), changedPct: Math.round((100 * totalChanged) / (W * H * FRAMES)) };
}

const b64 = (u: Uint8Array) => { let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };

const scene = (new URLSearchParams(location.search).get("scene") ?? "launch") as SceneId;
render(scene).then(({ bytes, changedPct }) => {
  // The result goes into the page so a headless browser can dump it (see tools/README.md).
  document.body.innerHTML = `<pre id="meta">${scene} bytes=${bytes.length} changed=${changedPct}%</pre><pre id="gif">${b64(bytes)}</pre>`;
});
