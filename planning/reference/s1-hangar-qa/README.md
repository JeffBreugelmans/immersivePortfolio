# S1 Hangar — first-generation QA screenshots (2026-07-18)

Headless desktop captures from the pipeline-shakedown run (world
`96d1714c-d58d-4bb4-8800-33c6b22cfdd6`, see the scene's `prompts.md`).
Taken with `node scripts/screenshot.mjs --gpu` against a served
production build.

1. **1-preflip-floor-only.png** — the bug: Marble splats arrive y-down
   (OpenCV convention). Only the floor was visible; everything else hung
   below the world. Diagnosed from the collider mesh (all geometry at
   y -6.6..+0.8).
2. **2-postflip-spawn-view.png** — after the global flip in
   `sceneManager.ts` + `spawnYawDeg: 180`: spawn view into the hangar.
   Roof trusses, golden light, red gear on the left. The smeary shapes
   lower-left are probably the aircraft — needs an in-viewer/headset
   eyeball to judge whether v1 keeps or a v2 prompt iteration is needed.
3. **3-postflip-door-wall-behind-you.png** — what's now BEHIND the
   visitor: the hangar-door wall the generation camera sat next to,
   with a view window onto more floor + tool chest.
4. **4-walked-through-portal-placeholder-fallback.png** — walked forward
   2.5s: went through the Lightworks portal, teleported, landed in the
   placeholder splat (upright — non-generated scenes correctly skip the
   Marble flip). Proves splat -> portal -> teleport -> fallback end to end.

## Round 2 (post Jeff's review: scale/height/quality fixes)

5. **5-fixed-spawn-human-height.png** — envScale 1.75 + collider ground
   snap + full-res splat: standing ON the floor at human eye height,
   aircraft towering, hangar reads big. Size/height fixed.
6. **6-deep-walk-splat-smear.png** — the catch: ~4m into the hangar,
   looking around, the splat collapses into smears. Content far off the
   generation camera's viewpoint is unconstrained — inherent to
   single-view splat generation, full-res does not fix it.
7. **7-deep-walk-roof-lookup.png** — 8m deep looking up: roof structure
   holds up better than mid-space content at the same distance.

Takeaway: there is a "sweet zone" of a few meters around the spawn
where everything looks great; deep exploration degrades. Options:
choreograph scenes around the sweet zone (design content to be viewed
from near spawn), and/or try `marble-1.1-plus` (the larger-scene model)
for a regen. Live-site note: over Tailscale Funnel the world becomes
interactive at ~35-60s (500k splat ~25s + collider ~20s); the full-res
upgrade arrives in the background at ~2min without blocking.

Open observations for the finishing pass:
- Portal rings sit on a 2.5m circle around the spawn; in S1 the
  Lightworks ring is dead-center in the hero view and trivially easy to
  walk through by accident. Portal placement per scene is a
  Jeff-finishing-pass item anyway.
- Desktop eye height reads slightly tall vs. the door window (collider
  floor sits ~0.4-0.8m below y=0). Judge in headset before tuning.
