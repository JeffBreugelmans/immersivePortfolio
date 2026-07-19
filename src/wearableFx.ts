// wearableFx.ts
//
// TECH_SPEC C.1 "magical" wearable-teleport (docs/PLAN-wearable-fx.md).
// Before this system existed, clicking the Holo Stage HTC Vive played a
// small pulse + SFX and teleported on a flat 500ms timer -- the scene
// change fired immediately on click, with no sense of actually putting
// the headset on. This system replaces that for any manifest prop
// carrying `wearable: true`:
//
//   Don:  the headset lifts off its shelf pose, flips 180 degrees, flies
//         up to a spot above the visitor's head, then slides down onto
//         their eyes -- THEN the fade/teleport fires.
//   Doff: on returning to the scene the headset sent you from, the
//         reverse plays -- it starts on your face, lifts off, and flies
//         back to its shelf.
//
// Player position/orientation differ between don and doff, and between
// desktop and XR, so every pose is computed from the live world-space
// camera transform (world.camera.getWorld{Position,Direction}) rather
// than anything scene-relative. No tween library: a manual phase/lerp
// state machine driven from update(delta), the same pattern
// CompanionSystem uses for its steering.

import * as THREE from "three";
import { createSystem } from "@iwsdk/core";
import { livePropObjects } from "./sceneManager";
import { sceneById as sceneByIdRaw } from "./manifest.js";

interface WearableProp {
  id: string;
  teleportTo?: string;
  wearable?: boolean;
}
const sceneById = sceneByIdRaw as Record<string, { props?: WearableProp[] }>;

type Phase =
  | "idle"
  | "don-lift"
  | "don-approach"
  | "don-place"
  | "doff-lift"
  | "doff-retreat"
  | "doff-place";

// Don beats (PLAN-wearable-fx.md): lift off shelf -> fly above the
// visitor's head -> slide down onto their eyes -> teleport fires.
const DON_LIFT_MS = 450;
const DON_APPROACH_MS = 600;
const DON_PLACE_MS = 350;
// Doff mirrors the same three beats in reverse, ~1.2s total.
const DOFF_LIFT_MS = 350;
const DOFF_RETREAT_MS = 500;
const DOFF_PLACE_MS = 350;

const LIFT_HEIGHT = 0.35;
const APPROACH_OFFSET_Y = 0.45;

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function yawQuat(yaw: number): THREE.Quaternion {
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0));
}

const _dir = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

export class WearableFxSystem extends createSystem({}) {
  private phase: Phase = "idle";
  private phaseElapsed = 0;
  private phaseDurationMs = 0;
  private activeObject: THREE.Object3D | null = null;
  private pendingTeleportTo: string | null = null;
  private lastSceneId: string | null = null;

  // Current phase's world-space start/end pose, lerped in update().
  private phaseStartPos = new THREE.Vector3();
  private phaseStartQuat = new THREE.Quaternion();
  private phaseEndPos = new THREE.Vector3();
  private phaseEndQuat = new THREE.Quaternion();

  // Captured at doff-begin: the exact authored shelf pose the fresh
  // spawn just gave us, restored exactly at the end of doff-place.
  private doffShelfPos = new THREE.Vector3();
  private doffShelfQuat = new THREE.Quaternion();
  private doffShelfYaw = 0;

  init() {
    // Don: click a wearable prop with a teleport target.
    window.addEventListener("prop-interaction", (e) => {
      const detail = (e as CustomEvent).detail as
        | { propId?: string; sceneId?: string; trigger?: string }
        | undefined;
      if (!detail || detail.trigger !== "click" || this.phase !== "idle") return;
      const scene = detail.sceneId ? sceneById[detail.sceneId] : null;
      const entry = scene?.props?.find((p) => p.id === detail.propId);
      if (!entry?.wearable || !entry.teleportTo || !detail.propId) return;
      const object3D = livePropObjects.get(detail.propId);
      if (!object3D) return;
      this.beginDon(object3D, entry.teleportTo);
    });

    // Doff: arriving at a scene whose wearable prop points back at the
    // scene we just left. spawnProp has already run by the time
    // scene-changed fires, so the fresh shelf pose is ready to capture.
    window.addEventListener("scene-changed", (e) => {
      const sceneId = (e as CustomEvent).detail?.sceneId as string | undefined;
      const arrivingFrom = this.lastSceneId;
      this.lastSceneId = sceneId ?? null;
      if (this.phase !== "idle" || !sceneId || !arrivingFrom) return;
      const entry = sceneById[sceneId]?.props?.find(
        (p) => p.wearable && p.teleportTo === arrivingFrom
      );
      if (!entry) return;
      const object3D = livePropObjects.get(entry.id);
      if (!object3D) return;
      this.beginDoff(object3D);
    });
  }

