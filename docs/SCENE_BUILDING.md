# Scene Building

How to actually populate a scene: generate its environment, add props on
top of it, and fine-tune where everything sits. Three sources feed every
scene, and the app doesn't care which one produced a given file -- they
all end up as plain files under that scene's folder and get rendered the
same way by `src/sceneManager.ts`.

| Source | What it's for | Script |
|---|---|---|
| World Labs Marble | The whole-room environment (Gaussian splat + collision mesh) | `scripts/marble-generate.mjs` |
| Tripo | A focused single object (e.g. a specific recognizable product) | `scripts/tripo-generate.mjs` |
| Your own assets | Existing GLBs, or 2D images/video you want physically present in the scene | manual -- drop the file in yourself |

## Coordinate system

Three.js is right-handed, **Y-up**, units in **meters**. Prop `position`
is an array `[x, y, z]` relative to the scene root; `rotation` is
`[xDeg, yDeg, zDeg]` degrees; `scale` is a number or `[x, y, z]`.

Reference points already established by `sceneManager.ts`:

- The player spawns at the scene center (`0 0 0`, desktop eye height
  1.6m) on every scene load.
- Portals sit `2.5` meters out from center (`PORTAL_RADIUS`), positioned
  at `1.2` meters up, and trigger within `1.3` meters.

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
     [--image path/to/reference.jpg] \
     [--full-res]   # also grab the 2M-splat version (gitignored, local compare only)
     [--mesh]       # also run the legacy textured-GLB export
   ```
   One generate operation, polled to completion (budget ~5 minutes) --
   the finished world already carries signed URLs for everything, so
   there's no separate export step for splats. See the script's header
   comment for the verified API contract.
3. It drops `scene.spz` (the web-friendly 500k splat), `collider.glb`
   (Marble's low-detail collision mesh -- becomes the XR walk/teleport
   surface), and `metadata.json` straight into that scene's `marble/`
   folder. The manifest already points at those filenames by convention --
   no code change needed.
4. Reload the scene and sanity-check orientation: if the world renders
   upside-down or mirrored (Marble uses OpenCV coordinates), flip the
   environment entity in `sceneManager.ts` -- the commented
   `envEntity.object3D.rotation.x = Math.PI` line is there for exactly
   this. Verify once on the first generated scene; it then applies to all.

Until a scene has a real `scene.spz`, the app shows the committed
placeholder splat (`public/placeholder/scene.spz`, from the SensAI
template) so every scene stays walkable during development.

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
ready-to-paste `manifest.js` snippet. Adjust the printed snippet to the
current schema -- positions are arrays now, and the `label`/`description`
fields are what Proxie's gaze awareness reads out when a visitor looks at
the prop and asks about it:

```js
{
  id: "even-realities-glasses",
  kind: "glb",
  src: `${BASE}afternow/scene-02-smart-glasses-lab/props/even-realities-glasses.glb`,
  source: "tripo",
  label: "Even Realities G1 smart glasses",
  description: "The consumer smart glasses Jeff worked on at AfterNow -- minimalist frames with a monochrome HUD.",
  position: [0, 1.1, -1.5],
}
```

Paste that into the scene's `props` array in `src/manifest.js`, then fix
`position` (and add `rotation`/`scale` if needed) -- see the placement
section below. GLB props are automatically clickable everywhere and
hand-grabbable in XR.

## 3. Adding your own existing assets

Drop the file straight into that scene's `props/` folder yourself, then
add a matching entry to the scene's `props` array in `src/manifest.js`.
`kind` determines how it's rendered:

```js
// A GLB you already have
{ id: "afternow-office", kind: "glb", src: `${BASE}afternow/scene-01-holographic-studio/props/office.glb`, source: "custom", label: "AfterNow office model", position: [0, 0, 0] }

// A flat image (e.g. a slide/photo displayed on a wall)
{ id: "smartcity-slide", kind: "image", src: `${BASE}afternow/scene-01-holographic-studio/props/smartcity.png`, source: "custom", label: "Smart city concept slide", position: [0, 1.5, -2], width: 2, height: 1.2 }

// Video (autoplay/loop/muted by default -- see sceneManager.ts if you need different behavior)
{ id: "demo-reel", kind: "video", src: `${BASE}afternow/scene-02-smart-glasses-lab/props/demo.mp4`, source: "custom", label: "AfterNow demo reel", position: [0, 1.5, -2], width: 2, height: 1.2 }
```

Full schema (all fields, what's required vs optional) is documented in
`src/manifest.js`'s header comment -- that file is the single source of
truth, this doc just explains the workflow around it.

**Check file size before committing.** GitHub rejects anything over
100MB outright, and anything in the tens-of-MB range slows every future
clone permanently. The committed 500k `scene.spz` files run ~10-20MB each
-- that's a deliberate exception so the git-pull deploy keeps working.
Full-res splats (`scene-fullres.spz`) are gitignored; if one is ever
needed live, rsync it to the Spark directly. Treat multi-GB videos and
heavy custom GLBs the same way.

## 4. Previewing and fine-tuning placement

1. `npm run dev`, open `https://localhost:5173/worlds/`.
2. Walk (or click a portal) into the scene you're placing something in.
3. Edit the prop's numbers in `src/manifest.js`, save -- Vite hot-reloads
   and the scene remounts. Repeat until it looks right. (The old A-Frame
   Ctrl+Alt+I Inspector is gone with the A-Frame stack; placement is now
   numbers-in-manifest plus the fast reload loop.)
4. For the XR view without a headset, the localhost dev server injects
   the IWER emulated Quest 3 -- use its on-screen controls to fly the
   emulated headset around the scene.
5. Sanity checks that cost nothing: `window.teleportTo("<sceneId>")` from
   the browser console jumps scenes directly, and `window.__gazeContext`
   shows live what the gaze raycast thinks you're looking at (useful when
   tuning a prop's `label`/`description` for Proxie).
