// debugOverlay.ts
//
// Tiny frame-budget overlay, enabled with ?debug in the URL. Shows FPS,
// p95 frame time over a rolling window, and renderer draw calls so every
// new feature lands against measured numbers (TECH_SPEC §H test matrix).
// Zero cost when not enabled; ~0 allocations when enabled (ring buffer).

import { createSystem } from "@iwsdk/core";

const WINDOW_SIZE = 90; // ~1.25s at 72Hz
const UPDATE_INTERVAL_MS = 250;

export class DebugOverlaySystem extends createSystem({}) {
  private el: HTMLDivElement | null = null;
  private samples = new Float32Array(WINDOW_SIZE);
  private sorted = new Float32Array(WINDOW_SIZE);
  private sampleIndex = 0;
  private sampleCount = 0;
  private lastText = 0;

  init() {
    if (!new URLSearchParams(location.search).has("debug")) return;
    this.el = document.createElement("div");
    this.el.id = "debug-overlay";
    this.el.style.cssText =
      "position:fixed;top:8px;left:8px;z-index:9999;padding:6px 10px;" +
      "font:12px/1.5 monospace;color:#3dff9c;background:rgba(0,10,4,0.7);" +
      "border-radius:6px;pointer-events:none;white-space:pre";
    document.body.appendChild(this.el);
  }

  update(delta: number) {
    if (!this.el) return;
    const ms = delta * 1000;
    this.samples[this.sampleIndex] = ms;
    this.sampleIndex = (this.sampleIndex + 1) % WINDOW_SIZE;
    if (this.sampleCount < WINDOW_SIZE) this.sampleCount++;

    const now = performance.now();
    if (now - this.lastText < UPDATE_INTERVAL_MS) return;
    this.lastText = now;

    this.sorted.set(this.samples);
    const window_ = this.sorted.subarray(0, this.sampleCount);
    window_.sort();
    const p95 = window_[Math.min(this.sampleCount - 1, Math.floor(this.sampleCount * 0.95))];
    let mean = 0;
    for (let i = 0; i < this.sampleCount; i++) mean += window_[i];
    mean /= this.sampleCount;

    const info = this.world.renderer.info.render;
    this.el.textContent =
      `${(1000 / mean).toFixed(0)} fps  p95 ${p95.toFixed(1)}ms\n` +
      `calls ${info.calls}  tris ${(info.triangles / 1000).toFixed(0)}k`;
  }
}
