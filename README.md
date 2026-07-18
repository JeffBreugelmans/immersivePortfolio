# Career World Explorer

Turn a professional's career/resume into an explorable, conversational WebXR
portfolio. Proof of concept: Jeff Breugelmans' own background, guided by
Proxie (his existing AI agent). Built for **Worlds in Action Hack [02]:
SIGGRAPH LA**, July 18-19, 2026.

Full context: [`docs/PROJECT_BRIEF.md`](docs/PROJECT_BRIEF.md).
How the pieces fit together: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
How to generate environments/props and place them: [`docs/SCENE_BUILDING.md`](docs/SCENE_BUILDING.md).
How to get this running on the Spark: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Stack

- **Frontend:** [IWSDK](https://iwsdk.dev) (Meta's Immersive Web SDK, an ECS
  WebXR framework) + [SparkJS](https://sparkjs.dev) (World Labs' Gaussian
  splat renderer, 2.0 preview with LoD) + [Vite](https://vitejs.dev) +
  TypeScript. Follows the official hackathon template
  [sensai-webxr-worldmodels](https://github.com/V4C38/sensai-webxr-worldmodels),
  including its two load-bearing workarounds: the `deduplicateThree` Vite
  plugin (IWSDK bundles Three r177; SparkJS 2.0 needs the project's r181)
  and the camera-clone patch in `gaussianSplatLoader.ts`. Requires
  **Node >= 20.19**.
- **Desktop-first:** most visitors arrive on a laptop, so the site is a
  normal 3D website out of the box -- drag to look around, WASD/arrows to
  walk, click portals, chat with Proxie (typed or spoken). A headset is a
  progressive enhancement: the Enter VR button appears only where WebXR is
  supported, unlocking controller/hand-tracking locomotion and grabbing
  props with your hands.
- **3D environments:** generated via the [World Labs Marble API](https://docs.worldlabs.ai/api)
  as native Gaussian splats (`scene.spz`, the web-friendly 500k variant)
  plus the low-detail collision mesh (`collider.glb`) for XR locomotion --
  both downloaded straight off the generate operation by
  `scripts/marble-generate.mjs` (no export step needed for splats; the
  legacy textured-mesh export survives behind `--mesh`).
- **Scene props (optional, layered on top of the environment):** three
  sources feed the same `props` list in `manifest.js` -- Marble again for
  bigger set-pieces if needed, [Tripo](https://www.tripo3d.ai/api) for
  focused single-object models (best for a specific recognizable product a
  whole-room generation wouldn't render accurately), and your own existing
  GLBs/images/video. GLB props are hand-grabbable in XR. Full workflow in
  `docs/SCENE_BUILDING.md`.
- **Conversational guide:** Proxie (separate FastAPI backend in the
  `avatar-chat` repo, already live at jeffxr.com/chat) -- this repo only
  contains the chat *overlay UI* that talks to it, not the agent itself.
  The overlay is now conversational: push-to-talk voice input (Web Speech
  API, feature-detected with typing as universal fallback), spoken replies
  (browser speechSynthesis, mutable), and **gaze awareness** -- a raycast
  from the view center tells Proxie what object the visitor is looking at
  (`src/gazeContext.ts`), folded into the `scene_context` string the
  backend already accepts, so "what is this?" just works with zero backend
  changes.
- **Hosting:** the built app + all scene assets are served from the same DGX
  Spark that runs Proxie, exposed publicly at `jeffxr.com/worlds` via a
  Squarespace redirect -> path-based Tailscale Funnel mount on port 443 --
  see `docs/DEPLOYMENT.md`.

## Getting started

```bash
npm install   # .npmrc pins legacy-peer-deps (SparkJS peer range vs super-three r181)
npm run dev
```

Opens a local dev server over **HTTPS** (`vite-plugin-mkcert` issues a
locally-trusted cert; WebXR only exists in secure contexts). Since the app
is built with `base: "/worlds/"` (matching its hosted path on the Spark),
the dev server serves it at `https://localhost:5173/worlds/`, not the bare
root -- open that path explicitly, the root 404s.

On localhost the dev server also injects the **IWER headset simulator**
(emulated Quest 3 -- dev-only, never in production builds), so you can
sanity-check the immersive path without hardware. Note that the simulator
captures WASD for emulated-headset movement; test desktop controls in a
production build or via the LAN URL, where IWER is not active.

To test on a Quest 3 over your local network, the config already sets
`server.host: true` -- open `https://<your-lan-ip>:5173/worlds/` on the
headset's browser (accept the self-signed cert warning). For testing over
the open internet, deploy to the Spark first (`docs/DEPLOYMENT.md`).

`.env.example` documents the env vars `.env.local` needs: `VITE_PROXIE_ENDPOINT`
(defaults to the real Cloudflare Worker URL already used by `chat-block.html`,
CORS is wide open so no per-origin config needed), `MARBLE_API_KEY` (get one
at https://platform.worldlabs.ai/api-keys), and `TRIPO3D_API_KEY` (get one at
https://platform.tripo3d.ai/api-keys) -- `.env.local` is gitignored, never
commit the real values.

## Generating and placing scene content

Full workflow -- prompt-tuning, running `marble-generate.mjs` and
`tripo-generate.mjs`, adding your own assets, and the `manifest.js` props
schema (including the `label`/`description` fields that feed Proxie's gaze
awareness) -- lives in [`docs/SCENE_BUILDING.md`](docs/SCENE_BUILDING.md).
Start there before touching `manifest.js` or either generation script.

## Folder structure

```
public/<world>/<scene>/
  reference/      Marble prompt-tuning inputs only -- gitignored, local
  props/          Tripo/custom assets actually rendered in the scene
  prompts.md      prompt iteration log for that scene
  marble/         Marble assets land here: scene.spz (committed, 500k splat),
                  collider.glb, metadata.json; scene-fullres.spz stays gitignored
public/placeholder/scene.spz   committed sample splat shown for any scene
                               whose real scene.spz doesn't exist yet
src/
  manifest.js          World -> Scene -> portal -> props graph (single source of truth)
  index.ts             IWSDK world bootstrap: systems, locomotion floor, VR button
  sceneManager.ts      loads current scene's splat/collider/props, places portals
  portals.ts           portal ring + label, click + walk-through proximity trigger
  desktopControls.ts   drag-to-look + WASD for non-XR visitors
  gazeContext.ts       what-is-the-visitor-looking-at raycast for Proxie
  gaussianSplatLoader.ts / gaussianSplatAnimator.ts
                       SparkJS splat load/unload/fly-in (from the SensAI template)
  proxie-chat.js       chat overlay -- SSE contract, scene- and gaze-aware,
                       voice in/out, avatar states
scripts/
  marble-generate.mjs  Marble: generate -> poll -> download scene.spz + collider.glb
                       (--full-res for the 2M-splat version, --mesh for legacy GLB)
  tripo-generate.mjs   Tripo: upload (if image) -> submit -> poll -> download
server/
  worlds_static.py     FastAPI static host for dist/ -- deployed on the Spark,
                        normalizes the /worlds path prefix either way Tailscale
                        forwards it (see file docstring)
```

## Known stubs / TODO before demo

- Scene-triggered teleport from chat: not built on the backend yet -- see
  `docs/DEPLOYMENT.md` §7 for the proposed `---TELEPORT:<sceneId>---`
  marker convention. Portal clicks and walk-through already work today
  regardless.
- All 9 scene folders currently have no `scene.spz` -- the app falls back to
  the committed placeholder splat per scene until you generate and drop one
  in. No `props/` files exist yet either.
- Portal hotspots are placeholder rings; restyle once real Marble
  environments are in so they read as in-world doorways rather than debug
  markers.
- In-headset chat UI: the chat overlay is 2D DOM, so it isn't visible inside
  an immersive session yet. Planned as an IWSDK spatial panel (UIKitML)
  follow-up; on Quest the overlay still works in the 2D browser before
  entering VR.
