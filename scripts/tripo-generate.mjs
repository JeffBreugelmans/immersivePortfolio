#!/usr/bin/env node
// scripts/tripo-generate.mjs
//
// Helper to call Tripo AI (single-object 3D generation, complementary to
// scripts/marble-generate.mjs which builds whole-room environments) and
// download the result into the right scene's props/ folder.
//
// Verified against the live docs at docs.tripo3d.ai (quick-start,
// text-to-model H3, image-to-model H3, quick-upload-directly, get-your-task-result,
// export/conversion) -- not inferred/guessed. Key facts from those pages:
//
//   - Auth: "Authorization: Bearer YOUR_TRIPO_API_KEY" header (not WLT-Api-Key
//     like Marble -- the two providers use different header conventions).
//   - Submit: POST /v2/openapi/task, body varies by type:
//       text_to_model  -> { type, prompt, model_version, texture, pbr }
//       image_to_model -> { type, file: { type, file_token }, model_version, texture, pbr }
//     Response is wrapped: { data: { task_id } }.
//   - Local images need a separate upload first: POST /v2/openapi/upload,
//     multipart/form-data, field name "file" (webp/jpeg/png only, max 20MB)
//     -> { data: { image_token } }. The exact upload URL wasn't rendered as
//     literal text in the fetched docs page (looked like an interactive
//     widget) -- this follows the same /v2/openapi/... convention as the
//     task and poll endpoints. If this 404s, double-check against
//     https://docs.tripo3d.ai/file-upload/quick-upload-directly.html.
//   - Poll: GET /v2/openapi/task/{task_id} -> { data: { status, output, progress, ... } }.
//     status is one of: queued, running (ongoing) / success, failed, banned,
//     expired, cancelled, unknown (finalized). Must poll with the SAME API
//     key that created the task.
//   - output.pbr_model / output.model / output.base_model are download URLs
//     that "by default expire after five minutes" -- download immediately
//     after success, don't delay.
//   - Default task output format is already glb (the export/conversion
//     endpoint's own docs describe it as "Converts glb format models from
//     the OpenAPI into other formats") -- no extra conversion step needed
//     for this project.
//
// Get your API key at https://platform.tripo3d.ai/api-keys, paste into
// .env.local as TRIPO3D_API_KEY=... (gitignored, see .env.example).
//
// Usage:
//   node scripts/tripo-generate.mjs \
//     --world afternow \
//     --scene scene-02-smart-glasses-lab \
//     --prop-id even-realities-glasses \
//     --prompt "a pair of minimalist smart glasses, matte black frame" \
//     [--image path/to/reference-photo.jpg]
//
// Prints a ready-to-paste manifest.js "props" entry when done -- position
// still needs manual tuning (this script has no idea where in the scene
// you want it), everything else is filled in.

import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";

const TRIPO_API_BASE = "https://api.tripo3d.ai";
const API_KEY = process.env.TRIPO3D_API_KEY;
const MODEL_VERSION = "v3.1-20260211"; // H3 line -- best prompt fidelity + full parameter control

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
  return { Authorization: `Bearer ${API_KEY}`, ...extra };
}

async function uploadImage(imagePath) {
  const extension = path.extname(imagePath).slice(1).toLowerCase();
  if (!["jpg", "jpeg", "png", "webp"].includes(extension)) {
    throw new Error(`Tripo image upload only accepts jpg/jpeg/png/webp, got ".${extension}"`);
  }

  const fileBuf = await fs.readFile(imagePath);
  const form = new FormData();
  form.append("file", new Blob([fileBuf]), path.basename(imagePath));

  const res = await fetch(`${TRIPO_API_BASE}/v2/openapi/upload`, {
    method: "POST",
    headers: authHeaders(), // do NOT set Content-Type -- fetch sets the multipart boundary itself
    body: form,
  });
  if (!res.ok) throw new Error(`image upload failed: HTTP ${res.status} ${await res.text()}`);
  const json = await res.json();
  const imageToken = json.data?.image_token;
  if (!imageToken) throw new Error(`upload succeeded but no image_token in response: ${JSON.stringify(json)}`);
  return { imageToken, extension };
}

