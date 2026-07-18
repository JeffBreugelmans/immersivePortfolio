# Second Studio: The Construct

**Brief description:** Inside the Vive you just put on in S3 -- a
mountaintop observation platform, matching Jeff's actual Second Studio
product (REDESIGNED 2026-07-19 from an earlier invented abstract-void
concept once real footage was shared). Hero moment: walk around a
human-scale (1.8m) skyscraper sculpture. Full design:
`docs/WORLD_DESIGNS.md` S4.

## Reference images
- `planning/reference/secondstudio/environment with 3D assets.png` --
  real Second Studio footage: mountain-vista platform, colorful low-poly
  furniture mid-sculpt, floating reference-photo panels, "Save Scene"
  panel. THE reason this scene's design changed from an abstract void to
  a real mountain vista. Strong reference -- consider image-led
  generation (crop out the on-screen UI/play-button chrome first).
- `planning/reference/secondstudio/htc vive.png` -- for the Vive PROP
  (both the S3 door and this scene's exit), not the room itself.

## Prompt iterations

### v1
```
A modern minimalist observation platform floating high above a dramatic
snow-capped mountain range, camera at standing eye height near the
platform's center. Endless jagged peaks stretch to the horizon under a
bright daytime sky, soft clouds drifting in the valleys far below. The
platform is a simple pale circular deck with a low glass guardrail at the
edge, open to the sky and mountains on all sides -- no walls, no roof. A
plain wooden work table with two simple modern chairs sits to one side,
unoccupied. The deck is clean, minimal, and flat, walkable in every
direction, at least eight meters across. Palette: pale platform grey, warm
wood table, crisp white clouds, cool blue-grey mountain rock, bright open
sky. Atmosphere: high-altitude clarity, thin drifting mist at the platform
edge, quiet vastness. No people, no readable text or logos, no furniture
beyond the one table and two chairs, not indoors, not nighttime, not a
city skyline.
```
Result: (pending)

Iteration note: this is now photoreal Marble territory (RESOLVED --
was an open Mint-vs-Marble question when the scene was an abstract
void; a mountain vista is squarely Marble's strength). If a v2 is
needed, try cropping `environment with 3D assets.png` to just the
sky/mountain/platform (no UI chrome) and running it as an image prompt
instead of text-only.

## Final prompt used
(fill in once generated)

## Marble export
- Operation ID:
- Exported to: `marble/scene.spz` + `marble/collider.glb`
- Notes on lighting/mood: signature light color = cyan-blue (inherited
  from S3 -- same era) with bright open daylight now that it's a real
  place, not an abstract void. Low risk, simple geometry -- generate
  after S1/S5.
