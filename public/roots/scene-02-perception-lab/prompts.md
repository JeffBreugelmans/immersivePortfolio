# The Perception Lab

**Brief description:** One research lab spanning Jeff's Master's (rubber
hand illusion, Eindhoven) and PhD (eye-tracker + data-glove accessibility
rig, Northeastern) -- two benches, one continuous story arc. Full
design: `docs/WORLD_DESIGNS.md` S2.

## Reference images
- `planning/reference/phd research/dataglove uncovered.jpg` -- labeled
  sensor diagram (finger flex, thumb pressure, wrist flex), used for the
  data-glove PROP generation (Tripo), not this room's Marble prompt.
- `planning/reference/phd research/tobii eyetracker.png` -- Tobii unit
  reference, same use (Tripo prop, not this room prompt).
- `planning/reference/phd research/minigame environment.png` -- real
  screenshot of the PhD Unity island (rope bridge, torii-style wooden
  arch, mossy hills). Reference for the mini-game's render-to-texture
  island asset (TECH_SPEC §G), not this room's Marble prompt.

None of the above are room-interior photos, so the Marble prompt below
is text-only.

## Prompt iterations

### v1
```
Interior of a cozy university human-factors research lab, camera at
standing eye height at the room's center. Late-afternoon sun enters through
venetian blinds on one wall, casting warm gold stripes across the floor;
overall interior light is neutral and soft. Two workbench stations: on the
left, a wooden desk with a low vertical partition screen standing on the
desktop and a chair pulled up to it; on the right, a desk with a large
computer monitor, a keyboard, and a desktop PC tower beneath. White walls
with a corkboard of pinned notes and diagrams, a tall bookshelf with
journals and a few small trophies, a whiteboard with faded sketches, a
potted plant, a small side table with a coffee machine. Palette: birch
wood, white walls, navy blue chair fabric, warm gold window light. Wooden
floor, completely clear and walkable in the center, at least six meters of
open space between the benches. Atmosphere: quiet, studious, end-of-day
calm, faint monitor glow on the right bench. No people, no readable text,
no clutter on the floor, no fluorescent glare, not a hospital, not a
classroom with rows of desks.
```
Result: (pending)

Iteration note: the two-bench layout is load-bearing -- if v1 merges
them, v2 splits with "on opposite walls." Both monitors/screens in the
splat will be replaced or overlaid by live props (rubber hand station,
mini-game monitor), so their baked content doesn't matter.

## Final prompt used
(fill in once generated)

## Marble export
- Operation ID:
- Exported to: `marble/scene.spz` + `marble/collider.glb`
- Notes on lighting/mood: signature light color = warm gold (same sun as
  S1, now through venetian blinds) + one Hue-lamp accent. 4000K neutral
  lab + 3200K window stripes. Portals: gold-rimmed toward S1, cyan-rimmed
  toward S3 (walking from monitor-based research VR into real VR).
