# The Holo Stage

**Brief description:** AfterNow Prez as a dark presentation theater --
podium HoloLens, floating hologram exhibits (including Project Malta,
NDA-safely folded in as stage content), a gear wall of headsets through
the years including the Vive that's the door to S4. Full design:
`docs/WORLD_DESIGNS.md` S3.

## Reference images
None dedicated to the room itself. `planning/reference/secondstudio/htc
vive.png` is for the Vive PROP (Tripo), not this room's Marble prompt.
Site assets (CarCityLaser, MarsRover, DataVisualization, HandRaise
images; Prez trailer video) are candidates for hologram-panel content --
see WORLD_DESIGNS S3(h) open question.

## Prompt iterations

### v1
```
Interior of a sleek dark presentation studio, camera at standing eye height
facing a low circular stage platform at the room's center. Matte charcoal
walls and a matte black floor with a subtle reflective sheen. A single
volumetric cone of soft cyan-blue light falls on the stage from a high
rig; thin haze makes the light beam visible. On the stage, a slim dark
podium. Around the room's edge, low warm accent lighting along the base of
the walls; one long wall carries an empty display shelf unit with warm
spot lighting, museum-style. Palette: charcoal, matte black, cyan-blue key
light, small warm amber accents. The floor is flat, open, and walkable
everywhere, with the stage platform only ankle height. Atmosphere: quiet
anticipation, a theater before the show. No people, no chairs or audience
seating, no readable text, no bright ceiling lights, not an office, not a
cinema with rows of seats.
```
Result: (pending)

Iteration note: keep the shelf EMPTY in the splat -- Tripo headsets
(HoloLens 2, Vive, Quest) populate it afterward; baked headsets would be
mush at splat resolution and would fight the interactive ones.

## Final prompt used
(fill in once generated)

## Marble export
- Operation ID:
- Exported to: `marble/scene.spz` + `marble/collider.glb`
- Notes on lighting/mood: signature light color = cyan-blue hologram
  light, 5500K stage neutral. Lowest risk of the five (simple geometry,
  empty shelf) -- generate last. Portals: gold-rimmed toward S2,
  green-rimmed toward S5; the Vive on the gear wall is a disguised
  portal to S4 (TECH_SPEC C.1), not a ring.
