# Scene Building

How to actually populate a scene: generate its environment, add props on
top of it, and fine-tune where everything sits. Three sources feed every
scene, and the app doesn't care which one produced a given file -- they
all end up as plain `.glb`/image/video files under that scene's folder
and get rendered the same way by `scene-manager.js`.

| Source | What it's for | Script |
|---|---|---|
| World Labs Marble | The whole-room environment | `scripts/marble-generate.mjs` |
| Tripo | A focused single object (e.g. a specific recognizable product) | `scripts/tripo-generate.mjs` |
| Your own assets | Existing GLBs, or 2D images/video you want physically present in the scene | manual -- drop the file in yourself |

## Coordinate system

A-Frame is right-handed, **Y-up**, units in **meters**. `position="x y z"`
places relative to the scene root; `rotation="x y z"` is degrees around
each axis; `scale="x y z"` is a multiplier (`"1 1 1"` = unchanged).

Reference points already established by `scene-manager.js`:

- The camera spawns at `0 1.6 0` (dead center) on every scene load --
  `1.6` is roughly eye height for a standing adult.
- Portals sit `2.5` meters out from center (`PORTAL_RADIUS` in
  `scene-manager.js`), positioned at `1.2` meters up.

Use those as a rough sense of scale when guessing a first-pass position
before refining visually (next section).

## 1. Generating a Marble environment

1. Prompt-tune in that scene's `prompts.md`, using reference images/video
   in the sibling `reference/` folder (prompt-tuning input only -- never
   rendered, stays local, gitignored).
2. Run the generator:
   ```bash
   node scripts/marble-generate.mjs \
     --world afternow \
     --scene scene-01-holographic-studio \
     --prompt "holographic presentation studio, HoloLens on podium, ..." \
     [--image path/to/reference.jpg]
   ```
   This is a generate -> poll -> export -> poll -> download pipeline, not
   a single call -- budget several minutes, not seconds. See the script's
   header comment for the full verified API contract if you're curious
   how it works under the hood.
3. It drops `scene.glb` (+ `metadata.json`) straight into that scene's
   `marble/` folder. The manifest already points at `marble/scene.glb` by
   convention -- no code change needed if you keep that filename.

## 2. Generating a Tripo prop

For a specific object you want to look precise/recognizable -- a real
product, a distinctive piece of furniture -- rather than whatever a
whole-room generation happens to render for it.

```bash
node scripts/tripo-generate.mjs \
  --world afternow \
  --scene scene-02-smart-glasses-lab \
  --prop-id even-realities-glasses \
  --prompt "a pair of minimalist smart glasses, matte black frame" \
  [--image path/to/reference-photo.jpg]
```

Text-only or image-plus-text both work (image input generally gets you
closer to a *specific real* object than text alone). It saves
`<prop-id>.glb` into that scene's `props/` folder and prints a
ready-to-paste `manifest.js` snippet:

```json
{
  "id": "even-realities-glasses",
  "kind": "glb",
  "src": "${BASE}afternow/scene-02-smart-glasses-lab/props/even-realities-glasses.glb",
  "source": "tripo",
  "position": "0 0 0"
}
```

Paste that into the scene's `props` array in `src/manifest.js`, then fix
`position` (and add `rotation`/`scale` if needed) -- see the placement
section below.

## 3. Adding your own existing assets

Drop the file straight into that scene's `props/` folder yourself, then
add a matching entry to the scene's `props` array in `src/manifest.js`.
`kind` determines how it's rendered:

```js
// A GLB you already have
{ id: "afternow-office", kind: "glb", src: `${BASE}afternow/scene-01-holographic-studio/props/office.glb`, source: "custom", position: "0 0 0" }

// A flat image (e.g. a slide/photo displayed on a wall)
{ id: "smartcity-slide", kind: "image", src: `${BASE}afternow/scene-01-holographic-studio/props/smartcity.png`, source: "custom", position: "0 1.5 -2", width: 2, height: 1.2 }

// Video (autoplay/loop/muted by default -- see scene-manager.js if you need different behavior)
{ id: "demo-reel", kind: "video", src: `${BASE}afternow/scene-02-smart-glasses-lab/props/demo.mp4`, source: "custom", position: "0 1.5 -2", width: 2, height: 1.2 }
```

Full schema (all fields, what's required vs optional) is documented in
`src/manifest.js`'s header comment -- that file is the single source of
truth, this doc just explains the workflow around it.

**Check file size before committing.** GitHub rejects anything over
100MB outright, and anything in the tens-of-MB range slows every future
clone permanently. If a file is large (a multi-GB video, a heavy custom
GLB), don't commit it -- transfer it to the Spark directly over SSH/rsync
instead, and treat `marble/scene.glb` the same way if a generated
environment ever comes back unexpectedly large. There's no published
size guarantee from either provider, so this is a "check the real file,
then decide" situation, not something to assume in advance.

## 4. Previewing and fine-tuning placement

You don't have to guess coordinates blind, and you don't need to deploy
to the Spark to check how something looks. A-Frame ships a full visual
scene editor, already active in this project (nothing disables it):

1. `npm run dev`, open `http://localhost:5173/worlds/`.
2. Walk (or click a portal) into the scene you're placing something in.
3. Press **Ctrl+Alt+I** (Cmd+Option+I on Mac) -- opens the A-Frame
   Inspector directly over your running scene. As of A-Frame 1.8.0
   (installed here), it opens already looking from wherever your in-scene
   camera currently is.
4. Find the prop in the left-side scene tree -- every prop entity carries
   a `data-prop-id` attribute matching the `id` you gave it in
   `manifest.js`, so it's easy to pick out from the environment mesh.
5. Drag the position/rotation/scale gizmos directly on the object, or
   type into the numeric fields in the side panel for precision.
6. Copy the resulting numbers back into that prop's entry in
   `src/manifest.js`, save. The dev server hot-reloads -- repeat until it
   looks right.

This is a local, fast loop against whatever's already sitting in that
scene's `marble/`/`props/` folders -- no need to wait for a deploy to
judge placement.
