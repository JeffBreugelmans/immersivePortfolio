# Hackathon Master Plan (SIGGRAPH LA — Worlds in Action)

Status: **DRAFT for Jeff's morning review — nothing generated yet.**
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

## Scene roster

_To be filled from the world builder's draft after Jeff's review — see
"Proposed roster" in the design section below._

## Interaction systems

_To be filled from the engineer's spec — build order, contracts, budgets._

## Proxie companion design

_To be filled from the engineer's spec + world builder's placard texts._

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
