// interactions.ts
//
// Manifest-driven interactable framework (TECH_SPEC §B). A scene author
// adds `interaction: {...}` to a prop entry in manifest.js and gets
// click / gaze-dwell / hand-wave behavior with zero per-scene code:
//
//   interaction: {
//     click: { effect: "pulse", sfx: "click" },
//     gaze:  { dwellMs: 800, effect: "glow", sfx: "hum" },
//     wave:  { radius: 0.4, effect: "cycle-color", sfx: "chime" },
//     pickup: true,   // default true for glb; false opts out of grabbing
//   }
//
// Triggers are decoupled from responses: every fired trigger dispatches
// ONE window event (mirroring portals' "teleport-request" pattern):
//
//   "prop-interaction"  detail: { propId, sceneId, trigger, value? }
//     trigger: "click" | "gaze" | "gaze-off" | "wave"
//
// Feature systems (wearables, projector grid, mini-game, audio) subscribe
// and filter by propId/role. Small built-in visual effects are handled
// here, data-driven: glow / pulse / cycle-color / spin -- all material
// tricks, no lights (splats are unlit, defaultLighting is off).
//
// Gaze-dwell deliberately reuses GazeContextSystem's raycast loop (via
// "gaze-changed" events) instead of adding a second one; a desktop
// pointer-hover raycast at 10Hz covers "look at it without centering it".

import * as THREE from "three";
import { createComponent, createSystem, Types, VisibilityState, type World } from "@iwsdk/core";
import { editModeEnabled } from "./editor";

export interface InteractionConfig {
  click?: { effect?: EffectName; sfx?: string };
  gaze?: { dwellMs?: number; effect?: EffectName; sfx?: string };
  wave?: { radius?: number; effect?: EffectName; sfx?: string };
  pickup?: boolean;
}

export type EffectName = "glow" | "pulse" | "cycle-color" | "spin";

export const Interactive = createComponent("Interactive", {
  propId: { type: Types.String, default: "" },
});

interface Registered {
  propId: string;
  sceneId: string;
  object3D: THREE.Object3D;
  config: InteractionConfig;
  materials: MaterialRecord[];
  // effect state
  baseScale: THREE.Vector3;
  pulseUntil: number;
  spinUntil: number;
  glowLevel: number; // 0..1 current
  glowTarget: number;
  hue: number; // cycle-color offset, degrees
  gazeFiredAt: number;
  gazeStartedAt: number;
  hovering: boolean;
  hoverStartedAt: number;
  waveFiredAt: number;
}

interface MaterialRecord {
  material: THREE.Material;
  baseColor: THREE.Color;
  baseEmissive: THREE.Color | null;
}

const GAZE_DWELL_DEFAULT_MS = 800;
const GAZE_REFRACTORY_MS = 1500;
const WAVE_RADIUS_DEFAULT = 0.4;
const WAVE_SPEED_THRESHOLD = 0.6; // m/s
const WAVE_WINDOW_MS = 250;
const WAVE_REFRACTORY_MS = 800;
const HOVER_INTERVAL_MS = 100;
const PULSE_MS = 240;
const SPIN_MS = 600;
const GLOW_LERP_PER_S = 6.7; // ~150ms to full

const registry = new Map<string, Registered>(); // by propId

function collectMaterials(root: THREE.Object3D): MaterialRecord[] {
  const records: MaterialRecord[] = [];
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      const withColor = material as THREE.MeshStandardMaterial;
      if (!withColor.color) continue;
      records.push({
        material,
        baseColor: withColor.color.clone(),
        baseEmissive: withColor.emissive ? withColor.emissive.clone() : null,
      });
    }
  });
  return records;
}

/**
 * Called by sceneManager.spawnProp for props with an `interaction` config.
 * Entities are torn down on scene swap; unregisterInteractive mirrors it.
 */
export function registerInteractive(
  object3D: THREE.Object3D,
  propId: string,
  sceneId: string,
  config: InteractionConfig
): void {
  registry.set(propId, {
    propId,
    sceneId,
    object3D,
    config,
    materials: collectMaterials(object3D),
    baseScale: object3D.scale.clone(),
    pulseUntil: 0,
    spinUntil: 0,
    glowLevel: 0,
    glowTarget: 0,
    hue: 0,
    gazeFiredAt: 0,
    gazeStartedAt: 0,
    hovering: false,
    hoverStartedAt: 0,
    waveFiredAt: 0,
  });
}

export function unregisterInteractive(propId: string): void {
  registry.delete(propId);
}

function dispatch(entry: Registered, trigger: string, value?: number): void {
  window.dispatchEvent(
    new CustomEvent("prop-interaction", {
      detail: { propId: entry.propId, sceneId: entry.sceneId, trigger, value },
    })
  );
}

