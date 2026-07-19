// billboard.ts
//
// Placards and video screens are double-sided planes: readable from the
// front, mirrored/dark from the back. Hand-placing them meant scene
// rotations left some facing away. They now turn to face the visitor
// (upright, Y-axis only) so orientation stops mattering entirely.
//
// IMPLEMENTATION NOTE (why not a normal System): an earlier version set
// object3D.rotation from a per-frame ECS system, but IWSDK re-syncs each
// entity's Transform onto its object3D during the update phase, which
// silently overwrote the billboard rotation before render -- placards
// stayed at their authored angle (Jeff: "always at 45 degrees"). Doing
// it in onBeforeRender instead runs at draw time, strictly AFTER any ECS
// transform sync, and is called once per rendered camera -- so it is
// also correct per-eye in an XR session.

import * as THREE from "three";

const _camPos = new THREE.Vector3();
const _objPos = new THREE.Vector3();

/** Make an object yaw-face the rendering camera every frame, at render
 *  time (survives the ECS transform sync). Upright: only Y rotates. */
export function attachBillboard(object3D: THREE.Object3D): void {
  object3D.onBeforeRender = function (_renderer, _scene, camera) {
    camera.getWorldPosition(_camPos);
    this.getWorldPosition(_objPos);
    // PlaneGeometry's front (+Z, where the readable texture is) should
    // point at the camera.
    this.rotation.set(0, Math.atan2(_camPos.x - _objPos.x, _camPos.z - _objPos.z), 0);
    // matrixWorld was already computed for this frame; recompute it from
    // the new rotation so this draw uses the billboarded orientation.
    this.updateWorldMatrix(true, false);
  };
}
