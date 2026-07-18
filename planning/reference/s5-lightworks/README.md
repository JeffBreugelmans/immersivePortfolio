# S5 Lightworks — projector-grid reveal reference

Validates the bit-plane decomposition design in `docs/TECH_SPEC.md` §F
before committing to the production Node bake script.

| File | What it is |
|---|---|
| `bake-progression-preview.jpg` | 0/1/2/3/4-projector progression at 30x30 grid, sourced from `planning/reference/cats/profileProjection.jpg` (Jeff's Even Realities G2/R1 portrait) — shows noise resolving into the reconstructed face. |
| `bake-compare-preview.jpg` | Source portrait vs. full (4-projector) reconstruction, side by side. |

`scripts/prototypes/bake-projector-image-prototype.py` is the Python
proof-of-concept this render came from (numpy + Pillow). The production
script (`scripts/bake-projector-image.mjs`, Node — matching
`marble-generate.mjs`/`tripo-generate.mjs` conventions, no new runtime
dependency) should follow the same algorithm:

1. Load source image, resize to a square grid (default 30x30 — tune per
   image; contrast-boost ~1.35x helps a soft-lit portrait keep structure
   at only 5 luminance levels).
2. Quantize luminance to 5 levels (0-4).
3. For each cell with target level N, randomly choose N of 4 channels to
   be "on" (seeded RNG for reproducibility).
4. Pack into one RGBA8 PNG: R/G/B/A = projector 0/1/2/3's bit.
5. Upscale with NEAREST filtering at render time (crisp blocks, not blur).

Status: validated, resolution (30x30) pending Jeff's confirmation.
