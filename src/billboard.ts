// billboard.ts
//
// Placards are double-sided text planes: readable from the front,
// mirrored from the back. Placing them by hand meant every scene
// rotation left some facing away (mirrored text). Rather than hand-flip
// each one, placards now turn to face the visitor every frame on the Y
// axis only (staying upright) -- the museum-info-card ideal, and it
// eliminates the backwards-text problem for good. Their manifest
// rotation is ignored at runtime; position still places them.

import * as THREE from "three";
import { createSystem } from "@iwsdk/core";

// Populated by sceneManager.spawnProp for placard props, cleared on
// scene teardown.
export const billboardTargets = new Set<THREE.Object3D>();

const _camPos = new THREE.Vector3();
const _objPos = new THREE.Vector3();

export class BillboardSystem extends createSystem({}) {
  update() {
    if (billboardTargets.size === 0) return;
    this.world.camera.getWorldPosition(_camPos);
    for (const obj of billboardTargets) {
      obj.getWorldPosition(_objPos);
      // Face the camera, but only yaw -- keep the card vertical.
      const yaw = Math.atan2(_camPos.x - _objPos.x, _camPos.z - _objPos.z);
      obj.rotation.set(0, yaw, 0);
    }
  }
}
