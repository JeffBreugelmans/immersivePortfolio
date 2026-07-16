# Career World Explorer

Turn a professional's career/resume into an explorable, conversational WebXR
portfolio. Proof of concept: Jeff Breugelmans' own background, guided by
Proxie (his existing AI agent). Built for **Worlds in Action Hack [02]:
SIGGRAPH LA**, July 18–19, 2026.

Full context: [`docs/PROJECT_BRIEF.md`](docs/PROJECT_BRIEF.md).
How the pieces fit together: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
How to get this running on the Spark: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Stack

- **Frontend:** [A-Frame](https://aframe.io) + [Vite](https://vitejs.dev). A-Frame was chosen over vanilla
  Three.js or React Three Fiber for this hackathon specifically because of the
  1.5-day timeline: declarative scene setup, ready-made WebXR/teleport
  support, no custom controller/raycasting code needed.
- **3D scenes:** pre-generated via the [World Labs Marble API](https://docs.worldlabs.ai/api),
  exported as glTF (`.glb`) and dropped into `public/worlds/`.
- **Conversational guide:** Proxie (separate FastAPI backend in the
  `avatar-chat` repo, already live at jeffxr.com/chat) — this repo only
  contains the chat *overlay UI* that talks to it, not the agent itself.
- **Hosting:** the built app + all GLB assets are served from the same DGX
  Spark that runs Proxie, exposed via Tailscale Funnel — see
  `docs/DEPLOYMENT.md`.

## Getting started

```bash
npm install
npm run dev
```

Opens a local dev server (check the terminal for the URL). To test on a
Quest 3 over your local network, the config already sets `server.host: true`
— open the LAN URL Vite prints on the headset's browser. Note: WebXR
generally requires HTTPS off-device, so for on-headset testing over the
open internet, deploy to the Spark first (`docs/DEPLOYMENT.md`) rather than
relying on the plain LAN dev server.

`.env.example` already defaults `VITE_PROXIE_ENDPOINT` to the real
Cloudflare Worker URL used by `chat-block.html` — copy it to `.env.local`
as-is unless you stand up a separate Worker route for this app. See
`docs/DEPLOYMENT.md` §5 for a CORS check that still needs doing on the
Worker side.

## Adding a new scene

1. Prompt-tune in `public/worlds/<world>/<scene>/prompts.md`, using your
   reference images in the sibling `reference/` folder.
2. Generate with Marble (`scripts/marble-generate.mjs` — confirm the API
   contract in the script's header comment before relying on it, it's
   inferred from the brief, not yet verified against live docs).
3. Drop the resulting `scene.glb` into that scene's `marble/` folder — the
   manifest already points at `marble/scene.glb` by convention, so no code
   change needed if you keep that filename.
4. If it's a brand-new scene (not one of the 9 already in the brief), add an
   entry to `src/manifest.js` with its `id`, `title`, `glb` path, and which
   other scene ids it should have a visible portal to (`entryPortals`).

## Folder structure

```
public/worlds/<world>/<scene>/
  reference/     reference photos you're prompting from
  prompts.md      prompt iteration log for that scene
  marble/         Marble export lands here (scene.glb + metadata.json)
src/
  manifest.js      World -> Scene -> portal graph (single source of truth)
  scene-manager.js loads current scene's glb, places portal hotspots
  portal.js        clickable portal hotspot A-Frame component
  proxie-chat.js   chat overlay — real SSE contract, verified against avatar-chat/main.py
  main.js          wires it all together
scripts/
  marble-generate.mjs  CLI helper to call Marble + download result (stub)
server/
  worlds_static.py     FastAPI static host for dist/ — deployed on the Spark
```

## Known stubs / TODO before demo

- Cloudflare Worker CORS: needs to allow this app's hosted origin — see
  `docs/DEPLOYMENT.md` §5. Not something checkable from this repo since the
  Worker script lives in the Cloudflare dashboard, not here.
- Scene-triggered teleport from chat: not built on the backend yet — see
  `docs/DEPLOYMENT.md` §6 for the proposed `---TELEPORT:<sceneId>---`
  marker convention. Portal clicks work today regardless.
- `scripts/marble-generate.mjs`: Marble API base URL and response field
  names (`operationId`, `glbUrl`) are inferred from the brief, not verified
  against `docs.worldlabs.ai/api` yet.
- All 9 scene folders currently have no `scene.glb` — the app falls back to
  a plain gray ground plane per scene until you generate and drop one in.
- Portal hotspots are placeholder rings; restyle once real Marble
  environments are in so they read as in-world doorways rather than debug
  markers.
