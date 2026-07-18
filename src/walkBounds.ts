// walkBounds.ts
//
// Keeps the visitor inside the scene's "sweet zone" -- the few meters
// around the Marble generation camera where splat quality holds up
// (outside it the environment smears; see planning/reference/
// s1-hangar-qa/ round 2). The zone is a WALK_BOUNDS_DEFAULT-sized box
// centered on the spawn point, overridable per scene via the manifest's
// `walkBounds: { width, depth }` (meters).
//
// Enforcement is a hard per-frame clamp of the player rig's XZ -- one
// mechanism that covers desktop WASD, XR smooth locomotion, and XR
// teleport alike (whatever moved the rig, it ends the frame inside the
// box). The visible counterpart is the diegetic safety-tape barrier
// sceneManager builds at the same perimeter, so the limit reads as
// set dressing, not an invisible wall.
//
// Physical room-scale walking in XR can briefly exceed the box (the
// headset moves the camera, not the rig); that overshoot is bounded by
// the visitor's real play space and self-corrects on the next
// locomotion. Flagged for the first Quest pass.

import { createSystem } from "@iwsdk/core";

export const WALK_BOUNDS_DEFAULT = { width: 4, depth: 4 };

export class WalkBoundsSystem extends createSystem({}) {
  private halfW = WALK_BOUNDS_DEFAULT.width / 2;
  private halfD = WALK_BOUNDS_DEFAULT.depth / 2;

  init() {
    window.addEventListener("scene-changed", (e: Event) => {
      const scene = (e as CustomEvent).detail?.scene as
        | { walkBounds?: { width?: number; depth?: number } }
        | undefined;
      this.halfW = (scene?.walkBounds?.width ?? WALK_BOUNDS_DEFAULT.width) / 2;
      this.halfD = (scene?.walkBounds?.depth ?? WALK_BOUNDS_DEFAULT.depth) / 2;
    });
  }

  update() {
    const p = this.world.player.position;
    p.x = Math.min(this.halfW, Math.max(-this.halfW, p.x));
    p.z = Math.min(this.halfD, Math.max(-this.halfD, p.z));
  }
}
