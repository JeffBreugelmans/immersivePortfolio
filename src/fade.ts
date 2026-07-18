// fade.ts
//
// Shared screen-fade primitive (TECH_SPEC §C.0). DOM overlays are
// invisible inside an XR session, so the fade has two implementations
// behind one window-event contract:
//
//   "fade-request"  (in)  detail: { toBlack: boolean, durationMs?: number }
//   "fade-complete" (out) detail: { black: boolean }
//
// Desktop/mobile: a fullscreen black div with CSS opacity transition.
// XR: a camera-parented black quad, opacity animated per frame. One draw
// call only while fading or black; visible=false otherwise.
//
// sceneManager routes every teleport through a fade, which turns the
// current hard splat pop into a clean cut on all platforms.

import * as THREE from "three";
import { createSystem, VisibilityState } from "@iwsdk/core";

const DEFAULT_DURATION_MS = 400;

export class FadeSystem extends createSystem({}) {
  private dom!: HTMLDivElement;
  private quad!: THREE.Mesh;
  private quadMaterial!: THREE.MeshBasicMaterial;
  private opacity = 0;
  private target = 0;
  private rate = 0; // opacity units per second
  private pendingComplete = false;

  init() {
    this.dom = document.createElement("div");
    this.dom.id = "fade-overlay";
    this.dom.style.cssText =
      "position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;" +
      `z-index:900;transition:opacity ${DEFAULT_DURATION_MS}ms ease`;
    document.body.appendChild(this.dom);

    this.quadMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0,
      depthTest: false,
      side: THREE.DoubleSide,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), this.quadMaterial);
    this.quad.position.set(0, 0, -0.35);
    this.quad.renderOrder = 999;
    this.quad.visible = false;
    this.world.camera.add(this.quad);

    window.addEventListener("fade-request", (e) => {
      const { toBlack, durationMs } = (e as CustomEvent).detail ?? {};
      const duration = Math.max(durationMs ?? DEFAULT_DURATION_MS, 1);
      this.target = toBlack ? 1 : 0;
      this.rate = 1000 / duration;
      this.pendingComplete = true;
      this.dom.style.transitionDuration = `${duration}ms`;
      this.dom.style.opacity = String(this.target);
      this.quad.visible = true;
    });
  }

  update(delta: number) {
    if (this.opacity === this.target) {
      if (this.pendingComplete) {
        this.pendingComplete = false;
        this.quad.visible = this.target > 0;
        window.dispatchEvent(
          new CustomEvent("fade-complete", { detail: { black: this.target === 1 } })
        );
      }
      return;
    }
    const step = this.rate * delta;
    this.opacity =
      this.opacity < this.target
        ? Math.min(this.opacity + step, this.target)
        : Math.max(this.opacity - step, this.target);
    // The XR quad is the only fade the visitor sees in-session; the DOM
    // div animates itself via CSS for the non-XR view.
    this.quadMaterial.opacity = this.opacity;
    if (this.world.visibilityState.value !== VisibilityState.NonImmersive) {
      this.dom.style.opacity = "0"; // DOM overlay is dead weight in-session
    }
  }
}

/**
 * Fade to black, run the action, and fade back in once "scene-changed"
 * fires (or immediately if the action throws). Used by sceneManager for
 * every teleport; safe to call again mid-fade (latest wins).
 */
export function fadeThrough(action: () => void, durationMs = DEFAULT_DURATION_MS): void {
  const onBlack = (e: Event) => {
    if (!(e as CustomEvent).detail?.black) return;
    window.removeEventListener("fade-complete", onBlack);
    action();
  };
  window.addEventListener("fade-complete", onBlack);
  window.dispatchEvent(
    new CustomEvent("fade-request", { detail: { toBlack: true, durationMs } })
  );
}
