#!/usr/bin/env node
// scripts/screenshot.mjs
//
// Headless render check: load the served build, optionally teleport to a
// scene, wait for the splat to come in, save a PNG. The fastest way to
// answer "did the Marble world come out right-side up?" without putting
// on a headset.
//
// Usage:
//   node scripts/screenshot.mjs [--scene <sceneId>] [--out <file.png>]
//     [--url <served-url>] [--wait <ms>] [--look <yawDeg>]
//
// Requires CHROME_PATH pointing at any chromium (Edge works on Windows).

import { chromium } from "playwright-core";
import { existsSync } from "node:fs";

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith("--")) args[process.argv[i].slice(2)] = process.argv[i + 1];
}

const URL = args.url ?? process.env.SMOKE_URL ?? "http://localhost:4173/worlds/";
const OUT = args.out ?? "screenshot.png";
const WAIT = Number(args.wait ?? 12000);

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
].filter(Boolean);
const executablePath = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!executablePath) throw new Error("No chromium found; set CHROME_PATH");

// --gpu: use the machine's real GPU (local laptops). Default keeps the
// SwiftShader software path, required in GPU-less cloud sandboxes.
const glArgs = args.gpu
  ? ["--use-angle=default"]
  : ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"];
const browser = await chromium.launch({
  executablePath,
  args: ["--ignore-certificate-errors", ...glArgs],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(URL, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4000); // app boot + entry scene load kick-off

if (args.scene) {
  await page.evaluate((sceneId) => window.teleportTo?.(sceneId), args.scene);
}
if (args.look) {
  // DesktopControlsSystem: drag-to-look, yaw -= movementX * 0.004 rad/px.
  // Synthesize a one-frame drag with the whole turn as one movementX.
  await page.evaluate((yawDeg) => {
    const canvas = document.querySelector("canvas");
    const px = -((yawDeg * Math.PI) / 180) / 0.004;
    canvas.dispatchEvent(new PointerEvent("pointerdown", { button: 0, bubbles: true }));
    canvas.dispatchEvent(new PointerEvent("pointermove", { movementX: px, movementY: 0, bubbles: true }));
    window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
  }, Number(args.look));
  await page.waitForTimeout(500);
}

if (args.walk) {
  // Hold W to walk forward (DesktopControlsSystem, 3 m/s).
  await page.keyboard.down("w");
  await page.waitForTimeout(Number(args.walk));
  await page.keyboard.up("w");
}

await page.waitForTimeout(WAIT); // splat download + SparkJS decode + settle
await page.screenshot({ path: OUT });
console.log("saved", OUT);
await browser.close();