function runEffect(entry: Registered, effect: EffectName | undefined, on = true): void {
  switch (effect) {
    case "pulse":
      entry.pulseUntil = performance.now() + PULSE_MS;
      break;
    case "spin":
      entry.spinUntil = performance.now() + SPIN_MS;
      break;
    case "glow":
      entry.glowTarget = on ? 1 : 0;
      break;
    case "cycle-color": {
      entry.hue = (entry.hue + 60) % 360;
      const shift = new THREE.Color().setHSL(entry.hue / 360, 0.9, 0.55);
      for (const record of entry.materials) {
        const material = record.material as THREE.MeshStandardMaterial;
        if (entry.hue === 0) material.color.copy(record.baseColor);
        else material.color.copy(record.baseColor).lerp(shift, 0.65);
      }
      break;
    }
  }
}

export function triggerInteraction(propId: string, trigger: "click" | "gaze" | "wave"): void {
  // ?edit: props are inert -- clicks belong to the gizmo/selection, and
  // downstream listeners (Proxie commentary, wearable teleports) firing
  // mid-edit reloaded the scene under Jeff's cursor.
  if (editModeEnabled) return;
  const entry = registry.get(propId);
  if (!entry) return;
  const cfg = entry.config[trigger === "click" ? "click" : trigger === "gaze" ? "gaze" : "wave"];
  if (!cfg) return;
  runEffect(entry, cfg.effect);
  dispatch(entry, trigger);
}

const _scratchA = new THREE.Vector3();
const _scratchB = new THREE.Vector3();
const _hoverRaycaster = new THREE.Raycaster();
const _pointerNdc = new THREE.Vector2();

class HandTracker {
  // Preallocated ring buffer of recent world positions + timestamps.
  private positions: THREE.Vector3[] = Array.from({ length: 8 }, () => new THREE.Vector3());
  private times = new Float64Array(8);
  private index = 0;
  private filled = 0;

  record(position: THREE.Vector3, now: number): void {
    this.positions[this.index].copy(position);
    this.times[this.index] = now;
    this.index = (this.index + 1) % 8;
    if (this.filled < 8) this.filled++;
  }

  /** Average speed (m/s) across samples inside the wave window. */
  speed(now: number): number {
    if (this.filled < 2) return 0;
    let distance = 0;
    let dt = 0;
    for (let i = 1; i < this.filled; i++) {
      const a = (this.index - i - 1 + 16) % 8;
      const b = (this.index - i + 16) % 8;
      if (now - this.times[a] > WAVE_WINDOW_MS) break;
      distance += this.positions[b].distanceTo(this.positions[a]);
      dt += this.times[b] - this.times[a];
    }
    return dt > 0 ? distance / (dt / 1000) : 0;
  }
}

export class InteractionSystem extends createSystem({}) {
  private hands: HandTracker[] = [new HandTracker(), new HandTracker()];
  private pointerDirty = false;
  private lastHoverCast = 0;
  private gazePropId: string | null = null;

  init() {
    // Gaze-dwell rides the existing gazeContext loop -- no second raycast.
    window.addEventListener("gaze-changed", (e) => {
      const lookingAt = (e as CustomEvent).detail?.lookingAt;
      const propId: string | null = lookingAt?.id ?? null;
      if (propId === this.gazePropId) return;
      // gaze left the previous prop
      if (this.gazePropId) this.endGaze(this.gazePropId);
      this.gazePropId = propId;
      if (propId) {
        const entry = registry.get(propId);
        if (entry?.config.gaze) entry.gazeStartedAt = performance.now();
      }
    });

    // Desktop pointer-hover fallback: only marks the pointer dirty; the
    // actual raycast is throttled in update().
    window.addEventListener("pointermove", (e) => {
      const canvas = this.world.renderer.domElement;
      const rect = canvas.getBoundingClientRect();
      _pointerNdc.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      this.pointerDirty = true;
    });

    window.addEventListener("scene-loading", () => {
      this.gazePropId = null;
    });
  }

  private endGaze(propId: string): void {
    const entry = registry.get(propId);
    if (!entry?.config.gaze) return;
    entry.gazeStartedAt = 0;
    if (entry.hovering) return; // hover keeps the glow alive
    runEffect(entry, entry.config.gaze.effect, false);
    dispatch(entry, "gaze-off");
  }

