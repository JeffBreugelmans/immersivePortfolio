# Next Steps (hackathon working notes)

State of the branch as of the IWSDK migration commit, plus the agreed plan
for what comes next. Written as a handoff so any session (or teammate) can
pick up without archaeology. Delete sections as they get done.

## Where things stand

The A-Frame front end has been fully replaced with the official hackathon
template stack (IWSDK 0.2.2 + SparkJS 2.0 preview Gaussian splats + Vite 7
+ TS) -- see README "Stack" and `docs/ARCHITECTURE.md` for the module map.
Desktop-first controls, portals, scene swapping, loading UX, XR
entry/locomotion/grabbing plumbing, and the conversational Proxie layer
(gaze context + Web Speech push-to-talk + speechSynthesis replies) are
implemented and verified headless: typecheck, production build,
walk-into-portal teleport, anti-bounce, `window.teleportTo`, chat scene
lines, gaze context -- zero page errors.

**Not yet verified by a human:** voice input/output in a real browser
(headless can't exercise mic), real-headset behavior (Quest via Funnel),
and Marble splat orientation (needs the first real generated scene --
one-line flip ready in `sceneManager.ts` if worlds render upside-down).

## Content generation (token budgets)

Three token pools are available for the hackathon; strategy agreed with Jeff:

| Pool | Use for | How |
|---|---|---|
| World Labs Marble | The 9 scene environments | `node scripts/marble-generate.mjs --world <w> --scene <s> --prompt "..."` -> commits `scene.spz` + `collider.glb` per scene. Prompts live in each scene's `prompts.md`. |
| Tripo3D | Scene props; possibly the rigged Proxie avatar (Tripo also rigs/animates) | `node scripts/tripo-generate.mjs ...` -> `props/<id>.glb` + manifest snippet. |
| Mint (mint.gg, 12k tokens) | Rigged JB Proxie avatar, per-scene audio/ambience/SFX (nothing in the stack covers audio yet), cheap pre-Marble visual iteration, overflow generation | Via Mint MCP (`https://mcp.mint.gg/`) or the Mint web app. |

**ANSWERED (2026-07-18): Mint worlds DO export raw self-hostable files.**
The Mint public API's `GET /v1/worlds/{worldId}` returns an `assets` object
with `spzUrls` (map of downloadable `.spz` URIs), `colliderMeshUrl`,
`panoUrl`, `radUrl` (streaming/LOD splats), plus preview/thumbnail images
(see https://docs.mint.gg/api-reference/assets/get-a-generated-world). So
Mint output drops into the same `marble/scene.spz` + `collider.glb`
self-hosting pipeline — no iframe needed. Mint is a viable backup/overflow
environment generator, not just audio/avatar.

More Mint facts from docs.mint.gg (relevant to our queue):
- MCP endpoint: `https://mcp.mint.gg/mcp` (OAuth on connect). Generates
  3D Models, Worlds, Materials, Asset Packs, and Audio. Generation +
  preview revisions run automatically by default; ask for "review mode"
  to approve previews before spending on final generation.
- Audio is **final-only** in the MCP beta: start the asset, wait for
  final, fetch the file — fits feature queue item 3.
- Character animation: the MCP exposes curated **animation sets** (e.g.
  basic movement) that can be applied by set ID to an animation-ready 3D
  Model — directly relevant to the rigged Proxie avatar (queue item 1).
- Official pairing for coding agents: Mint Three.js Skills
  (`npx skills add mintdotgg/mint-threejs-skills`,
  https://github.com/mintdotgg/mint-threejs-skills).

Example world for reference/inspiration: https://play.mint.gg/impossible-places

## Cloud-session network access (RESOLVED 2026-07-18)

The allowlist works. Verified reachable from a fresh cloud session:
`mint.gg`, `mcp.mint.gg`, `docs.mint.gg`, `play.mint.gg`,
`sensaihack.notion.site`, `sensaihack.com`, `api.tripo3d.ai`,
`platform.tripo3d.ai`, `www.worldlabs.ai` — all HTTP 200.

## SensAI Notion page — key takeaways (read 2026-07-18)

The "How to Prepare — Learning Resources & Workshops" page
(https://sensaihack.notion.site/How-to-Prepare-Learning-Resources-Workshops-b29d7964cb7c826eb08281d8b95d1ec7)
is now readable. What matters for this project:

- **Official WebXR kit uses our exact stack** (SparkJS 2.0 + IWSDK):
  https://github.com/V4C38/sensai-webxr-worldmodels — worth diffing
  against our setup for reference patterns. There's a workshop recording
  ("Build World Model WebXR Experiences With SparkJS 2.0, LOD & IWSDK")
  and slides:
  https://docs.google.com/presentation/d/1aVbA-X7o1V7Ig1XgNLp6YCZHGV-mmzezIaWdNnlOQwU/
- **Collider authoring tools** (useful if Marble/Mint colliders need
  fixing): https://splat-collider-builder.netlify.app/ (draw collision
  volumes over any .spz, export .glb) and
  https://splat2mesh.netlify.app/tools/splat2mesh.html for complex meshes.
  SuperSplat is the recommended splat cleanup/editing tool.
- **Tripo guidance**: P Series = fast low-poly (real-time), H Series =
  high quality (up to 2M faces). Fully automatic rigging/skinning for
  humanoid AND non-humanoid characters, available via API — confirms
  Tripo as a Proxie-avatar option. Prompt tips: short + concrete, add
  "game ready", one object per prompt, use built-in retopology.
- **Marble outputs confirmed**: splats (.spz/.ply), .rad (streaming LOD
  for 1M+ splat scenes, supported by Spark), collider meshes, video.
  Downloadable from generated scenes via preview mode.
- **Coupon codes / credits** live on a Notion subpage ("Coupons &
  Credits") under the same parent — check there before buying anything.
- Recommended-versions list + pre-hack workshop recordings (World Models
  & 3DGS, Tripo/fal.ai, MCP, PICO, ReactVision, Volinga VFX) are all
  linked from the page.

## avatar-chat: companion mode prepared (2026-07-19)

Branch `claude/webxr-companion-prompt` on the avatar-chat repo carries
the backend side of the embodied companion: surface-gated WEBXR
COMPANION MODE in system_prompt.template.txt (2D chat page unaffected —
gating keys off the scene_context only /worlds sends), scene_context cap
200→600 in main.py (was truncating our gaze payload), and a defensive
teleport-marker strip in chat-block.html. To deploy: merge on the Spark,
copy the new section into the live gitignored system_prompt.txt (keep
the DYNAMICALLY ADDED KNOWLEDGE entries), restart jeff-avatar.service.
Cats fully resolved (2026-07-19): Pumpkin (orange tabby), Pepper (gray
tabby), Poppy (marbled orange/gray/white) — reference photos + casting
in `planning/reference/cats/`, tracker rows unblocked.

## Tracker review in progress (2026-07-19, live with Jeff)

Walking the 7 NEEDS-JEFF decision rows one at a time in chat. So far:
- **Entry scene: S1 Hangar** (chronological) — confirmed.
- **S5 reveal image: redesigned, not just picked.** Jeff proposed a real
  bit-plane decomposition (quantize a source image to 5 luminance levels,
  randomly split each cell's target level across 4 binary projector
  masks that sum back to the original) instead of the original
  decorative procedural-noise shader — see `docs/TECH_SPEC.md` §F
  (REVISED). Source image: his Even Realities G2/R1 review portrait,
  cropped to drop logo/text/product inset (busy elements don't survive
  5-level quantization; faces do). Resolved screen click opens
  `youtu.be/sEDTmvGg-QY`. **Source image received** (`planning/reference/cats/profileProjection.jpg`,
pushed by Jeff) and the bake mechanic is **validated**: prototype at
`scripts/prototypes/bake-projector-image-prototype.py` (Python/numpy,
stand-in for the eventual Node production script), preview renders in
`planning/reference/s5-lightworks/`. Resolution bumped from the initial
30x30 to **60x60** per Jeff's request for stronger likeness (tested
30/45/60/80 side by side — 60 was the recommended sweet spot, confirm on
next review pass if he wants 80 instead). Grid resolution costs nothing
performance-wise (whole texture is a few KB); the tradeoff is purely
aesthetic (finer = more photographic, coarser = closer to the real
installation's chunky individually-lit-panel look).
- **Proxie yelp beat: APPROVED** ("I love that comedy beat! definitely
  implement it") — build as speced in WORLD_DESIGNS S2(d)/TECH_SPEC, no
  mannequin-arm fallback needed.

4 decisions remain: S5 NDA pass, reference photos, S4 Mint-vs-Marble,
coupons check.

## Overnight build progress (2026-07-19, pre-review)

Foundation systems from TECH_SPEC are BUILT and verified headless (11/11
smoke checks green — `npm run smoke` against a served build; also
`npm run typecheck` + `npm run build` clean):

- Interactable framework (`src/interactions.ts`) — click/gaze/wave via
  manifest `interaction:{...}`; nothing uses it yet until props land.
- FadeSystem (`src/fade.ts`) — all teleports now fade through black.
- AudioManagerSystem (`src/audio.ts`) + `sfxLibrary` in manifest — inert
  until Mint audio files exist (missing files no-op by design).
- Proxie companion billboard (`src/companion.ts`) — he's in the world
  now, with the personal-space rules; rigged GLB swaps in later.
- Speaking/stream events in `proxie-chat.js`; `?debug` FPS overlay.

Still needs a REAL headset/browser pass: wave gesture, XR fade quad,
audio unlock in-session, TTS voices on Quest (all flagged in TECH_SPEC
§H risks). Known-benign console error "Locomotor not initialized" at
startup is a pre-existing IWSDK async race — see scripts/smoke-test.mjs
header; keep an eye on it in the first Quest session.

## Team + master plan (added overnight 2026-07-18)

Jeff approved a bigger push: 3-5 flagship scenes (quality over quantity),
rich interactions beyond portals, and an embodied Proxie companion. The
working plan now lives in `docs/HACKATHON_PLAN.md` with a reviewable
task/asset tracker in `planning/` — start there. Two persistent agent
teammates were added under `.claude/agents/` (cinematic-world-builder,
xr-performance-engineer); invoke them by name from any session on this
repo. The feature queue below predates that plan — HACKATHON_PLAN.md
supersedes it where they disagree.

## Feature queue (agreed, not yet built)

1. **Rigged JB Proxie companion avatar** (Mint or Tripo rigged GLB):
   persistent entity, `THREE.AnimationMixer` driving idle/walk/talk clips,
   follows near the player, talk animation synced to the TTS speaking
   state the chat overlay already tracks. Build once the asset exists.
2. **Generate the 9 real scenes** with Marble (prompts.md per scene),
   verify orientation on the first one, commit spz+collider per scene.
3. **Per-scene audio** (Mint): ambient loop per scene + portal/teleport
   SFX; needs a small audio manager (nothing exists yet).
4. **In-headset spatial chat panel** (stretch): IWSDK PanelUI/UIKitML port
   of the chat overlay so Proxie is usable inside VR, not just before
   entering. The 2D overlay remains the desktop path.
5. **`---TELEPORT:<sceneId>---` backend marker** (stretch, avatar-chat
   repo): frontend already parses it defensively -- see
   `docs/DEPLOYMENT.md` §7.

## Deploy reminders

- Spark needs Node >= 20.19 to build now (`docs/DEPLOYMENT.md` §0).
- Keep `.npmrc` (legacy-peer-deps) -- SparkJS peer range vs super-three r181.
- Localhost dev injects the IWER simulator, which captures WASD; test
  desktop controls via the LAN URL or a production build.
