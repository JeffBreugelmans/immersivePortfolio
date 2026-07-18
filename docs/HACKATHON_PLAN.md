# Hackathon Master Plan (SIGGRAPH LA — Worlds in Action)

Status: **GENERATION UNDERWAY (2026-07-18): S1 Hangar v1 live at
jeffxr.com/worlds; 2D-first pre-viz adopted for v2 + remaining scenes —
see NEXT_STEPS "SESSION HANDOFF" for current state.**
Build progress: foundation systems (TECH_SPEC B, C.0, D, E-billboard,
debug overlay, speaking events) are implemented and smoke-tested — see
the tracker's DONE rows and NEXT_STEPS "Overnight build progress".
Companion tracker: `planning/asset-tracker.xlsx` (same content as
`planning/asset-tracker.csv`, which is the diffable source of truth).
This doc is the narrative plan; the tracker is the checklist.

## Team

| Member | Role | Where |
|---|---|---|
| Jeff | Lead — final say on scene rosters, prompts, placement, finishing touches | in the room |
| Cinematic World Builder | Scene concepts, generation prompts, interactions design, Easter eggs, style continuity | `.claude/agents/cinematic-world-builder.md` |
| XR Performance Engineer | Runtime systems, perf budgets desktop/mobile/Quest, Proxie avatar runtime, audio | `.claude/agents/xr-performance-engineer.md` |

Agent teammates are persistent repo agents — any Claude Code session on
this repo can invoke them by name (they register at session start).

## Locked decisions (from Jeff, 2026-07-18)

1. **Quality over quantity.** 3-5 flagship scenes instead of 9 thin ones.
2. **Magical, not sterile.** Every scene: a hero moment, at least one
   interactive toy beyond portals, Easter eggs. Fun > realism.
3. **Iterate cheap before spending.** Prompts get 2D pre-viz (Mint
   images) before any full world generation. Log iterations in each
   scene's `prompts.md`.
4. **Interaction palette:** click (all platforms), gaze-dwell effects
   (light up what you look at), hand-wave gestures in VR (lamp color
   change), pickup/wearable transitions (Vive headset → Second Studio;
   Even Realities glasses → green HUD), and the PhD mini-game station.
5. **JB Proxie becomes an embodied companion**: conversational (existing
   voice/TTS path), moves through the scene with the visitor, contextually
   aware (gaze system), pleasant — never a hovering shop assistant.
   Knowledge stays grounded in the avatar-chat RAG; guardrails: no
   politics, no current events, no off-topic.
6. **Jeff reviews before generation.** Tracker rows get his tick before
   tokens are spent. Jeff has final say on prop placement and finishing
   passes.

## Token pools

| Pool | Status | Use |
|---|---|---|
| Mint (12k) | live now | 2D pre-viz images, per-scene audio, rigged Proxie avatar candidate, prop/world overflow (worlds export .spz + collider — confirmed) |
| Marble | arriving | The flagship scene environments (splat + collider) |
| Tripo | arriving | Hero props needing precision (Vive headset, data glove, F-16…), rigged-avatar fallback |

## Scene roster (world builder's proposal — full detail in `docs/WORLD_DESIGNS.md`)

**9 scenes → 5 flagship scenes across 2 worlds.** Every cut/merge makes a
survivor richer. Awaiting Jeff's sign-off before any folder/manifest
restructuring or generation.

| Scene | What it is | Hero moment | Jeff's verbatim asks covered |
|---|---|---|---|
| **S1 — The Hangar on the Polder** (`roots`) | RNLAF hangar at golden hour, doors open onto a polder — canal, bike path, turning windmill. Dutch upbringing lives on the break table (hybrid building-kit model, klompen, stroopwafel). | F-16 nose silhouetted against the golden polder + windmill | F-16s, Chinooks, upbringing, windmill, lamp hand-wave |
| **S2 — The Perception Lab** (`roots`; merges TU/e + Northeastern) | One lab, two benches: Master's rubber-hand-illusion station (Proxie as subject!) + the PhD rig (monitor mini-game, black data glove, Tobii bar). RISE award on the shelf. | Stroke the fake hand with the brush → Proxie's hidden real hand twitches; tap it with the hammer → yelp | Rubber hand, PhD mini-game with real gaze/flex mechanics, award Easter egg |
| **S3 — The Holo Stage** (`career`) | AfterNow Prez as a dark theater: podium HoloLens, floating hologram "slides" incl. the Project Malta representation spectrum, gear wall of headsets. | Gaze at the HoloLens → the whole room performs (hologram bloom, rover orbit) | AfterNow/Prez, Malta folded in NDA-safely, Vive-on-shelf |
| **S4 — Second Studio: The Construct** (`career`) | You're INSIDE the Vive you picked up in S3 — 2016 wireframe void, frozen mid-session collaboration. Only reachable by "putting on" the headset. | Take the glowing sculpting tool from a frozen avatar's open hand → draw light ribbons | Second Studio, headset put-on transition, tool hand-off concept |
| **S5 — Lightworks** (`career`; merges datacenter + optical + glasses) | Datacenter cathedral, 3 zones: server-repair training bay, 4-projector optical-computing gallery, warm Even Realities alcove. | Flip the 4th projector → binary noise sums into an image made of light | Server repair sim, 4-projector binary grids, glasses try-on → green SIGGRAPH-guide HUD |

