# Career World Explorer

Turn a professional's career/resume into an explorable, conversational WebXR
portfolio. Proof of concept: Jeff Breugelmans' own background, guided by
Proxie (his existing AI agent). Built for **Worlds in Action Hack [02]:
SIGGRAPH LA**, July 18-19, 2026.

Full context: [`docs/PROJECT_BRIEF.md`](docs/PROJECT_BRIEF.md).
How the pieces fit together: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
How to get this running on the Spark: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Stack

- **Frontend:** [A-Frame](https://aframe.io) + [Vite](https://vitejs.dev). A-Frame was chosen over vanilla
  Three.js or React Three Fiber for this hackathon specifically because of the
  1.5-day timeline: declarative scene setup, ready-made WebXR/teleport
  support, no custom controller/raycasting code needed.
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
  GLBs/images/video. See `manifest.js`'s header comment for the schema.
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

`.env.example` documents both env vars `.env.local` needs: `VITE_PROXIE_ENDPOINT`
(defaults to the real Cloudflare Worker URL already used by `chat-block.html`,
CORS is wide open so no per-origin config needed) and `MARBLE_API_KEY` (get
one at https://platform.worldlabs.ai/api-keys -- `.env.local` is gitignored,
never commit the real value).

## Adding a new scene's environment

1. Prompt-tune in `public/<world>/<scene>/prompts.md`, using your
   reference images/video in the sibling `reference/` folder (prompt-tuning
   input only, never rendered, stays local/gitignored).
2. Generate with Marble: `node scripts/marble-generate.mjs --world <id>
   --scene <id> --prompt "..." [--image path]`. Takes several minutes --
   it's a generate-then-export pipeline, not a single call.
3. The script drops the resulting `scene.glb` (+ `metadata.json`) straight
   into that scene's `marble/` folder -- the manifest already points at
   `marble/scene.glb` by convention, so no code change needed.
4. If it's a brand-new scene (not one of the 9 already in the brief), add an
   entry to `src/manifest.js` with its `id`, `title`, `glb` path (built via
   `${BASE}<world>/<scene>/marble/scene.glb`, matching the existing
   entries), and which other scene ids it should have a visible portal to
   (`entryPortals`).

## Adding props (Tripo objects, your own GLBs, images, video)

Add an entry to that scene's `props` array in `src/manifest.js` -- see the
schema documented in that file's header comment. Drop the actual asset file
into that scene's `props/` folder. `scene-manager.js` renders whatever's
listed there on top of the Marble environment automatically; a prop whose
file isn't there yet just 404s quietly in the console, same as the main
environment model does, so it's safe to wire up the manifest entry before
the asset exists.

**Check file size before committing anything into `props/`.** GitHub
rejects files over 100MB outright, and large files bloat every future
clone permanently. If something's big (a multi-GB video, for instance),
it needs to be transferred to the Spark directly (rsync/scp) instead of
going through git -- flag it rather than committing it.

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
  marble-generate.mjs  CLI helper: generate -> poll -> export -> poll -> download
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