  update(delta: number) {
    const now = performance.now();

    // --- gaze / hover dwell firing ---
    for (const entry of registry.values()) {
      const gazeCfg = entry.config.gaze;
      if (!gazeCfg) continue;
      const dwellMs = gazeCfg.dwellMs ?? GAZE_DWELL_DEFAULT_MS;
      const engagedSince =
        (this.gazePropId === entry.propId && entry.gazeStartedAt) ||
        (entry.hovering && entry.hoverStartedAt) ||
        0;
      if (engagedSince && now - engagedSince >= dwellMs && now - entry.gazeFiredAt > GAZE_REFRACTORY_MS) {
        entry.gazeFiredAt = now;
        runEffect(entry, gazeCfg.effect, true);
        dispatch(entry, "gaze");
      }
    }

    // --- desktop hover raycast, 10Hz, only when the mouse moved ---
    if (
      this.pointerDirty &&
      now - this.lastHoverCast > HOVER_INTERVAL_MS &&
      this.world.visibilityState.value === VisibilityState.NonImmersive
    ) {
      this.lastHoverCast = now;
      this.pointerDirty = false;
      _hoverRaycaster.setFromCamera(_pointerNdc, this.world.camera);
      const roots: THREE.Object3D[] = [];
      for (const entry of registry.values()) {
        if (entry.config.gaze && entry.object3D.parent) roots.push(entry.object3D);
      }
      const hits = roots.length ? _hoverRaycaster.intersectObjects(roots, true) : [];
      let hitEntry: Registered | null = null;
      if (hits.length) {
        let node: THREE.Object3D | null = hits[0].object;
        outer: while (node) {
          for (const entry of registry.values()) {
            if (entry.object3D === node) {
              hitEntry = entry;
              break outer;
            }
          }
          node = node.parent;
        }
      }
      for (const entry of registry.values()) {
        const isHit = entry === hitEntry;
        if (isHit && !entry.hovering) {
          entry.hovering = true;
          entry.hoverStartedAt = now;
        } else if (!isHit && entry.hovering) {
          entry.hovering = false;
          entry.hoverStartedAt = 0;
          if (this.gazePropId !== entry.propId) {
            runEffect(entry, entry.config.gaze?.effect, false);
            dispatch(entry, "gaze-off");
          }
        }
      }
    }

    // --- wave detection: XR only, only when wave props exist ---
    if (this.world.visibilityState.value !== VisibilityState.NonImmersive) {
      let anyWave = false;
      for (const entry of registry.values()) {
        if (entry.config.wave) {
          anyWave = true;
          break;
        }
      }
      if (anyWave) this.detectWaves(now);
    }

    // --- effect animation (pulse / spin / glow decay) ---
    for (const entry of registry.values()) {
      if (entry.pulseUntil > now) {
        const t = 1 - (entry.pulseUntil - now) / PULSE_MS; // 0..1
        const scale = 1 + 0.06 * Math.sin(t * Math.PI);
        entry.object3D.scale.copy(entry.baseScale).multiplyScalar(scale);
      } else if (entry.pulseUntil !== 0) {
        entry.object3D.scale.copy(entry.baseScale);
        entry.pulseUntil = 0;
      }

      if (entry.spinUntil > now) {
        entry.object3D.rotation.y += (Math.PI * 2 * delta * 1000) / SPIN_MS;
      }

      if (entry.glowLevel !== entry.glowTarget) {
        const step = GLOW_LERP_PER_S * delta;
        entry.glowLevel =
          entry.glowLevel < entry.glowTarget
            ? Math.min(entry.glowLevel + step, entry.glowTarget)
            : Math.max(entry.glowLevel - step, entry.glowTarget);
        for (const record of entry.materials) {
          const material = record.material as THREE.MeshStandardMaterial;
          if (record.baseEmissive && material.emissive) {
            material.emissive.copy(record.baseEmissive).addScalar(0.5 * entry.glowLevel);
          } else {
            // Basic materials: brighten the color instead.
            material.color.copy(record.baseColor).multiplyScalar(1 + entry.glowLevel);
          }
        }
      }
    }
  }

  private detectWaves(now: number): void {
    const renderer = this.world.renderer;
    for (let i = 0; i < 2; i++) {
      const grip = renderer.xr.getControllerGrip(i);
      if (!grip) continue;
      grip.getWorldPosition(_scratchA);
      this.hands[i].record(_scratchA, now);
      const speed = this.hands[i].speed(now);
      if (speed < WAVE_SPEED_THRESHOLD) continue;

      for (const entry of registry.values()) {
        const waveCfg = entry.config.wave;
        if (!waveCfg || now - entry.waveFiredAt < WAVE_REFRACTORY_MS) continue;
        if (!entry.object3D.parent) continue;
        entry.object3D.getWorldPosition(_scratchB);
        const radius = waveCfg.radius ?? WAVE_RADIUS_DEFAULT;
        if (_scratchA.distanceToSquared(_scratchB) < radius * radius) {
          entry.waveFiredAt = now;
          runEffect(entry, waveCfg.effect);
          dispatch(entry, "wave", speed);
        }
      }
    }
  }
}

// Convenience for sceneManager: attach the click trigger to a prop root
// using the same DOM-pointer/XR-ray "click" forwarding portals use.
export function attachClickTrigger(world: World, object3D: THREE.Object3D, propId: string): void {
  void world;
  object3D.addEventListener("click" as never, () => triggerInteraction(propId, "click"));
}
