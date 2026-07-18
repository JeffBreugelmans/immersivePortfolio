# The Hangar on the Polder

**Brief description:** Royal Netherlands Air Force maintenance hangar at
golden hour -- F-16, Chinook, doors open onto a Dutch polder with a
turning windmill. Where Jeff's engineering story begins; the upbringing
lives on the break table, the Netherlands lives outside the doors.
Full design: `docs/WORLD_DESIGNS.md` S1.

## Reference images
None yet -- Jeff didn't have RNLAF-era photos on hand. Text-only
generation. If a strong hangar interior photo turns up, drop it here and
switch to image-led generation per the project brief's rule of thumb.

## Prompt iterations

### v1
```
Interior of a Royal Netherlands Air Force maintenance hangar at golden hour,
camera at standing eye height in the middle of the smooth concrete floor.
Enormous hangar doors on one side are fully open to a flat Dutch polder
landscape: green fields, a narrow canal, a bike path, and one traditional
windmill in the middle distance under a warm late-afternoon sky. Low sun
pours through the doorway in long golden god rays with visible dust motes;
interior fill light is cool and industrial from high halide fixtures. A grey
F-16 fighter jet stands near the open doors with an engine access panel
open and a yellow maintenance stand beside it; a tandem-rotor Chinook
helicopter sits deeper in the hangar in soft shadow. Red rolling tool
chests, a workbench with hand tools, coiled air hoses, safety-yellow floor
markings, a small break table with two chairs near a side wall. Palette:
concrete grey, NATO green-grey aircraft, safety yellow accents, warm gold
sunlight. The concrete floor is clean, flat, and walkable throughout, with
a clear open area at least eight meters wide at the center. Atmosphere:
thin dust haze, quiet end-of-day stillness. No people, no text or signage
with readable writing, no clutter blocking the central floor, no low
ceilings, not night-time, not rain.
```
Result: submitted 2026-07-18 as the pipeline-shakedown run (operation
`cf3010f9-c7ff-4aa9-adf8-b50a16117dee`). Shakedown already caught one
pipeline bug before any tokens were spent: both generate scripts loaded
`.env` instead of `.env.local`, so the API keys were never picked up --
fixed in `scripts/marble-generate.mjs` + `scripts/tripo-generate.mjs`.
Visual verdict (headless desktop pass, screenshots in
`planning/reference/s1-hangar-qa/`): interior reads as a real hangar --
pitched steel roof trusses, panel walls, golden light pooling on the
left, red gear visible. TWO pipeline findings, both fixed globally:
(1) Marble splats+colliders arrive y-down (OpenCV convention) -> flip
applied in `sceneManager.ts` for all Marble scenes (placeholder splat
unaffected); (2) the generation camera sat by the hangar-door wall
facing it, so `spawnYawDeg: 180` was added to the manifest schema to
face visitors into the hangar. Still needs a human pass (Marble viewer
or headset): is the F-16 recognizable (smeary at spawn distance)? Is
the polder/windmill visible through the doors anywhere? If either
fails, run v2 (tarped F-16 variant).

If the F-16 comes out mangled (aircraft are hard to generate cleanly),
v2 pivots to: append "the F-16's fuselage partially covered by a fitted
canvas tarp" -- hides generation artifacts, adds mood. Keep the windmill
in-frame of the doorway in every iteration; it's the Easter-egg anchor
and the hero-moment composition depends on it being visible.

### v1 verdict -> v2 goes IMAGE-FIRST
v1 (walkthrough + Jeff review): believable hangar shell and aircraft,
BUT no windmill, the view out the doors is more-hangar-and-parking
instead of polder, aircraft read as silver prop planes / a Chinook-ish
transport rather than an F-16, and the generation camera sat low by the
door wall. v2 follows the 2D-first workflow (NEXT_STEPS): compose a 2D
pre-viz FROM the intended standing point (eye height 1.6m, F-16 nose
left, open doors framing polder + windmill center-right, golden light),
get Jeff's thumbs-up, then `--image` it into Marble with a short style
modifier. Keep v1's world live meanwhile.

## Final prompt used
v1, verbatim (2026-07-18).

## Marble export
- Operation ID: `cf3010f9-c7ff-4aa9-adf8-b50a16117dee`
- Exported to: `marble/scene.spz` + `marble/collider.glb`
- Notes on lighting/mood (keep consistent with sibling scenes in this
  World for portal continuity): signature light color = warm gold
  (late-afternoon sun), 3200K low sun vs cool interior fill. Portals
  glow gold-rimmed (toward S2) and green-rimmed (toward S5, the "full
  circle" loop-closer near the open doors).
