// gazeContext.ts
//
// Makes Proxie aware of what the visitor is looking at. Scene objects
// (portals, props) register themselves with a label + description; a few
// times per second this system raycasts from the center of the view --
// the mouse-look direction on desktop, actual head gaze in a headset --
// and keeps track of:
//
//   lookingAt: the registered object under the view center, held through
//              a short dwell so it doesn't flicker as the camera moves
//   visible:   every registered object currently inside the camera
//              frustum ("key objects on screen")
//
// Results are published on window.__gazeContext and via a "gaze-changed"
// window event. proxie-chat.js folds them into the scene_context string
// it already sends with every message, so the backend needs no changes:
// "what is this?" just works because Proxie is told what "this" is.

import * as THREE from "three";
import { createSystem } from "@iwsdk/core";

export interface GazeTargetInfo {
  id: string;
  label: string;
  description?: string;
}

export interface GazeContext {
  lookingAt: GazeTargetInfo | null;
  visible: GazeTargetInfo[];
}

declare global {
  interface Window {
    __gazeContext?: GazeContext;
  }
}

// Registry keyed by the root Object3D of each described scene object.
// sceneManager tears scene objects down on teleport, so entries are
// removed explicitly via unregisterGazeTarget (and lazily skipped if an
// object somehow leaves the scene graph without unregistering).
const targets = new Map<THREE.Object3D, GazeTargetInfo>();

export function registerGazeTarget(object3D: THREE.Object3D, info: GazeTargetInfo): void {
  targets.set(object3D, info);
}

export function unregisterGazeTarget(object3D: THREE.Object3D): void {
  targets.delete(object3D);
}

const RAYCAST_INTERVAL_MS = 250;
const DWELL_MS = 300; // how long a hit must persist before it "counts"
const MAX_GAZE_DISTANCE = 12; // meters; beyond this you're not "looking at" it

const _raycaster = new THREE.Raycaster();
_raycaster.far = MAX_GAZE_DISTANCE;
const _center = new THREE.Vector2(0, 0); // NDC center of the view
const _frustum = new THREE.Frustum();
const _projScreenMatrix = new THREE.Matrix4();
const _worldPos = new THREE.Vector3();

function findRegisteredRoot(hit: THREE.Object3D): THREE.Object3D | null {
  let node: THREE.Object3D | null = hit;
  while (node) {
    if (targets.has(node)) return node;
    node = node.parent;
  }
  return null;
}

export class GazeContextSystem extends createSystem({}) {
  private lastCast = 0;
  private candidate: THREE.Object3D | null = null;
  private candidateSince = 0;
  private current: THREE.Object3D | null = null;

  update() {
    const now = performance.now();
    if (now - this.lastCast < RAYCAST_INTERVAL_MS) return;
    this.lastCast = now;

    const camera = this.world.camera;

    // --- center-of-view raycast against registered roots ---
    _raycaster.setFromCamera(_center, camera);
    const roots = [...targets.keys()].filter((o) => o.parent !== null);
    const hits = _raycaster.intersectObjects(roots, true);
    const hitRoot = hits.length ? findRegisteredRoot(hits[0].object) : null;

    // Dwell debounce: a new target must stay under the crosshair for
    // DWELL_MS before replacing the current one; losing the target
    // clears it after the same dwell (via the null candidate path).
    if (hitRoot !== this.candidate) {
      this.candidate = hitRoot;
      this.candidateSince = now;
    }
    let changed = false;
    if (this.candidate !== this.current && now - this.candidateSince >= DWELL_MS) {
      this.current = this.candidate;
      changed = true;
    }

    // --- frustum check for "key objects on screen" ---
    _projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_projScreenMatrix);
    const visible: GazeTargetInfo[] = [];
    for (const [object3D, info] of targets) {
      if (!object3D.parent) continue;
      object3D.getWorldPosition(_worldPos);
      if (_frustum.containsPoint(_worldPos)) visible.push(info);
    }

    const previous = window.__gazeContext;
    const context: GazeContext = {
      lookingAt: this.current ? (targets.get(this.current) ?? null) : null,
      visible,
    };
    window.__gazeContext = context;

    if (changed || previous?.visible.length !== visible.length) {
      window.dispatchEvent(new CustomEvent("gaze-changed", { detail: context }));
    }
  }
}
