// desktopControls.ts
//
// Mouse + keyboard controls for non-XR visitors -- the primary audience.
// IWSDK 0.2.2 ships no desktop camera or movement controls (its published
// npm build predates the browserControls option on GitHub), so this
// system owns the camera outside XR:
//
//   - drag-to-look: hold left mouse button and drag to rotate the view.
//     Deliberately NOT pointer-lock: the chat overlay needs a live cursor,
//     and click-to-teleport portals need normal click semantics.
//   - WASD / arrow keys: walk on the XZ plane along the view direction.
//     Suppressed while the visitor is typing into the chat input.
//
// Rig convention (matches IWSDK's XROrigin): yaw goes on world.player,
// pitch + eye height go on world.camera (a child of player). The moment
// an XR session starts, visibilityState leaves NonImmersive and this
// system goes inert -- the headset pose and IWSDK's LocomotionSystem take
// over the same rig without a fight.

import { MathUtils } from "three";
import { createSystem, VisibilityState } from "@iwsdk/core";

const LOOK_SPEED = 0.004; // rad per px dragged
const MOVE_SPEED = 3; // m/s
const EYE_HEIGHT = 1.6; // meters, desktop only (XR uses the real head pose)
const MAX_PITCH = 1.45; // rad, just short of straight up/down

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}

export class DesktopControlsSystem extends createSystem({}) {
  private yaw = 0;
  private pitch = 0;
  private dragging = false;
  private keys = new Set<string>();
  private sceneLoading = false;

  init() {
    const canvas = this.world.renderer.domElement;

    canvas.addEventListener("pointerdown", (e: PointerEvent) => {
      if (e.button === 0) this.dragging = true;
    });
    window.addEventListener("pointerup", () => {
      this.dragging = false;
    });
    window.addEventListener("blur", () => {
      this.dragging = false;
      this.keys.clear();
    });
    canvas.addEventListener("pointermove", (e: PointerEvent) => {
      if (!this.dragging || !this.active()) return;
      this.yaw -= e.movementX * LOOK_SPEED;
      this.pitch = MathUtils.clamp(this.pitch - e.movementY * LOOK_SPEED, -MAX_PITCH, MAX_PITCH);
    });

    window.addEventListener("keydown", (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      this.keys.add(e.code);
    });
    window.addEventListener("keyup", (e: KeyboardEvent) => {
      this.keys.delete(e.code);
    });

    // Freeze movement while a scene swap is in flight (splat loads take a
    // few seconds): otherwise a visitor still holding W walks blindly
    // behind the loading overlay and can end up inside a portal's
    // trigger radius the moment the arrival cooldown expires.
    window.addEventListener("scene-loading", () => {
      this.sceneLoading = true;
    });

    // Fresh scene, fresh view: sceneManager respawns the player at the
    // center, so face forward again too.
    window.addEventListener("scene-changed", () => {
      this.sceneLoading = false;
      this.yaw = 0;
      this.pitch = 0;
    });
  }

  private active(): boolean {
    return !this.sceneLoading && this.world.visibilityState.value === VisibilityState.NonImmersive;
  }

  private axis(positive: string[], negative: string[]): number {
    const has = (codes: string[]) => codes.some((c) => this.keys.has(c));
    return Number(has(positive)) - Number(has(negative));
  }

  update(delta: number) {
    // Console-debuggable state (also used by the automated smoke test).
    (window as unknown as Record<string, unknown>).__playerDebug = {
      pos: this.world.player.position.toArray(),
      yaw: this.yaw,
      keys: [...this.keys],
      active: this.active(),
    };
    if (!this.active()) return;

    const player = this.world.player;
    const camera = this.world.camera;

    player.rotation.y = this.yaw;
    camera.rotation.set(this.pitch, 0, 0);
    camera.position.set(0, EYE_HEIGHT, 0);

    const forward = this.axis(["KeyW", "ArrowUp"], ["KeyS", "ArrowDown"]);
    const strafe = this.axis(["KeyD", "ArrowRight"], ["KeyA", "ArrowLeft"]);
    if (forward || strafe) {
      // Clamp so a slow frame (tab restore, GC hitch, splat LoD build)
      // can't fling the player meters in one step -- e.g. straight
      // through a portal's proximity zone without ever registering.
      const step = MOVE_SPEED * Math.min(delta, 0.1);
      const sin = Math.sin(this.yaw);
      const cos = Math.cos(this.yaw);
      // Forward is -Z in local space; rotate the local (strafe, -forward)
      // vector by yaw into world XZ.
      player.position.x += (-sin * forward + cos * strafe) * step;
      player.position.z += (-cos * forward + sin * strafe) * step;
    }
  }
}
