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

- **Frontend:** [A-Frame](https://aframe.io) + [Vite](https://vitejs.dev). A-Frame was chosen over vanilla
  Three.js or React Three Fiber for this hackathon specifically because of the
  1.5-day timeline: declarative scene setup, ready-made WebXR/teleport
  support, no custom controller/raycasting code needed. It also ships a
  full visual scene editor for free (Ctrl+Alt+I) -- see
  `docs/SCENE_BUILDING.md` for using it to place props.
- **3D environments:** pre-generated via the [World Labs Marble API](https://docs.worldlabs.ai/api),
  exported as glTF (`.glb`) and dropped into `public/<world>/<scene>/marble/`.
  Verified against the live docs, not guessed -- see `scripts/marble-generate.mjs`'s
  header comment for the real 3-step contract (generate -> poll -> export
  the textured mesh -> poll that too).
- **Scene props (optional, layered on top of the environment):** three
  sources feed the same `props` list in `manifest.js` -- Marble again for
  bigger set-pieces if needed, [Tripo](https://www.tripo3d.ai/api) for
  focused single-object models (best for a specific recognizable product a
  whole-room generation wouldn't render accurately), and your own existing
  GLBs/images/video. Full workflow in `docs/SCENE_BUILDING.md`.
- **Conversational guide:** Proxie (separate FastAPI backend in the
  `avatar-chat` repo, already live at jeffxr.com/chat) -- this repo only
  contains the chat *overlay UI* that talks to it, not the agent itself.
- **Hosting:** the built app + all GLB assets are served from the same DGX
  Spark that runs Proxie, exposed publicly at `jeffxr.com/worlds` via a
  Squarespace redirect -> path-based Tailscale Funnel mount on port 443 --
  see `docs/DEPLOYMENT.md`.

## Getting started

```bash
npm install
npm run dev
```

Opens a local dev server. **Note:** since the app is built with
`base: "/worlds/"` (matching its hosted path on the Spark), the dev server
serves it at `http://localhost:5173/worlds/`, not the bare root -- open
that path explicitly, the root 404s.

To test on a Quest 3 over your local network, the config already sets
`server.host: true` -- open `http://<your-lan-ip>:5173/worlds/` on the
headset's browser. WebXR generally requires HTTPS off-device, so for
testing over the open internet, deploy to the Spark first
(`docs/DEPLOYMENT.md`) rather than relying on the plain LAN dev server.

`.env.example` documents the env vars `.env.local` needs: `VITE_PROXIE_ENDPOINT`
(defaults to the real Cloudflare Worker URL already used by `chat-block.html`,
CORS is wide open so no per-origin config needed), `MARBLE_API_KEY` (get one
at https://platform.worldlabs.ai/api-keys), and `TRIPO3D_API_KEY` (get one at
https://platform.tripo3d.ai/api-keys) -- `.env.local` is gitignored, never
commit the real values.

## Generating and placing scene content

Full workflow -- prompt-tuning, running `marble-generate.mjs` and
`tripo-generate.mjs`, adding your own assets, the `manifest.js` props
schema, file-size/git guidance, and using the A-Frame Inspector
(Ctrl+Alt+I) to visually fine-tune placement instead of guessing
coordinates blind -- lives in
[`docs/SCENE_BUILDING.md`](docs/SCENE_BUILDING.md). Start there before
touching `manifest.js` or either generation script.

## Folder structure

```
public/<world>/<scene>/
  reference/     Marble prompt-tuning inputs only -- gitignored, local
  props/          Tripo/custom assets actually rendered in the scene
  prompts.md      prompt iteration log for that scene
  marble/         Marble export lands here (scene.glb + metadata.json)
src/
  manifest.js      World -> Scene -> portal -> props graph (single source of truth)
  scene-manager.js loads current scene's glb + props, places portal hotspots
  portal.js        portal hotspot A-Frame component (click + walk-through proximity trigger)
  proxie-chat.js   chat overlay -- real SSE contract, scene-aware, avatar states
  main.js          wires it all together
scripts/
  marble-generate.mjs  Marble: generate -> poll -> export -> poll -> download
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
- All 9 scene folders currently have no `scene.glb` -- the app falls back to
  a plain gray ground plane per scene until you generate and drop one in.
  No `props/` files exist yet either.
- Portal hotspots are placeholder rings; restyle once real Marble
  environments are in so they read as in-world doorways rather than debug
  markers.