**Style bible:** one signature light color per scene (gold → gold →
cyan → cyan → green); portals glow in the *destination's* color, so
navigation is legible by color alone. The lighting arc "sunlight →
screenlight → lasers → light-you-wear" tells the biography by itself.

**Cats:** one per world plus a wireframe bonus cat in S4 and a
shadow-in-the-projector-beam cat in S5.

**Generation order (risk-first):** 2D pre-viz all five on Mint tonight →
Marble: S1 (pipeline shakedown) → S4 via Mint world (parallel, saves a
Marble credit) → S5 (darkness risk) → S2 → S3. Tripo queue leads with
hero-interaction blockers: data glove, Vive, G1 glasses, rubber-hand set.

**Open questions for Jeff** (blocking, consolidated in WORLD_DESIGNS §6):
entry scene (S1 vs S3), cat names/colors/photos, S5 reveal image
(portrait vs cats vs logo), Proxie yelp approval, NDA pass on S5
placards, reference photos for image-conditioning, Mint-world blessing
for S4.

## Interaction systems (engineer's spec — full detail in `docs/TECH_SPEC.md`)

Eight features, ordered by demo impact per engineering hour, all designed
as small IWSDK systems mirroring the existing portal/gaze patterns with a
single `prop-interaction` window event at the center. Everything degrades
gracefully to non-VR. Summary:

| # | Feature | Est. | One-liner |
|---|---|---|---|
| A | Backend teleport + companion prompt block | 0.5h | Paste-ready `system_prompt.txt` addition (in TECH_SPEC §A) enables `---TELEPORT:` + short spoken replies + guardrails. Marker must precede any `---LINKS---` block. |
| B | Interactable framework | 4h | `interaction: {click/gaze/wave/pickup}` per manifest prop; no per-scene code. Gaze reuses the existing gazeContext loop; wave = hand within 0.4m moving >0.6m/s; effects are cheap material tricks (glow/pulse/cycle-color/spin) — no lights. |
| C | Wearables + FadeSystem | 4.5h | Shared fade (DOM on desktop, camera-quad in XR — also polishes every portal jump). Vive headset click/bring-to-face → fade → Second Studio. Even Realities glasses → green monochrome HUD (CSS overlay desktop, head-locked CanvasTexture quad in XR) with SIGGRAPH schedule. |
| D | Audio manager | 3h | Ambient crossfade per scene + positional SFX pool, autoplay-safe unlock, ambient ducks −6dB while Proxie speaks. mp3 only; ≤2.5MB audio per scene. Mint audio is final-only → start generations FIRST tomorrow. |
| E | Proxie companion | 3h (+4h rigged) | See below. |
| F | Projector-grid station | 3h | 4 procedural binary grids summed in one fragment shader → 5 brightness steps; 4 clickable levers show light literally adding. ~11 draw calls, zero lights/textures. |
| G | PhD mini-game station | 10h, checkpointed | Render-to-texture monitor (512², 30Hz, hard pause conditions) playing a third-person island walk. Visitor's real gaze on the screen steers the camera; controller squeeze / hand pinch / W-key walks the character — re-enacting the actual PhD mechanics. Explicit engage mode suppresses WASD. Hour-5 checkpoint: flat-disc MVP ships regardless. |
| H | Perf + compat plan | — | Quest 3 budgets (72Hz, ≤150k prop tris, ≤80 draw calls, ≤1.5ms new JS), portal-splat prefetch (fetch-only), test matrix, 7 demo-day risks with mitigations. `?debug` FPS overlay gets built first (30 min). |

## Proxie companion design

Asset-agnostic companion: system drives an avatar adapter, so a billboard
sprite of the existing 2D avatar art ships day one and the rigged GLB
(Mint animation sets or Tripo auto-rig; ≤25k tris, idle/walk/talk clips)
hot-swaps in with zero rework — guaranteed demo fallback.

**Not-annoying rules (the numbers):** anchors 2.5-3m away at 30-45° off
view center; never inside 1.5m; sidesteps if he lingers in your center
view >1.5s; only approaches when you address him (chat/mic) or dwell ≥2s
on an interactive. No pathfinding — steering on the open ring around the
player, fade-repositions across scene swaps.

**Talking:** talk animation keys off the TTS speaking state (new
`proxie-speaking-started/ended` events in proxie-chat.js), double-keyed
on SSE stream activity because Quest TTS is unverified. He registers as
a gaze target, so "who are you?" answers itself through the existing
pipeline. Knowledge/guardrails live in the avatar-chat backend prompt
(TECH_SPEC §A): RAG-grounded only, no politics/current events/off-topic,
1-3 spoken sentences unless asked for depth.

## Review workflow (how we work tomorrow)

1. Jeff reviews this doc + tracker over coffee; ticks/edits rows.
2. 2D pre-viz pass on approved scene prompts (Mint, cheap) → thumbs
   up/down per look.
3. First Marble generation = highest-risk scene, to verify splat
   orientation once for all (`sceneManager.ts` flip line ready).
4. Parallel: Tripo hero props + Mint audio while Marble worlds cook.
5. Integration passes per scene: splat in → props placed (Jeff's numbers
   final) → interactions wired → placards written → audio in.
6. Continuous: commit small, keep `prompts.md` iteration logs honest,
   update tracker statuses so any session can resume cold.
