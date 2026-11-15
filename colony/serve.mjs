// Tiny static server for local play:  node serve.mjs  → http://localhost:8080
// (ES modules don't load from file://, so the simulator needs to be served. Any static host works; GitHub Pages too.)
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)));
const port = Number(process.env.PORT || 8080);
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".json": "application/json" };

http.createServer(async (req, res) => {
  const rel = decodeURIComponent((req.url ?? "/").split("?")[0]);
  const file = join(root, rel.endsWith("/") ? rel + "index.html" : rel);
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  try {
    const data = await readFile(file);
    res.writeHead(200, { "Content-Type": types[extname(file)] ?? "application/octet-stream", "Cache-Control": "no-cache" }).end(data);
  } catch { res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found"); }
}).listen(port, () => console.log("Lunar Colony Simulator -> http://localhost:" + port));