async function submitTask({ prompt, imagePath }) {
  let body;
  if (imagePath) {
    const { imageToken, extension } = await uploadImage(imagePath);
    body = {
      type: "image_to_model",
      file: { type: extension, file_token: imageToken },
      model_version: MODEL_VERSION,
      texture: true,
      pbr: true,
    };
  } else {
    body = {
      type: "text_to_model",
      prompt,
      model_version: MODEL_VERSION,
      texture: true,
      pbr: true,
    };
  }

  const res = await fetch(`${TRIPO_API_BASE}/v2/openapi/task`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`task submit failed: HTTP ${res.status} ${await res.text()}`);
  const json = await res.json();
  const taskId = json.data?.task_id;
  if (!taskId) throw new Error(`submit succeeded but no task_id in response: ${JSON.stringify(json)}`);
  return taskId;
}

const TERMINAL_FAILURE_STATUSES = ["failed", "banned", "expired", "cancelled", "unknown"];

async function pollTask(taskId, { intervalMs = 4000, timeoutMs = 10 * 60 * 1000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${TRIPO_API_BASE}/v2/openapi/task/${taskId}`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`poll failed: HTTP ${res.status}`);
    const { data } = await res.json();
    if (!data) throw new Error(`poll response missing "data": ${JSON.stringify(await res.text())}`);

    if (data.status === "success") return data;
    if (TERMINAL_FAILURE_STATUSES.includes(data.status)) {
      throw new Error(`Tripo task ended in status "${data.status}" (task_id ${taskId})`);
    }

    process.stdout.write(`\rTripo task: ${data.status} (${data.progress ?? 0}%)...   `);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("timed out waiting for Tripo task");
}

async function downloadTo(url, destPath) {
  // output URLs expire ~5 minutes after task success -- called immediately
  // after pollTask() resolves, so no extra delay here.
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(destPath, buf);
}

async function main() {
  if (!API_KEY) {
    console.error("Set TRIPO3D_API_KEY in .env.local first (see .env.example). Get a key at https://platform.tripo3d.ai/api-keys");
    process.exit(1);
  }

  const args = parseArgs(process.argv.slice(2));
  if (!args.world || !args.scene || !args["prop-id"] || (!args.prompt && !args.image)) {
    console.error(
      'Usage: node scripts/tripo-generate.mjs --world <id> --scene <id> --prop-id <id> --prompt "..." [--image path]\n' +
        "(prompt is required for text-to-model; still recommended alongside --image to steer image-to-model)"
    );
    process.exit(1);
  }

  const destDir = path.resolve("public", args.world, args.scene, "props");
  await fs.mkdir(destDir, { recursive: true });

  console.log(`Requesting Tripo generation for ${args.world}/${args.scene}/${args["prop-id"]}...`);
  const taskId = await submitTask({ prompt: args.prompt, imagePath: args.image });
  console.log(`Task ${taskId} submitted, polling...`);

  const result = await pollTask(taskId);
  console.log("\nGeneration complete.");

  const glbUrl = result.output?.pbr_model ?? result.output?.model ?? result.output?.base_model;
  if (!glbUrl) throw new Error(`task succeeded but no model URL in output: ${JSON.stringify(result.output)}`);

  console.log("Downloading GLB (output URL expires in ~5 min, downloading now)...");
  const fileName = `${args["prop-id"]}.glb`;
  const destPath = path.join(destDir, fileName);
  await downloadTo(glbUrl, destPath);

  await fs.writeFile(
    path.join(destDir, `${args["prop-id"]}.metadata.json`),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        taskId,
        prompt: args.prompt ?? null,
        image: args.image ?? null,
        modelVersion: MODEL_VERSION,
        consumedCredit: result.consumed_credit ?? null,
      },
      null,
      2
    )
  );

  console.log(`Saved to ${destPath}`);
  console.log("\nPaste into this scene's \"props\" array in src/manifest.js (tune position for your scene):\n");
  console.log(
    JSON.stringify(
      {
        id: args["prop-id"],
        kind: "glb",
        src: `\${BASE}${args.world}/${args.scene}/props/${fileName}`,
        source: "tripo",
        position: "0 0 0",
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error("\n" + err.message);
  process.exit(1);
});
