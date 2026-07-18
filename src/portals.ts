// portals.ts
//
// IWSDK port of the old A-Frame portal-hotspot component. Same contract:
// a portal is a pulsing cyan ring + floating label that teleports the
// visitor to another scene, triggered either by clicking it (desktop
// mouse via IWSDK's DOM pointer forwarding, controller/hand ray in XR)
// or by walking within PROXIMITY_TRIGGER_DISTANCE of it. Both paths
// dispatch the same window-level "teleport-request" event so
// sceneManager.ts stays decoupled, exactly like portal.js did.
//
// sceneManager.ts sets window.__portalCooldownUntil after every scene
// load so a portal you spawn near on arrival doesn't instantly fire and
// bounce you back. The cooldown guards BOTH trigger paths.

import * as THREE from "three";
import {
  createComponent,
  createSystem,
  Interactable,
  Types,
  type Entity,
  type World,
} from "@iwsdk/core";
import { registerGazeTarget } from "./gazeContext";

const PROXIMITY_TRIGGER_DISTANCE = 1.3; // meters, height-agnostic

export const Portal = createComponent("Portal", {
  targetScene: { type: Types.String, default: "" },
  triggered: { type: Types.Boolean, default: false },
});

declare global {
  interface Window {
    __portalCooldownUntil?: number;
  }
}

function makeLabelSprite(text: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const font = "48px system-ui, sans-serif";
  ctx.font = font;
  const textWidth = Math.ceil(ctx.measureText(text).width);
  canvas.width = textWidth + 32;
  canvas.height = 72;
  // Canvas resize resets state -- set the font again before drawing.
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true })
  );
  // Keep label text readable at a constant world size (~0.08m per px-row).
  const worldHeight = 0.22;
  sprite.scale.set((canvas.width / canvas.height) * worldHeight, worldHeight, 1);
  sprite.position.set(0, 0.6, 0);
  sprite.renderOrder = 2;
  return sprite;
}

export interface PortalOptions {
  targetScene: string;
  label: string;
  position: [number, number, number];
}

export function createPortal(world: World, { targetScene, label, position }: PortalOptions): Entity {
  const group = new THREE.Group();

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.3, 0.4, 48),
    new THREE.MeshBasicMaterial({ color: 0x4cc3d9, side: THREE.DoubleSide })
  );
  // Splats render at renderOrder -10; draw the ring after them so it
  // never vanishes into the environment.
  ring.renderOrder = 1;
  group.add(ring);
  group.add(makeLabelSprite(label));
  group.position.set(...position);

  const entity = world
    .createTransformEntity(group)
    .addComponent(Interactable)
    .addComponent(Portal, { targetScene });

  // Click path: IWSDK forwards DOM pointer events onto scene objects on
  // desktop, and routes controller/hand rays in XR -- both surface as
  // "click" on the object3D.
  group.addEventListener("click" as never, () => triggerPortal(entity));

  registerGazeTarget(group, {
    id: `portal-${targetScene}`,
    label: `Portal to ${label}`,
    description: `A glowing portal ring. Walking into it (or clicking it) teleports the visitor to the "${label}" scene.`,
  });

  return entity;
}

function triggerPortal(entity: Entity): void {
  if (entity.getValue(Portal, "triggered")) return;
  if (Date.now() < (window.__portalCooldownUntil ?? 0)) return;
  entity.setValue(Portal, "triggered", true);
  window.dispatchEvent(
    new CustomEvent("teleport-request", {
      detail: { sceneId: entity.getValue(Portal, "targetScene") },
    })
  );
}

const _portalPos = new THREE.Vector3();
const _camPos = new THREE.Vector3();

/**
 * Pulses portal rings (replaces A-Frame's animation__pulse) and fires the
 * proximity trigger when the camera gets within 1.3m -- works identically
 * for desktop WASD, XR teleport locomotion, and real walking on Quest.
 */
export class PortalSystem extends createSystem({
  portals: { required: [Portal] },
}) {
  update() {
    const pulse = 1 + 0.05 * (1 + Math.sin(performance.now() / 320));
    const cooldownActive = Date.now() < (window.__portalCooldownUntil ?? 0);
    this.world.camera.getWorldPosition(_camPos);

    for (const entity of this.queries.portals.entities) {
      const object3D = entity.object3D;
      if (!object3D) continue;
      object3D.scale.setScalar(pulse);

      if (cooldownActive || entity.getValue(Portal, "triggered")) continue;

      object3D.getWorldPosition(_portalPos);
      // Match height so walking through at head-height counts as passing
      // through the ring (same trick as the old portal.js).
      _portalPos.y = _camPos.y;
      if (_portalPos.distanceTo(_camPos) < PROXIMITY_TRIGGER_DISTANCE) {
        triggerPortal(entity);
      }
    }
  }
}