  private getCameraYaw(): number {
    this.world.camera.getWorldDirection(_dir);
    return Math.atan2(_dir.x, _dir.z);
  }

  private setPhase(phase: Phase, durationMs: number, end: { pos: THREE.Vector3; quat: THREE.Quaternion }): void {
    if (!this.activeObject) return;
    this.phase = phase;
    this.phaseElapsed = 0;
    this.phaseDurationMs = durationMs;
    this.phaseStartPos.copy(this.activeObject.position);
    this.phaseStartQuat.copy(this.activeObject.quaternion);
    this.phaseEndPos.copy(end.pos);
    this.phaseEndQuat.copy(end.quat);
  }

  private beginDon(object3D: THREE.Object3D, teleportTo: string): void {
    this.activeObject = object3D;
    this.pendingTeleportTo = teleportTo;
    const shelfYaw = new THREE.Euler().setFromQuaternion(object3D.quaternion, "YXZ").y;
    this.setPhase("don-lift", DON_LIFT_MS, {
      pos: object3D.position.clone().addScaledVector(_up, LIFT_HEIGHT),
      quat: yawQuat(shelfYaw + Math.PI),
    });
  }

  private beginDoff(object3D: THREE.Object3D): void {
    this.doffShelfPos.copy(object3D.position);
    this.doffShelfQuat.copy(object3D.quaternion);
    this.doffShelfYaw = new THREE.Euler().setFromQuaternion(this.doffShelfQuat, "YXZ").y;

    const camPos = new THREE.Vector3();
    this.world.camera.getWorldPosition(camPos);
    const camYaw = this.getCameraYaw();

    // The visitor is already "wearing" it the instant this scene appears
    // -- snap silently onto their eyes, then animate the reverse trip
    // back to the shelf pose the fresh spawn just gave us.
    object3D.position.copy(camPos);
    object3D.quaternion.copy(yawQuat(camYaw));

    this.activeObject = object3D;
    this.pendingTeleportTo = null;
    this.setPhase("doff-lift", DOFF_LIFT_MS, {
      pos: camPos.clone().addScaledVector(_up, APPROACH_OFFSET_Y),
      quat: yawQuat(camYaw),
    });
  }

  private advancePhase(): void {
    switch (this.phase) {
      case "don-lift": {
        const camPos = new THREE.Vector3();
        this.world.camera.getWorldPosition(camPos);
        const camYaw = this.getCameraYaw();
        this.setPhase("don-approach", DON_APPROACH_MS, {
          pos: camPos.addScaledVector(_up, APPROACH_OFFSET_Y),
          quat: yawQuat(camYaw),
        });
        break;
      }
      case "don-approach": {
        const camPos = new THREE.Vector3();
        this.world.camera.getWorldPosition(camPos);
        const camYaw = this.getCameraYaw();
        this.setPhase("don-place", DON_PLACE_MS, { pos: camPos, quat: yawQuat(camYaw) });
        break;
      }
      case "don-place": {
        const to = this.pendingTeleportTo;
        this.resetToIdle();
        // Fade covers the cut -- teleportTo() already fades to black
        // before swapping scenes.
        if (to) window.teleportTo?.(to);
        break;
      }
      case "doff-lift": {
        this.setPhase("doff-retreat", DOFF_RETREAT_MS, {
          pos: this.doffShelfPos.clone().addScaledVector(_up, LIFT_HEIGHT),
          quat: yawQuat(this.doffShelfYaw + Math.PI),
        });
        break;
      }
      case "doff-retreat": {
        this.setPhase("doff-place", DOFF_PLACE_MS, {
          pos: this.doffShelfPos,
          quat: this.doffShelfQuat,
        });
        break;
      }
      case "doff-place":
        this.resetToIdle();
        break;
    }
  }

  private resetToIdle(): void {
    this.phase = "idle";
    this.activeObject = null;
    this.pendingTeleportTo = null;
  }

  update(delta: number) {
    if (this.phase === "idle" || !this.activeObject) return;
    this.phaseElapsed += delta * 1000;
    const t = Math.min(this.phaseElapsed / this.phaseDurationMs, 1);
    const eased = easeInOut(t);
    this.activeObject.position.lerpVectors(this.phaseStartPos, this.phaseEndPos, eased);
    this.activeObject.quaternion.slerpQuaternions(this.phaseStartQuat, this.phaseEndQuat, eased);
    if (t >= 1) this.advancePhase();
  }
}
