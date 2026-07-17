#!/usr/bin/env node
// scripts/marble-generate.mjs
//
// Helper to call the World Labs Marble ("World API"), poll until
// generation finishes, export a textured GLB, and download it straight
// into the right scene folder.
//
// Verified against https://docs.worldlabs.ai/api and
// https://docs.worldlabs.ai/api/reference/worlds/export (fetched live --
// this is NOT inferred from the brief anymore). Three real steps, not two:
//
//   1. POST /marble/v1/worlds:generate -> an Operation. Poll it until
//      done. Its response.id is the world_id. The world's `assets.mesh`
//      at this point only has a `collider_mesh_url` -- a low-detail
//      collision mesh, not something you want to actually look at.
//   2. POST /marble/v1/worlds/{world_id}:export with
//      {"asset_type":"mesh","format":"glb","mesh_variant":"textured"}.
//      This does NOT return the file directly -- per World Labs' own
//      docs, "HQ mesh exports reuse the existing async mesh export
//      service and return an in-progress operation." So this is a
//      SECOND operation that also needs polling (same
//      /marble/v1/operations/{operation_id} endpoint, different id).
//   3. Once that export operation is done, response.url is the actual
//      downloadable textured GLB.
//
// Auth: WLT-Api-Key header (not Bearer -- confirmed from the platform's
// own "make your first request" snippet at platform.worldlabs.ai/api-keys
// and the OpenAPI securityScheme in the export endpoint's reference).
//
// Get your API key at https://platform.worldlabs.ai/api-keys, paste it
// into .env.local as MARBLE_API_KEY=... (never commit that file -- see
// .env.example for the template). This script loads it via dotenv.
//
// Usage:
//   node scripts/marble-generate.mjs \
//     --world afternow \
//     --scene scene-01-holographic-studio \
//     --prompt "holographic presentation studio, HoloLens on podium, ..." \
//     [--image path/to/reference.jpg]
//
// Image input uses the two-step upload flow (prepare_upload -> PUT bytes
// -> reference media_asset_id) since local files aren't public URLs.

import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";

const MARBLE_API_BASE = "https://api.worldlabs.ai";
const API_KEY = process.env.MARBLE_API_KEY;
const MODEL = "marble-1.1"; // use "marble-1.1-plus" for larger/outdoor scenes

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

function authHeaders(extra = {}) {
  return { "WLT-Api-Key": API_KEY, ...extra };
}

async function uploadImage(imagePath) {
  const fileName = path.basename(imagePath);
  const extension = path.extname(imagePath).slice(1).toLowerCase() || "jpg";

  const prepareRes = await fetch(`${MARBLE_API_BASE}/marble/v1/media-assets:prepare_upload`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ file_name: fileName, kind: "image", extension }),
  });
  if (!prepareRes.ok) {
    throw new Error(`prepare_upload failed: HTTP ${prepareRes.status} ${await prepareRes.text()}`);
  }
  const { media_asset, upload_info } = await prepareRes.json();

  const fileBuf = await fs.readFile(imagePath);
  const putRes = await fetch(upload_info.upload_url, {
    method: upload_info.upload_method || "PUT",
    headers: upload_info.required_headers || {},
    body: fileBuf,
  });
  if (!putRes.ok) {
    throw new Error(`image upload failed: HTTP ${putRes.status} ${await putRes.text()}`);
  }

  return media_asset.id;
}

async function generateWorld({ displayName, prompt, imagePath }) {
  const worldPrompt = imagePath
    ? {
        type: "image",
        image_prompt: { source: "media_asset", media_asset_id: await uploadImage(imagePath) },
        text_prompt: prompt,
      }
    : { type: "text", text_prompt: prompt };

  const res = await fetch(`${MARBLE_API_BASE}/marble/v1/worlds:generate`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ display_name: displayName, model: MODEL, world_prompt: worldPrompt }),
  });
  if (!res.ok) throw new Error(`generate failed: HTTP ${res.status} ${await res.text()}`);
  return res.json(); // Operation: { operation_id, done, response: null until done }
}

async function pollOperation(operationId, { intervalMs = 5000, timeoutMs = 10 * 60 * 1000, label = "operation" } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${MARBLE_API_BASE}/marble/v1/operations/${operationId}`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`poll failed: HTTP ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(`${label} failed: ${JSON.stringify(data.error)}`);
    if (data.done) return data;
    const status = data.metadata?.progress?.status ?? "IN_PROGRESS";
    process.stdout.write(`\r${label}: ${status}...   `);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`timed out waiting for ${label}`);
}

async function exportTexturedMesh(worldId) {
  const res = await fetch(`${MARBLE_API_BASE}/marble/v1/worlds/${worldId}:export`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ asset_type: "mesh", format: "glb", mesh_variant: "textured" }),
  });
  if (!res.ok) throw new Error(`export request failed: HTTP ${res.status} ${await res.text()}`);
  const exportOp = await res.json();

  // Per World Labs docs: "HQ mesh exports reuse the existing async mesh
  // export service and return an in-progress operation" -- so this needs
  // its own poll even though the initial world generation is already done.
  const done = exportOp.done ? exportOp : await pollOperation(exportOp.operation_id, { label: "mesh export" });
  if (!done.response?.url) throw new Error(`export finished but no url in response: ${JSON.stringify(done)}`);
  return done.response.url;
}

async function downloadTo(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(destPath, buf);
}

async function main() {
  if (!API_KEY) {
    console.error("Set MARBLE_API_KEY in .env.local first (see .env.example). Get a key at https://platform.worldlabs.ai/api-keys");
    process.exit(1);
  }

  const args = parseArgs(process.argv.slice(2));
  if (!args.world || !args.scene || !args.prompt) {
    console.error('Usage: node scripts/marble-generate.mjs --world <id> --scene <id> --prompt "..." [--image path]');
    process.exit(1);
  }

  const destDir = path.resolve("public", args.world, args.scene, "marble");
  await fs.mkdir(destDir, { recursive: true });

  console.log(`Requesting Marble generation for ${args.world}/${args.scene}...`);
  const genOp = await generateWorld({
    displayName: `${args.world}/${args.scene}`,
    prompt: args.prompt,
    imagePath: args.image,
  });
  console.log(`Operation ${genOp.operation_id} submitted, polling (usually ~5 min)...`);

  const genDone = await pollOperation(genOp.operation_id, { label: "world generation" });
  console.log("\nWorld generated. World ID:", genDone.response.id);

  console.log("Requesting textured mesh export...");
  const glbUrl = await exportTexturedMesh(genDone.response.id);

  console.log("Downloading GLB...");
  const destPath = path.join(destDir, "scene.glb");
  await downloadTo(glbUrl, destPath);

  await fs.writeFile(
    path.join(destDir, "metadata.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        worldId: genDone.response.id,
        worldMarbleUrl: genDone.response.world_marble_url,
        prompt: args.prompt,
        image: args.image ?? null,
        model: MODEL,
      },
      null,
      2
    )
  );

  console.log(`Saved to ${destPath}`);
  console.log(`View in Marble: ${genDone.response.world_marble_url}`);
}

main().catch((err) => {
  console.error("\n" + err.message);
  process.exit(1);
});
