# PLAN: Vive don/doff animation (wearable magic)

**STATUS (2026-07-19): implemented** on this branch -- see
`src/wearableFx.ts` + the `livePropObjects` changes in
`src/sceneManager.ts`, and the "SESSION UPDATE" entry at the bottom of
`docs/NEXT_STEPS.md` for what was verified and what still needs a look
in a real browser before merge.

Jeff's ask (2026-07-18, verbatim intent): the Holo Stage HTC Vive should
not just click-and-teleport. **Don**: the headset lifts off the museum
shelf, rotates 180°, flies to a spot just above the visitor's head, then
slides down over their eyes -- THEN the fade/teleport to Second Studio
fires. **Doff**: when the visitor returns from Second Studio to the Holo
Stage, the reverse plays -- the headset starts on their face, lifts off,
and flies back to its shelf spot. Player position/orientation will
differ between don and doff; use world-space transforms of the live
camera (`world.camera.getWorldPosition/Quaternion`) so it works from
wherever they stand. Goal: "magical, more than a point and click
adventure."

## Current state (what already exists on main)

- The Vive prop lives in `src/manifest.js` under scene-01-holo-stage
  with `teleportTo: "scene-02-second-studio-construct"` and
  `wearable: true` (the flag is INERT today -- nothing reads it yet).
- `src/sceneManager.ts` has a generic `prop-interaction` listener (search
  "Manifest-driven wearable/portal props") that teleports 500ms after
  any click on a prop with `teleportTo`. The don animation replaces that
  delay for wearable props.
- Click SFX (`vive-don`) already plays via the interaction config.
- `window.teleportTo(sceneId)` runs the fade + scene swap.
- Prop object3Ds carry `userData.propId`; `spawnProp` in sceneManager is
  where they're created (a lookup map must be added -- see below).

## Implementation sketch

1. `src/sceneManager.ts`:
   - Export `const livePropObjects = new Map<string, THREE.Object3D>()`;
     set in `spawnProp` (`livePropObjects.set(prop.id, object3D)`), clear
     in the scene teardown loop.
   - In the existing teleport listener, skip entries with
     `wearable: true` (the new system owns their click flow).
2. New `src/wearableFx.ts` (system, register in `src/index.ts` after
   CompanionSystem):
   - Listen for `prop-interaction` clicks on wearable+teleportTo props.
     Guard against re-entry while animating.
   - **Don phases** (world space, ease in/out each):
     a. lift: +0.35m above shelf pose, yaw += PI (0.45s)
     b. approach: lerp to `cameraPos + (0, 0.45, 0)` (0.6s); keep facing
        the camera's yaw so the visor points the right way
     c. don: lerp down to the exact eye position (0.35s) -- clipping
        through the near plane here is fine, it sells the effect
     d. call `window.teleportTo(entry.teleportTo)` (fade covers the cut)
   - **Doff**: track `lastSceneId` from `scene-changed` events. When a
     scene loads and one of its props is `wearable` with
     `teleportTo === lastSceneId` (i.e. we just came BACK from that
     world): capture the prop's freshly-spawned shelf pose, snap it to
     the current eye position, then play the reverse phases back to the
     saved pose (total ~1.2s, one 180° yaw on the way).
   - Manual per-frame lerp in `update(delta)` (same pattern as
     CompanionSystem steering); no tween lib.
3. QA: typecheck + build + smoke (11 PASS), screenshot S3 mid-don is
   hard headless -- verify by eye in browser; check the doff plays when
   walking back through S4's return portal. Desktop AND XR (camera pose
   code is identical, but verify near-plane clip feel on Quest).

## Also queued for this branch (smaller)

- Projector wall placement polish: Jeff will fine-tune in `?edit`; its
  exported y is floor-relative -- add the S5 floor height (-1.6) when
  baking back into `projectorWall.position` (absolute) in the manifest.
- S4 video screen placement polish via `?edit` (video prop exports like
  any prop).
- Remaining S2 props when Jeff's Tripo files land (data glove, Tobii,
  smart lamp -- prompts in NEXT_STEPS).

## How to resume from a fresh session (mobile included)

```
git fetch && git checkout claude/wearable-fx
```
Then: "Read docs/PLAN-wearable-fx.md and the SESSION HANDOFF section of
docs/NEXT_STEPS.md, then implement the plan. Deploy to the spark only
after merging back to main (spark serves main)."
Deploy loop and gotchas are in NEXT_STEPS; headless QA commands are in
the memory files and NEXT_STEPS ("Headless QA").
