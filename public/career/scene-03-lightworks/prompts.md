# Lightworks

**Brief description:** A datacenter cathedral in three zones: server-repair
training bay, four-projector optical-computing gallery (bit-plane
decomposition reveals Jeff's own portrait), Even Realities frontier desk.
"Light that teaches, light that computes, light you can wear." Full
design: `docs/WORLD_DESIGNS.md` S5.

## Reference images
None for the room itself (kept generic/NDA-safe per the guardrail in
`docs/NEXT_STEPS.md` -- no real datacenter photos, invented hardware
layout). Reference images that feed PROPS inside this room, not the room
prompt:
- `planning/reference/cats/profileProjection.jpg` -- source for the
  bit-plane-decomposed reveal portrait (Zone 2) AND the Even Realities
  glasses frame shape (Zone 3 Tripo prop).
- `planning/reference/s5-lightworks/hud-captures/` -- 9 real Even
  Realities G2 simulator screens (Zone 3 HUD carousel content).

## Prompt iterations

### v1
```
Interior of a dark modern data center aisle, camera at standing eye height
in the center of a wide central walkway. Two long rows of tall black
server racks with dense green and occasional amber LED points, cool
white-blue overhead strip lighting, visible thin haze catching the light.
At the far end of the walkway, one large clean matte white wall section,
empty and evenly lit dimly, like a projection screen. Midway along one
side, a single rack stands under a focused warm spotlight with a work area
in front of it and space for a small cart. Near the entrance, a small
recessed alcove with a small wooden desk and warm amber lamp lighting,
contrasting with the cold room. Polished dark concrete floor, completely
flat and walkable, central walkway at least four meters wide and fifteen
meters long. Palette: black racks, emerald green LEDs, cold white-blue
light, one warm amber alcove. Atmosphere: deep server hum implied,
cathedral-like, slightly hazy. No people, no readable text or logos, no
cable mess on the floor, no ceiling clutter, not a hallway with doors,
not an office.
```
Result: (pending)

Iteration note: the empty white end-wall (Zone 2 projection target) and
the warm desk alcove (Zone 3) are the two load-bearing features -- if v1
drops either, v2 leads with them explicitly. Dark scenes are
splat-risky: if blacks come out muddy, v2 raises ambient to "dim
blue-grey" and darken in the renderer instead.

## Final prompt used
(fill in once generated)

## Marble export
- Operation ID:
- Exported to: `marble/scene.spz` + `marble/collider.glb`
- Notes on lighting/mood: signature light color = emerald green (rack
  LEDs, projector grids, HUD). 6500K cold datacenter + green emissive.
  The darkness experiment of the five -- budget slack for a v2. Portals:
  cyan-rimmed toward S3, gold-rimmed toward S1 (the loop closes: from
  light made of math back to sunlight on a polder).
