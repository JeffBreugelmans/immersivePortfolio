# Architecture

## Why one folder per scene

Each scene is its own independent Marble generation (Marble doesn't fuse
multiple distinct scenes into one -- see brief). Practically, each scene also
needs its own reference photos, its own prompt-iteration history, and its
own exported asset bundle. Colocating those three things
(`reference/`, `prompts.md`, `marble/`) under one folder per scene keeps
everything needed to reproduce or tweak a scene in one place, and keeps the
9 scenes from the brief (plus any future ones) from turning into a pile of
same-named files at the repo root.

```
public/<worldId>/<sceneId>/
  reference/
  prompts.md
  marble/
```

`worldId` groups scenes into the "chapters" from the brief (AfterNow,
Microsoft Consulting, Education). This matches how portals are scoped: a
scene mostly portals to its siblings within the same World, per the brief's
"3 sub-scenes per world, connected via portal/teleport points."

Note: this folder does NOT have a "worlds" segment (i.e. not
`public/worlds/<worldId>/...`) even though the app is hosted at the
`/worlds` path on the Spark. Those are two independent uses of the word
"worlds" that happened to collide -- the Vite `base: "/worlds/"` config
(see `docs/DEPLOYMENT.md` §4) already establishes that prefix at the
hosting level, so repeating it inside `public/` would have meant asset URLs
like `/worlds/worlds/afternow/...`, and worse, an actual runtime bug under
one of the two possible ways Tailscale might forward a path-mounted Funnel
request. Flattening this was part of that fix.

## Single-page, scene-swap approach (not multi-page navigation)

Rather than a separate HTML page per scene, the app is a single IWSDK
world that swaps which Gaussian splat is loaded and respawns portals/props
when you teleport (`src/sceneManager.ts`). This was chosen over multi-page
navigation because:

- No page reload / WebXR session teardown when moving between scenes --
  important for staying in an active XR session on Quest 3.
- One chat overlay instance persists across scene transitions instead of
  being torn down and re-initialized.
- The portal graph (`entryPortals` in `src/manifest.js`) is just data, so
  adding/rewiring scenes doesn't touch routing code.

The tradeoff: all scene metadata loads up front (cheap -- it's just a JS
object), but splat/prop assets load lazily per scene, so scene file size
isn't a concern until you're actually standing in it.

Environment swaps reuse ONE persistent splat-host entity: SparkJS splat
disposal is handled inside `GaussianSplatLoaderSystem` (from the SensAI
template), whose `load()` auto-unloads the previous splat for the same
entity -- leak-free by construction. Portals, props, and the per-scene
collision mesh ARE torn down and rebuilt each swap, with explicit
geometry/material disposal in `sceneManager.ts`.

## Frontend module map (post IWSDK migration)

- `src/index.ts` -- `World.create` bootstrap: XR session config (offered
  VR, hand tracking), system registration, the invisible fallback
  locomotion floor, loading overlay, Enter VR button. Also pauses IWSDK's
  `LocomotionSystem` outside immersive sessions (it writes the physics
  engine's position onto the player every frame, which would fight the
  desktop controls) and hands it the current position on XR entry.
- `src/desktopControls.ts` -- drag-to-look + WASD for the desktop-first
  audience; inert during XR sessions and scene loads.
- `src/portals.ts` -- portal ring/label entities + `PortalSystem`
  (pulse animation, 1.3m proximity trigger, click trigger, arrival
  cooldown guard).
- `src/gazeContext.ts` -- center-of-view raycast + frustum check over
  registered objects; publishes `window.__gazeContext` / `gaze-changed`
  for the chat overlay.
- `src/gaussianSplatLoader.ts`, `src/gaussianSplatAnimator.ts` -- SparkJS
  splat lifecycle + GPU fly-in, taken from the sensai-webxr-worldmodels
  template together with its required workarounds (camera-clone patch;
  see also `deduplicateThree` in `vite.config.ts`).
- `src/proxie-chat.js` -- DOM chat overlay: SSE streaming, scene + gaze
  context assembly, Web Speech push-to-talk input, speechSynthesis
  replies, avatar states.

## How Proxie triggers a teleport

`src/sceneManager.ts` exposes `window.teleportTo(sceneId)`. Portal
triggers (`src/portals.ts` dispatches a `teleport-request` event that
`sceneManager.ts` listens for) go through the same path.

Proxie's real `/chat` endpoint (verified against `avatar-chat/main.py`)
streams SSE tokens plus an optional trailing `---LINKS---` block -- there's
no scene-transition field in the response at all yet. The frontend also
feeds Proxie *gaze context* on every message: `scene_context` now includes
what the visitor is looking at and which key objects are on screen
(`src/gazeContext.ts`), which required zero backend changes since it rides
inside the existing `scene_context` string. `src/proxie-chat.js`
parses defensively for a proposed `---TELEPORT:<sceneId>---` marker
(same style as the existing `---LINKS---` convention), but nothing on the
backend emits it yet -- see `docs/DEPLOYMENT.md` §7 for what adding that
would take (a `system_prompt.txt` addition, no `main.py` code change
expected). Whether Jeff goes with a single guide agent or one agent per
experience doesn't change this contract -- either way, whichever agent is
behind the endpoint just needs to append that marker when a topic warrants
a scene change. Until it's built, teleportation only happens via in-world
portal clicks, which is a fine fallback for the demo.

## What's NOT in this repo

Proxie itself (FastAPI + ChromaDB/LlamaIndex RAG backend) stays in its
existing deployment -- this repo only holds the WebXR frontend and the chat
overlay UI that calls it. Per the brief, that backend "can remain the same"
regardless of single-agent-vs-per-experience-agent decisions.
