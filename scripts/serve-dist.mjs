#!/usr/bin/env node
// scripts/serve-dist.mjs
//
// Minimal static server for the production build, mounted at /worlds/ to
// match the deployed base path. Exists because `vite preview` insists on
// the mkcert plugin, whose trust-store CA install pops a Windows UAC
// dialog -- a non-starter for headless smoke runs. Plain http://localhost
// is still a secure context, so WebXR/getUserMedia checks behave the same.
//
// Usage: node scripts/serve-dist.mjs [port]   (default 4173)
//   then: SMOKE_URL=http://localhost:4173/worlds/?debug npm run smoke

import http from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";

const PORT = Number(process.argv[2]) || 4173;
const DIST = path.resolve(import.meta.dirname, "..", "dist");
const BASE = "/worlds/";

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".glb": "model/gltf-binary",
  ".spz": "application/octet-stream",
  ".wasm": "application/wasm",
  ".ico": "image/x-icon",
};

http
  .createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    if (!url.pathname.startsWith(BASE)) {
      res.writeHead(302, { Location: BASE });
      return res.end();
    }
    let rel = decodeURIComponent(url.pathname.slice(BASE.length));
    let file = path.join(DIST, rel);
    if (!file.startsWith(DIST)) {
      res.writeHead(403);
      return res.end();
    }
    if (!existsSync(file) || statSync(file).isDirectory()) {
      const index = path.join(file, "index.html");
      file = existsSync(index) ? index : path.join(DIST, "index.html");
      // SPA-ish fallback only for extensionless routes; real missing assets 404
      if (path.extname(rel) && !existsSync(path.join(DIST, rel))) {
        res.writeHead(404);
        return res.end("not found: " + rel);
      }
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] ?? "application/octet-stream" });
    createReadStream(file).pipe(res);
  })
  .listen(PORT, () => console.log(`serving ${DIST} at http://localhost:${PORT}${BASE}`));
