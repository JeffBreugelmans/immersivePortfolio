// dataGloveFx.ts
//
// TECH_SPEC G "simplified fallback" (2026-07-19): the full render-to-
// texture island mini-game is the reach goal, but the mechanic that's
// guaranteed to ship reuses the same two ideas -- click-to-don (like the
// Holo Stage Vive, see wearableFx.ts) and a continuous 0-1 flex signal
// (hold-click on desktop, real squeeze/pinch strength in XR) -- without
// needing a second scene render. Click the PhD bench's data glove
// (manifest prop with `role: "data-glove"`) and it lifts off the desk
// and settles onto your hand; from then on flexing brings a small desk
// lamp (`scene.flexLamp` in the manifest, a procedural mesh -- no extra
// asset generation) up from a dim ember to a warm glow and back, live,
// every frame.
//
// Same world-space-camera-transform approach as wearableFx.ts's don
// animation, but the destination is a fixed offset in the CAMERA'S
// LOCAL space (the glove is reparented onto world.camera once donned,
// so it simply rides along every frame -- no per-frame tracking code
// needed, unlike CompanionSystem's steering).

import * as THREE from "three";
import { createSystem } from "@iwsdk/core";
import { livePropObjects } from "./sceneManager";
import { registerGazeTarget, unregisterGazeTarget } from "./gazeContext";
import { editorRegisterProp } from "./editor";
import { sceneById as sceneByIdRaw } from "./manifest.js";

interface GloveProp {
  id: string;
  role?: string;
}
type FlexLampConfig = { position: [number, number, number]; rotationYDeg?: number; scale?: number };
const sceneById = sceneByIdRaw as Record<
  string,
  { props?: GloveProp[]; flexLamp?: FlexLampConfig } | undefined
>;

type Phase = "idle" | "lift" | "approach" | "place";

const LIFT_MS = 400;
const APPROACH_MS = 500;
const PLACE_MS = 300;
const LIFT_HEIGHT = 0.15;
const APPROACH_OFFSET = new THREE.Vector3(0.18, -0.15, -0.55); // world-ish lead-in, refined at place
// Local offset under world.camera once worn -- roughly where a raised
// hand holding something sits in view. No real hand-tracking pose
// available without per-joint curl data, so this is a fixed stylized
// spot rather than a tracked hand position.
const HAND_LOCAL_OFFSET = new THREE.Vector3(0.22, -0.28, -0.4);

const DIM_COLOR = new THREE.Color(0x2a1c10);
const BRIGHT_COLOR = new THREE.Color(0xffcc66);
const FLEX_RATE = 6; // ease-toward-target speed while worn
const RELAX_RATE = 3; // decay speed once un-worn (never actually reached today)

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function yawQuat(yaw: number): THREE.Quaternion {
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0));
}

function makeGlowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,224,160,1)");
  gradient.addColorStop(0.45, "rgba(255,190,110,0.5)");
  gradient.addColorStop(1, "rgba(255,190,110,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const _dir = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

export class DataGloveFxSystem extends createSystem({}) {
  private phase: Phase = "idle";
  private phaseElapsed = 0;
  private phaseDurationMs = 0;
  private activeObject: THREE.Object3D | null = null;
  private worn = false;
  private pointerDown = false;
  private flex = 0;

  private phaseStartPos = new THREE.Vector3();
  private phaseStartQuat = new THREE.Quaternion();
  private phaseEndPos = new THREE.Vector3();
  private phaseEndQuat = new THREE.Quaternion();

  private lampGroup: THREE.Group | null = null;
  private bulbMaterial: THREE.MeshBasicMaterial | null = null;
  private glowSprite: THREE.Sprite | null = null;
  private glowTexture: THREE.CanvasTexture | null = null;

  init() {
    // Simplification: any click/hold anywhere counts as a flex pulse
    // once the glove is worn (it's on your hand, not something you have
    // to keep aiming at) -- same spirit as the desktop fallback already
    // specced for the full island game's walk control.
    window.addEventListener("pointerdown", () => {
      this.pointerDown = true;
    });
    window.addEventListener("pointerup", () => {
      this.pointerDown = false;
    });
    window.addEventListener("pointercancel", () => {
      this.pointerDown = false;
    });

    window.addEventListener("prop-interaction", (e) => {
      const detail = (e as CustomEvent).detail as
        | { propId?: string; sceneId?: string; trigger?: string }
        | undefined;
      if (!detail || detail.trigger !== "click" || this.phase !== "idle" || this.worn) return;
      const scene = detail.sceneId ? sceneById[detail.sceneId] : null;
      const entry = scene?.props?.find((p) => p.id === detail.propId);
      if (entry?.role !== "data-glove" || !detail.propId) return;
      const object3D = livePropObjects.get(detail.propId);
      if (!object3D) return;
      this.beginDon(object3D);
    });

    window.addEventListener("scene-loading", () => this.teardownLamp());
    window.addEventListener("scene-changed", (e) => {
      // Fresh scene, fresh props -- whatever was worn belonged to the
      // scene we just left (its object3D is already being destroyed by
      // sceneManager's teardown loop).
      this.phase = "idle";
      this.activeObject = null;
      this.worn = false;
      this.flex = 0;
      const sceneId = (e as CustomEvent).detail?.sceneId as string | undefined;
      const config = (sceneId ? sceneById[sceneId] : null)?.flexLamp;
      if (config) this.spawnLamp(config);
    });
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

  private beginDon(object3D: THREE.Object3D): void {
    this.activeObject = object3D;
    const restYaw = new THREE.Euler().setFromQuaternion(object3D.quaternion, "YXZ").y;
    this.setPhase("lift", LIFT_MS, {
      pos: object3D.position.clone().addScaledVector(_up, LIFT_HEIGHT),
      quat: yawQuat(restYaw + Math.PI),
    });
  }

  private advancePhase(): void {
    switch (this.phase) {
      case "lift": {
        const camPos = new THREE.Vector3();
        this.world.camera.getWorldPosition(camPos);
        this.world.camera.getWorldDirection(_dir);
        const camYaw = Math.atan2(_dir.x, _dir.z);
        this.setPhase("approach", APPROACH_MS, {
          pos: camPos.add(APPROACH_OFFSET),
          quat: yawQuat(camYaw),
        });
        break;
      }
      case "approach": {
        const camPos = new THREE.Vector3();
        this.world.camera.getWorldPosition(camPos);
        this.world.camera.getWorldDirection(_dir);
        const camYaw = Math.atan2(_dir.x, _dir.z);
        // Place target roughly matches HAND_LOCAL_OFFSET in world terms
        // so the reparent snap below is imperceptible.
        this.setPhase("place", PLACE_MS, {
          pos: camPos.add(new THREE.Vector3(0.2, -0.25, -0.35)),
          quat: yawQuat(camYaw),
        });
        break;
      }
      case "place": {
        const obj = this.activeObject;
        this.phase = "idle";
        this.activeObject = null;
        if (obj) {
          obj.parent?.remove(obj);
          this.world.camera.add(obj);
          obj.position.copy(HAND_LOCAL_OFFSET);
          obj.quaternion.identity();
          this.worn = true;
        }
        break;
      }
    }
  }

  private spawnLamp(config: FlexLampConfig): void {
    this.teardownLamp();
    const group = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.07, 0.05, 16),
      new THREE.MeshBasicMaterial({ color: 0x1a1a1c })
    );
    base.position.y = 0.025;
    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 0.18, 8),
      new THREE.MeshBasicMaterial({ color: 0x2a2a2e })
    );
    neck.position.y = 0.14;
    this.bulbMaterial = new THREE.MeshBasicMaterial({ color: DIM_COLOR.clone() });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), this.bulbMaterial);
    bulb.position.y = 0.25;

    this.glowTexture ??= makeGlowTexture();
    this.glowSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: this.glowTexture, transparent: true, opacity: 0, depthWrite: false })
    );
    this.glowSprite.scale.setScalar(0.05);
    this.glowSprite.position.y = 0.25;
    this.glowSprite.renderOrder = 2;

    group.add(base, neck, bulb, this.glowSprite);
    group.position.set(...config.position);
    group.rotation.y = THREE.MathUtils.degToRad(config.rotationYDeg ?? 0);
    if (config.scale) group.scale.setScalar(config.scale);
    this.world.scene.add(group);
    this.lampGroup = group;

    editorRegisterProp({ id: "flex-lamp", position: config.position } as never, group);
    registerGazeTarget(group, {
      id: "flex-lamp",
      label: "Flex lamp",
      description:
        "Wired to the data glove on the bench: flex your hand and this lamp answers, live -- the same idea that turned Jeff's PhD glove into a continuous accessibility signal instead of a simple on/off switch.",
    });
  }

  private teardownLamp(): void {
    if (this.lampGroup) {
      unregisterGazeTarget(this.lampGroup);
      this.lampGroup.removeFromParent();
      this.lampGroup = null;
    }
    this.bulbMaterial = null;
    this.glowSprite = null;
  }

  /** Max squeeze/pinch strength across connected XR input sources, or
   * null outside an XR session (desktop click-hold takes over then). */
  private getXrFlexStrength(): number | null {
    const session = this.world.renderer.xr.getSession?.();
    if (!session) return null;
    let max = 0;
    let found = false;
    for (const source of session.inputSources) {
      const value = (source.gamepad?.buttons as GamepadButton[] | undefined)?.[1]?.value;
      if (typeof value === "number") {
        found = true;
        max = Math.max(max, value);
      }
    }
    return found ? max : null;
  }

  update(delta: number) {
    if (this.phase !== "idle" && this.activeObject) {
      this.phaseElapsed += delta * 1000;
      const t = Math.min(this.phaseElapsed / this.phaseDurationMs, 1);
      const eased = easeInOut(t);
      this.activeObject.position.lerpVectors(this.phaseStartPos, this.phaseEndPos, eased);
      this.activeObject.quaternion.slerpQuaternions(this.phaseStartQuat, this.phaseEndQuat, eased);
      if (t >= 1) this.advancePhase();
    }

    if (this.worn) {
      const xrFlex = this.getXrFlexStrength();
      const target = xrFlex ?? (this.pointerDown ? 1 : 0);
      this.flex += (target - this.flex) * Math.min(1, delta * FLEX_RATE);
    } else if (this.flex > 0) {
      this.flex = Math.max(0, this.flex - delta * RELAX_RATE);
    }

    if (this.bulbMaterial && this.glowSprite) {
      this.bulbMaterial.color.copy(DIM_COLOR).lerp(BRIGHT_COLOR, this.flex);
      const spriteMat = this.glowSprite.material as THREE.SpriteMaterial;
      spriteMat.opacity = this.flex * 0.85;
      this.glowSprite.scale.setScalar(0.05 + this.flex * 0.12);
    }
  }

  destroy() {
    this.teardownLamp();
    this.glowTexture?.dispose();
    this.glowTexture = null;
    super.destroy?.();
  }
}
