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

## Single-page, model-swap approach (not multi-page navigation)

Rather than a separate HTML page per scene, the app is a single `<a-scene>`
that swaps which glTF model is loaded and repositions portal hotspots when
you teleport. This was chosen over multi-page navigation because:

- No page reload / WebXR session teardown when moving between scenes --
  important for staying in an active XR session on Quest 3.
- One chat overlay instance persists across scene transitions instead of
  being torn down and re-initialized.
- The portal graph (`entryPortals` in `src/manifest.js`) is just data, so
  adding/rewiring scenes doesn't touch routing code.

The tradeoff: all scene metadata loads up front (cheap -- it's just a JS
object), but glTF assets load lazily per scene, so scene file size isn't a
concern until you're actually standing in it.

## How Proxie triggers a teleport

`src/scene-manager.js` exposes `window.teleportTo(sceneId)`. Portal clicks
(`src/portal.js` dispatches a `teleport-request` event that
`scene-manager.js` listens for) go through this function today. Confirmed
working in practice -- portal navigation between scenes has been tested
live on the deployed Spark app.

Proxie's real `/chat` endpoint (verified against `avatar-chat/main.py`)
streams SSE tokens plus an optional trailing `---LINKS---` block -- there's
no scene-transition field in the response at all yet. `src/proxie-chat.js`
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
