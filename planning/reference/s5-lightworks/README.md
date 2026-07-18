# S5 Lightworks — reference material

Two independent things live here: the projector-grid reveal image
(Zone 2) and the Even Realities HUD carousel content (Zone 3).

## Zone 2 — projector-grid reveal (bit-plane decomposition)

Validates the design in `docs/TECH_SPEC.md` §F before committing to the
production Node bake script.

| File | What it is |
|---|---|
| `bake-progression-preview.jpg` | 0/1/2/3/4-projector progression at 30x30 grid, sourced from `planning/reference/cats/profileProjection.jpg` (Jeff's Even Realities G2/R1 portrait) — shows noise resolving into the reconstructed face. |
| `bake-compare-preview.jpg` | Source portrait vs. full (4-projector) reconstruction, side by side. |

`scripts/prototypes/bake-projector-image-prototype.py` is the Python
proof-of-concept this render came from (numpy + Pillow). The production
script (`scripts/bake-projector-image.mjs`, Node — matching
`marble-generate.mjs`/`tripo-generate.mjs` conventions, no new runtime
dependency) should follow the same algorithm:

1. Load source image, resize to an 80x80 grid (RESOLVED 2026-07-19 —
   contrast-boost ~1.35x helps a soft-lit portrait keep structure at
   only 5 luminance levels).
2. Quantize luminance to 5 levels (0-4).
3. For each cell with target level N, randomly choose N of 4 channels to
   be "on" (seeded RNG for reproducibility).
4. Pack into one RGBA8 PNG: R/G/B/A = projector 0/1/2/3's bit.
5. Upscale with NEAREST filtering at render time (crisp blocks, not blur).

Status: validated, resolution confirmed at 80x80.

## Zone 3 — Even Realities HUD carousel (`hud-captures/`)

9 real screenshots from Jeff's Even Realities G2 simulator running his
actual SIGGRAPH 2026 guide app — transparent PNG, `576x288` (2:1),
8-17KB each. RECEIVED 2026-07-19, final art (no generation needed).
Numeric prefixes give the canonical paging order (see `docs/TECH_SPEC.md`
§C.2 for the carousel/click-third-paging design):

| File | Screen |
|---|---|
| `0_loading.png` | Title/splash — SIGGRAPH 2026 wordmark, byline |
| `1_welcome.png` | Welcome / main menu (Starred, Sessions, Expo, Speakers) |
| `2_starred.png` | Starred items list |
| `3_sessions.png` | Sessions list |
| `4_session_detail.png` | Single session detail view |
| `5_speakers.png` | Speakers list |
| `6_speaker_detail.png` | Single speaker detail view |
| `7_expo.png` | Expo / exhibitors list |
| `8_expo_detail.png` | Single exhibitor detail view |

Status: content resolved and committed. Glasses GLB prop itself still
pending Tripo generation — `planning/reference/cats/profileProjection.jpg`
(Jeff wearing the real G2 frames) is the image-conditioning source for
frame shape/color; see the tracker's "Even Realities G2 glasses" row.
