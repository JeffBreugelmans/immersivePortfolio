#!/usr/bin/env node
// scripts/marble-generate.mjs
//
// Helper to call the World Labs Marble API, poll until the generation
// finishes, and download the result straight into the right scene folder.
//
// STATUS: stub — the exact request/response shape below is inferred from
// the project brief (POST /marble/v1/worlds:generate, then poll an
// operation). CONFIRM against https://docs.worldlabs.ai/api before relying
// on this, and fix field names/paths as needed. Get your API key at
// https://platform.worldlabs.ai first.
//
// Usage:
//   MARBLE_API_KEY=xxx node scripts/marble-generate.mjs \
//     --world afternow \
//     --scene scene-01-holographic-studio \
//     --prompt "holographic presentation studio, HoloLens on podium, ..." \
//     [--image path/to/reference.jpg]

import fs from "node:fs/promises";
import path from "node:path";

const MARBLE_API_BASE = "https://api.worldlabs.ai"; // CONFIRM in docs.worldlabs.ai/api
const API_KEY = process.env.MARBLE_API_KEY;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const value = argv[i + 1];
      args[key] = value;
      i++;
    }
  }
  return args;
}

async function generateWorld({ prompt, imagePath }) {
  const body = { prompt };
  if (imagePath) {
    // Depending on the real API this may need to be multipart/form-data
    // with the image bytes rather than a base64 field — check the docs.
    const imageData = await fs.readFile(imagePath);
    body.image = imageData.toString("base64");
  }

  const res = await fetch(`${MARBLE_API_BASE}/marble/v1/worlds:generate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`generate failed: HTTP ${res.status} ${await res.text()}`);
  return res.json(); // expect something like { operationId: "..." }
}

async function pollOperation(operationId, { intervalMs = 5000, timeoutMs = 10 * 60 * 1000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${MARBLE_API_BASE}/marble/v1/operations/${operationId}`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    if (!res.ok) throw new Error(`poll failed: HTTP ${res.status}`);
    const data = await res.json();
    if (data.status === "done" || data.done) return data;
    if (data.status === "failed" || data.error) throw new Error(`generation failed: ${JSON.stringify(data)}`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("timed out waiting for Marble generation");
}

async function downloadResult(result, destDir) {
  await fs.mkdir(destDir, { recursive: true });
  const glbUrl = result.glbUrl ?? result.assets?.glb; // field name TBD — confirm in docs
  if (!glbUrl) throw new Error(`no glb URL found in result: ${JSON.stringify(result)}`);

  const res = await fetch(glbUrl);
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const destPath = path.join(destDir, "scene.glb");
  await fs.writeFile(destPath, buf);

  await fs.writeFile(
    path.join(destDir, "metadata.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), result }, null, 2)
  );

  return destPath;
}

async function main() {
  if (!API_KEY) {
    console.error("Set MARBLE_API_KEY in your environment first.");
    process.exit(1);
  }

  const args = parseArgs(process.argv.slice(2));
  if (!args.world || !args.scene || !args.prompt) {
    console.error("Usage: node scripts/marble-generate.mjs --world <id> --scene <id> --prompt \"...\" [--image path]");
    process.exit(1);
  }

  const destDir = path.resolve("public/worlds", args.world, args.scene, "marble");

  console.log("Requesting Marble generation…");
  const { operationId } = await generateWorld({ prompt: args.prompt, imagePath: args.image });
  console.log(`Operation ${operationId} submitted, polling…`);

  const result = await pollOperation(operationId);
  console.log("Generation complete, downloading…");

  const destPath = await downloadResult(result, destDir);
  console.log(`Saved to ${destPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
