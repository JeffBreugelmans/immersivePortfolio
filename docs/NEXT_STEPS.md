# Next Steps (hackathon working notes)

State of the branch as of the IWSDK migration commit, plus the agreed plan
for what comes next. Written as a handoff so any session (or teammate) can
pick up without archaeology. Delete sections as they get done.

## POST-JUDGING WRAP (2026-07-19) -- read this first

Hackathon judging is DONE. The experience was demoed web-only (desktop
browser); the Quest headset path was not used for judging. Everything is
committed to `main` and deployed to the Spark
(https://dgxspark.tail8341fc.ts.net/worlds). Jeff intends to keep
iterating on this repo later.

**All five worlds are built, dressed, and hand-placed:** S1 Hangar (F-16
+ service props), S2 Perception Lab (rubber hand + brush + hammer flinch
beat, data glove/Tobii/lamp display row), S3 Holo Stage (gear-wall
headsets HoloLens/Vive/Quest, Prez video, Vive wearable-teleport to S4),
S4 Second Studio (real footage video screen), S5 Lightworks (self-running
bit-plane projector portrait). Full Mint audio kit (ambients + SFX).
Rigged JB Proxie companion with calm idle; billboard 2D fallback.

**Editor workflow that made this possible:** open any scene with
`?edit&scene=<0-4>`. Left-click selects, 1/2/3 = move/rotate/scale gizmo,
right-drag looks, `[`/`]` rotates the whole splat env. "Copy props JSON"
exports `{ scene, envYawDeg, props }` -- floor-relative y, snapToGround
aware. Paste it and it gets applied to `src/manifest.js`.

**Key architecture gotcha (bit us repeatedly):** props live in the
UNROTATED world root; the splat env is a separate entity rotated by
`envYawDeg`. So rotating the env in `?edit` spins the splat UNDER the
props -- you then re-place props against the new wall positions. Global
coords, not splat-relative.

### KNOWN ISSUES / where to resume

1. **Billboard placards+videos (JUST FIXED, unverified in a real
   browser):** placards/videos are meant to yaw-face the visitor so
   their rotation never matters. First attempt used an ECS System setting
   object3D.rotation -- IWSDK re-syncs each entity's Transform onto its
   object3D every update, silently overwriting it (Jeff at judging:
   placards "always at 45 degrees"). Refixed in `src/billboard.ts` via
   `attachBillboard()` = an `onBeforeRender` hook that runs at draw time,
   after the transform sync, once per camera (XR-correct per-eye).
   FIRST THING NEXT SESSION: load the deployed site, walk around a
   placard, confirm it faces you. NOTE the headless screenshot tool
   can't verify this -- it only rotates the view from a fixed spawn
   point, so the camera never moves relative to the placard.
2. **Quest Enter-VR:** the hard-freeze was fixed (canvas resize was
   firing during the Enter-VR handshake and hanging Quest Browser; now
   locked from the button click in `index.ts`). It then just "loads for
   a while" -- splat + props streaming/decoding over venue wifi, not a
   hang. Untested to completion in-headset. If slow, add an in-VR
   loading state and/or defer non-essential props until the splat renders.
3. **Proxie look:** Jeff not fully sold on the rigged avatar's texture
   ("grid finish"). Calm idle (catalog Idle 3) already deployed. Optional
   regen ~600 Mint credits; `?proxie=billboard` forces the 2D art.
4. **Scene-label overlay** shows the wrong scene title when loading via
   `?scene=`/defaultSceneId direct-load (cosmetic; correct via normal
   portal nav). Low priority.

### Deploy loop (unchanged)
push `main` -> on Spark: `git pull` + `source ~/.nvm/nvm.sh && npx vite
build`. No service restart (index.html is no-cache; hashed bundles bust
themselves). scp new gitignored `scene-fullres.spz` into the Spark's
`public/.../marble/` before building. Access the Spark funnel URL
directly, NOT jeffxr.com (Cloudflare caches the redirect). `?x=N` forces
a fresh index.html. Local QA: `SMOKE_GL=real` for the deterministic
11/11 smoke run; SwiftShader default flakes ~2 checks harmlessly.

### Credits left (2026-07-19)
Mint ~3,500 · Tripo API ~5k · Marble/World Labs 42k pool barely touched.
Two demo BGM tracks generated into Jeff's Downloads (warm-piano,
ambient-tech) for the video edit.

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

- **80x80 grid resolution confirmed** for the bit-plane bake (tested
  30/45/60/80 side by side, plus proved each of the 4 individual
  projector layers is genuinely uncorrelated noise on its own, and that
  the incremental tap-one-at-a-time reveal already matches the existing
  lever interaction design — no new plumbing needed).
- **S5 Even Realities design refined twice** from Jeff's material:
  1. Reference render: glasses rest on a **desk with a warm lamp** (not
     a shelf), gaze-glow affordance draws the eye, single head-locked
     HUD panel confirmed (matches real G2 binocular fusion).
  2. **Real simulator captures**: Jeff supplied 5 actual screenshots
     from the Even Realities G2 simulator running his real SIGGRAPH 2026
     guide app (transparent PNG) — title, welcome menu, starred items,
     sessions list, session detail. HUD is now a **carousel** through
     these real captures (click left/right third of the panel to page —
     reuses the mini-game's screen-third click pattern, no swipe-gesture
     plumbing needed) instead of a single static composed image.
     Transparency is a free win: the S5 alcove shows through around the
     green UI, like a real see-through HUD.
  `docs/WORLD_DESIGNS.md` and `docs/TECH_SPEC.md` §C.2 updated
  throughout (also fixed stale "G1" -> "G2" references). **RECEIVED**:
  all **9** real simulator captures landed in
  `planning/reference/s5-lightworks/hud-captures/` (Jeff's actual app —
  richer than the 5 originally discussed: adds speakers list/detail and
  expo list/detail). Carousel design updated to page through all 9 via
  their numeric filename order. Tracker row flipped to READY. Reference
  render for the projector-wall portrait also received earlier
  (`planning/reference/cats/profileProjection.jpg`).

**Tooling note**: lost `scripts/build_tracker.py` (the scratchpad
generator, never committed) to a self-truncating write-then-read bug —
`open(f,'w').write(open(f).read())` truncates before the read executes.
Tracker rows are now hand-patched directly via targeted CSV/openpyxl
edits, which is safe but slower for bulk changes; rebuild the generator
if another big restructuring is needed. `recalc.py` on the xlsx has
timed out 3x in this environment (LibreOffice cold-start cost) — not
blocking since Excel/Sheets recalculate on open, but the Summary sheet's
cached COUNTIF values may show stale in a raw preview until then.

- **S5 NDA pass: APPROVED with one fix.** "Million-dollar hardware"
  dramatic license approved as-is. The "sum wall" placard was factually
  wrong ("bypasses the network entirely") — Jeff corrected the real
  mechanism: it skips sequential collect-and-sum, computing the sum in
  one parallel step. Placard text fixed in WORLD_DESIGNS to match.
  **GUARDRAIL**: Jeff mentioned the optical all-reduce work has a paper
  accepted to Nature Communications, release date unknown — this is
  *not* on his public site and he flagged it as still NDA-adjacent.
  **Do not put this in any in-game text, placard, or public-facing
  content** — site and placards stay at "papers pending," matching what
  jeffxr.com/work/msr already says. Noted here only as an internal
  planning guardrail.

## All 7 tracker decisions resolved (2026-07-19)

Final three closed out together:

- **Reference photos received**: data-glove sensor diagram (labeled,
  unlocks real mechanics beyond gaze+flex — see below), Tobii tracker,
  a real screenshot of the PhD Unity island (rope bridge, torii-style
  arch, mossy hills — now the mini-game island's visual reference),
  a clean HTC Vive product shot, and **real Second Studio footage**
  that triggered a redesign (next point).
- **S4 REDESIGNED, which resolves the Mint-vs-Marble question**: the
  real Second Studio ran on a mountain-vista floating platform, not an
  abstract void — the design (`docs/WORLD_DESIGNS.md` S4) now matches
  that reality. Full tool-grab/spline-drawing mechanic judged too much
  scope for one of five scenes; hero interaction simplified to walking
  around a static human-scale (1.8m) skyscraper sculpture. Photoreal
  mountain vista is Marble's strength — **S4 world-gen path: Marble**,
  resolved. Cut from scope (stretch-only): sculpting tool, two
  collaborator avatars, ring palette, the "11312" code panel, spline-
  ribbon drawing system. Exit mechanic (grab Vive to take headset off)
  unchanged.
- **Mini-game scope CONFIRMED simple**: gaze-thirds steering + hand-flex/
  click-forward only, exactly as speced — station lives inside S2, not a
  separate scene (double-checked, confirmed). Thumb (jump/throw) and
  wrist (camera-mode toggle) sensors from the real glove are OUT of
  scope, stretch-only. New confirmed detail: the glove PROP animates
  (2-pose finger curl) synced to the same input driving the walk speed,
  on both VR and desktop — the desk prop visibly performs the action.
  Optional stretch: a pinch-poppable glowing nub on the thumb pad,
  hand-tracking only, purely decorative.
- **Token pools all confirmed**: Mint 12k, **Marble (World Labs) 42k**
  (was the "coupons/credits" open item — resolved by having real
  numbers), Tripo3D one month Pro (verification pending — see below).
  Comfortably clear of the full 5-Marble-world + Tripo-queue + Mint-audio
  budget.

**Tracker status: 0 NEEDS JEFF rows remaining** (96 total: 14 DONE, 57
REVIEW, 7 CUT, 2 READY, 16 TODO). Generation can start.

### Tripo Pro verification (open, needs Jeff)

Jeff has a free month of Tripo Pro and asked for API verification. I
don't have his `TRIPO3D_API_KEY` in this cloud session (`.env.local` is
gitignored and this session is a separate sandbox, not his laptop/Spark)
and Tripo's public docs don't surface a dedicated
account/balance/subscription-tier endpoint — so there's no safe way to
verify from here without him pasting a secret into chat, which isn't
advisable. Two safer options for Jeff:
1. Check https://platform.tripo3d.ai account/billing page directly (most
   reliable for confirming plan tier).
2. Run a real test generation locally: add the key to `.env.local`
   (never commit it) on whichever machine will run the scripts, then
   `node scripts/tripo-generate.mjs --world education --scene
   scene-02-tu-eindhoven --prop-id test --prompt "a plain wooden block,
   game ready"` — a successful task response confirms the key works end
   to end, which matters more for the hackathon than the plan-tier label.

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

## First world GENERATED + pipeline shakedown done (2026-07-18, laptop)

S1 Hangar is real: `public/roots/scene-01-hangar-polder/marble/`
(scene.spz 7.5MB + collider.glb 5.5MB, world
`96d1714c-d58d-4bb4-8800-33c6b22cfdd6`). Shakedown findings, all fixed:

- **dotenv bug**: both generate scripts loaded `.env` not `.env.local`;
  keys were never picked up. Fixed in both scripts.
- **Marble orientation CONFIRMED y-down** (the flagged unknown): flip
  now applied globally in `sceneManager.ts` to Marble splats AND
  colliders; placeholder splat stays unflipped. Diagnosed via collider
  bbox, verified via headless screenshots
  (`planning/reference/s1-hangar-qa/`, README there has the findings).
- **New manifest field `spawnYawDeg`** (optional, per scene): S1's
  generation camera sat by the door wall, so S1 spawns facing 180 into
  the hangar. DesktopControlsSystem syncs to it on scene-changed.
- **New tooling**: `scripts/serve-dist.mjs` (http static server --
  vite preview's mkcert pops a UAC dialog on Windows, useless headless)
  and `scripts/screenshot.mjs` (headless render checks: `--gpu`,
  `--look <deg>`, `--walk <ms>`, `--scene <id>`). Smoke suite runs on
  Windows via `CHROME_PATH` pointed at Edge; 11/11 green post-change.
- **End-to-end verified desktop**: real splat renders -> walk into
  portal -> fade teleport -> placeholder fallback scene renders upright.

**Needs Jeff**: (1) eyeball the world in the Marble viewer (link in
scene metadata.json) or headset -- F-16 recognizable? windmill visible?
else v2 prompt; (2) run `bash scripts/deploy-companion-mode.sh` on the
Spark (merges avatar-chat companion branch, fixes its teleport list to
the 5-scene roster -- the branch predates the restructure -- patches
live system_prompt.txt with backup, restarts jeff-avatar.service; my
session's permission layer blocks ssh writes to those files); (3) decide
what `public/afternow/scene-01-holographic-studio/props/AfterNowCustomEnvt.glb`
(9.1MB, untracked, sitting in the OLD scene tree) is destined for -- a
prop for S3 Holo Stage presumably; move it to
`public/career/scene-01-holo-stage/props/` + add a manifest entry.

## 2D-first generation workflow (ADOPTED 2026-07-18, after S1 v1 review)

S1 v1 taught us: text-only prompts produce roughly-right rooms with
wrong details (no windmill, "polder" turned into more hangar), and splat
quality only holds in a few-meter sweet zone around the generation
camera. Plan decision #3 (pre-viz before spending) is now the hard rule,
with a composition insight that makes it more than a style check:

**The pre-viz image's viewpoint BECOMES the world's sweet spot.** Marble
anchors generation on the input image, the generation camera lands at
the image's viewpoint, and our walk box + spawn now sit exactly there.
So compose every pre-viz as *the literal view from inside the roped-off
area*:
1. Camera at standing eye height (~1.6m) -- v1's camera was low+odd,
   which is where the floating/wrong-height feel came from.
2. ALL hero content in one frame at correct scale (S1: F-16 nose one
   side, open doors framing polder + windmill, golden light).
3. Content the visitor should get close to belongs near the camera.

Flow per scene: 2D image (Mint gen or real reference photo -- photos
beat renders when clean, see PROJECT_BRIEF rule of thumb) -> Jeff
thumbs-up -> `node scripts/marble-generate.mjs --image <approved.png>`
with a SHORT style modifier -> integrate. Iterations on the image are
cheap; Marble credits only burn after sign-off. Drop approved images in
each scene's `reference/` folder.

Mint MCP note: needs OAuth, which this laptop session can't complete --
generate images in the Mint web app (12k tokens available), or connect
the MCP in a fresh session and ask for "review mode".

## SESSION HANDOFF (2026-07-18 END OF BUILD DAY) -- start here

**ALL FIVE WORLDS ARE LIVE** at https://dgxspark.tail8341fc.ts.net/worlds
(spark serves latest main; avatar-chat companion mode IS deployed and
chat-driven teleports verified by Jeff in the browser).

Per-scene state:
- **S1 Hangar** -- v2 splat (empty hangar from Jeff's ChatGPT plate,
  Chinook baked outside), F-16 (display scale 7.8) + 5 Mint service
  props placed by Jeff via `?edit`; his layout is final in manifest.
- **S2 Perception Lab** -- splat live (envScale 2.5); Jeff's Tripo
  rubber hand / paintbrush / reflex hammer rough-placed on the left
  bench (needs his `?edit` polish). Still to generate: data glove
  (image-conditioned), Tobii bar, smart lamp.
- **S3 Holo Stage** -- splat live (2.76); Jeff's Tripo HTC Vive on the
  museum shelf = first **wearable-teleport**. UPGRADED 2026-07-19 (cloud
  session, `src/wearableFx.ts`, see below): click now plays a real
  don animation -- lifts off the shelf, flips 180, flies to just above
  your head, slides down onto your eyes -- THEN fades to S4. Returning
  through S4's ring portal plays the reverse (doff) back onto the shelf.
- **S4 Construct** -- prompt-only splat live (0.43 -- Marble
  OVER-scaled this one). Jeff made an image-conditioned v2 on his
  Marble WEB account (world f4482364-e691-4e0e-acba-e2ce3274bffc) but
  that login is a DIFFERENT account than the laptop API key -- needs a
  key from that account (`MARBLE_API_KEY_WEB` in .env.local) to fetch.
  Jeff lukewarm on v2; v1 is shippable.
- **S5 Lightworks** -- splat live (2.5); white projection end-wall came
  out as speced for the T083/84 projector reveal.
- **Audio** -- Mint kit fully wired: 5 scene ambients + real
  portal-whoosh + chinook-whomp / lamp-click / hologram-bloom /
  vive-don in `sfxLibrary` (~330 credits; ~4.1k Mint remains).
- **JB Proxie** -- rigged Mint avatar (8 clips) drives the companion,
  grounded to the raycast floor, calmed idle (0.45x timeScale + facing
  hysteresis). Jeff still not sold on the 3D look; `?proxie=billboard`
  forces his 2D art. DECISION OPEN -- billboard default is the safe
  judging call.

Workflows added today (use these, don't re-derive):
- `?edit` visual editor: click prop -> gizmo (1/2/3 modes, scale is
  clamped), right-drag look, `[`/`]` rotates the whole env (bake angle
  as `envYawDeg`), "Copy props JSON" -> paste over the scene's `props:`.
- Marble scale: probe collider floor at origin, `envScale = 1.6/|floorY|`
  (S2 2.5, S3 2.76, S4 0.43, S5 2.5). Spawn ray casts from y=0 (origin
  is the generation camera INSIDE the room) -- do not regress.
- Bench props: authored y is height above whatever the ground ray hits
  under the prop (desks are in the collider) -- use tiny y (~0.03).
- Cache: index.html is no-cache (worlds_static.py patched ON THE SPARK
  -- that file's fix is NOT in this repo, don't clobber the deployed
  copy), splat URLs carry `?v=` -- bump per regen.
- Big Tripo HD exports: `npx @gltf-transform/cli optimize in.glb
  out.glb --texture-size 1024 --compress draco` (hammer 68MB -> 2.6MB);
  shared loader already decodes Draco.
- Tripo API wallet is EMPTY (separate from Jeff's web Pro credits).
  Props come from Jeff's Tripo web studio -> GLB into the scene's
  `props/` folder or `planning/reference/`.

Next moves, in order:
1. Jeff's `?edit` polish of S2/S3 prop placement; remaining S2 props
   from his Tripo studio.
2. Interaction beats: rubber-hand stroke -> Proxie twitch, hammer tap ->
   `companion-flinch` (hook exists) + yelp SFX (still to generate);
   S5 projector bake script (T084) + ProjectorGridSystem (T083).
3. S3 shelf headsets (HoloLens 2, Quest 3) + Prez slide panels (site
   assets, zero cost).
4. Quest 3 pass on the deployed URL (T093) -- NOTHING verified in a
   real headset yet: TTS voices, audio unlock, frame budget, XR fade
   quad, wave gestures.
5. Proxie look decision; optional in-VR voice input (Quest lacks
   SpeechRecognition; DOM overlay invisible in-session -- would need
   push-to-talk MediaRecorder -> STT endpoint on the Spark).

Deploy after each green run: push main -> spark `git pull` +
`source ~/.nvm/nvm.sh && npx vite build` (no service restart needed).
scp any new gitignored `scene-fullres.spz` into the matching spark
`public/.../marble/` folder before building. jeff-worlds.service is a
SYSTEM unit: restarts need Jeff's sudo, and Restart=on-failure means a
clean kill does NOT respawn it.

## SESSION UPDATE (2026-07-19, cloud session) -- Vive don/doff shipped

Implemented `docs/PLAN-wearable-fx.md` in full on `claude/wearable-fx`
(not merged to main -- Jeff's call on when/whether to merge + deploy):

- `src/sceneManager.ts`: exports `livePropObjects` (propId -> live
  object3D), populated in `spawnProp`, cleared on scene teardown. The
  generic `teleportTo` click listener now skips props with
  `wearable: true` so the new system owns their full click-to-teleport
  flow instead of the old flat 500ms delay.
- `src/wearableFx.ts` (new): `WearableFxSystem`, registered in
  `src/index.ts` right after `CompanionSystem`. Manual phase/lerp state
  machine (no tween lib, same pattern as CompanionSystem's steering),
  driven entirely off world-space camera transforms
  (`world.camera.getWorldPosition/getWorldDirection`) so it's correct
  regardless of where the visitor is standing, desktop or XR:
  - **Don** (click the Vive): lift off shelf + yaw 180 (0.45s) ->
    fly to camera pos + 0.45m up (0.6s) -> slide down onto the exact
    eye position (0.35s) -> `window.teleportTo()` fires (fade covers
    the cut).
  - **Doff** (arriving back at a scene whose wearable prop's
    `teleportTo` matches the scene just left): snaps onto the eyes the
    instant the scene appears, then reverse-plays the same three beats
    (0.35 + 0.5 + 0.35s) back onto the shelf, restoring the exact
    authored shelf pose at the end (captured live off the fresh spawn,
    not hardcoded).
- Verified: `npx tsc --noEmit` clean, `npx vite build` clean, 11-check
  smoke test run twice against this build AND against the pre-change
  baseline for comparison -- 9/11 pass both times; the 2 failures
  ("faded teleport", "companion state machine") reproduce identically
  on baseline with zero code changes, confirming they're a pre-existing
  swiftshader/headless timing flake, not something this change broke.
  No new console/page errors either run.

**Still needs Jeff's eyes** (explicitly flagged in the plan doc as hard
to verify headless): the actual don/doff motion has never been watched
in a real browser. Load `?scene=2` (Holo Stage) locally, click the Vive,
watch the lift/fly/slide-down read as intended, then walk back through
S4's return portal and watch the reverse. Desktop and Quest share the
exact same camera-pose code path, but the near-plane clip feel of the
headset sliding onto the eyes should get a separate look on-device --
it may want a touch more/less lead distance on the final "place" phase
depending on how it feels through the headset's own near clip plane.

Not touched (left for Jeff per the plan doc's own notes): S5 projector
wall floor-height polish, S4 video screen placement, remaining S2 props
(Tobii, blocked on his Tripo studio exports). No merge to main, no
Spark deploy -- pushed to `claude/wearable-fx` only.

## SESSION UPDATE (2026-07-19, cloud session #2) -- PhD flex-lamp fallback

Jeff's ask: if the render-to-texture island mini-game (TECH_SPEC §G,
the single riskiest custom build in the whole project) doesn't land in
time, the PhD bench shouldn't go interactive-less. He proposed reusing
the Vive's click-to-wear language on the data glove, then driving
something simple (a toy helicopter's height, or a lamp's brightness)
off finger-flex. Picked the **lamp**: zero new asset/generation cost
(procedural emissive mesh, no Tripo/Marble/Mint spend) vs. a helicopter
needing a new model plus flight-mechanic code -- the simpler, lower-risk
choice given the wallet is basically dry and time is short. Docs updated
in `docs/TECH_SPEC.md` §G and `docs/WORLD_DESIGNS.md` (new §2a) marking
this the build-first fallback; the island stays the stretch goal.

Implemented (`src/dataGloveFx.ts`, registered in `src/index.ts` after
`WearableFxSystem`):
- Click the data glove (new S2 manifest prop, `id: "data-glove"`,
  `role: "data-glove"`, `roots/scene-02-perception-lab/props/
  data-glove.glb` -- still pending Jeff's Tripo export, 404s quietly
  like every other stubbed prop until it lands) -> same lift/fly/settle
  language as the Vive don, but it ends
  reparented onto `world.camera` at a fixed local offset instead of
  teleporting, so it just rides along in view from then on -- no
  per-frame tracking code needed (three.js parent-child transforms
  handle it for free).
- Once worn, a continuous 0-1 flex value drives a small procedural desk
  lamp (`scene.flexLamp` in the manifest, S2 only so far -- same
  pattern as `projectorWall`, no new asset): bulb color lerps dim ember
  -> warm bright, plus a canvas-gradient glow sprite that fades/grows
  with it. Flex source: desktop click-and-hold (pointerdown/up, eased
  toward 0 or 1 each frame); XR reads the standard `xr-standard-squeeze`
  gamepad button's analog `.value` off `renderer.xr.getSession()
  .inputSources` directly (bypasses IWSDK's own squeeze wrapper, which
  only exposes boolean start/end) -- same "real pinch/squeeze strength"
  convention TECH_SPEC §G already committed to for the island's walk
  control, just applied here too, so it's not a new unverified idea.
- Verified: `tsc --noEmit` clean, `vite build` clean, smoke test run 3x
  -- same pre-existing 2-flake pattern as the wearableFx work above
  (see that entry), no new failures, no new console/page errors.

**Still needs Jeff's eyes**, same caveat as the Vive don/doff: the
lift/fly/settle-onto-hand motion and the lamp glow have never been
watched in a real browser. The XR squeeze-value path is a bigger
unknown than the Vive's camera-pose code was -- it's only verified
against the WebXR spec on paper, never against Quest's actual hand-
tracking-to-gamepad emulation on a real device. If squeeze doesn't come
through in practice, the desktop click-hold path is the safe fallback
demo path regardless (matches the project's existing "the fallback IS
the mechanic" philosophy from §G). Also: the "worn" hand offset is a
fixed stylized spot in view, not a tracked hand position -- there's no
per-joint curl detection here (that would need real `XRHand` joint
access, out of scope for this pass).

Not touched: the actual glove GLB (blocked on Jeff's Tripo export --
position/rotation on the manifest entry are a placeholder mirror of the
Bench A layout, retune via `?edit` once real), any finger-curl
animation on the glove mesh itself (needs blend shapes/bones on an
asset that doesn't exist yet), the island mini-game (still open as the
stretch goal). No merge to main, no Spark deploy.

## TODO -- JB Proxie polish (Jeff's review, 2026-07-19)

- [x] **Height** -- `src/companionAvatar.ts` `TARGET_HEIGHT` dropped
  1.8m -> 1.65m (Jeff: "feels uncomfortable, he seems much taller than
  the camera viewpoint"). Feet ground-snap to the visitor's floor y, so
  the old 1.8m read as a real 0.2m loom over the ~1.6m eye height, not
  just distance. First-pass number, not measured -- needs a real look
  once Jeff's back in a browser; the constant is a one-line retune if
  1.65 still isn't right.
- [ ] **Look/material** -- Jeff: current rigged avatar has "weird
  texture finishes with the grids" he wants gone. This is baked into
  the Mint-generated `rigged_character_glb.glb` itself (`public/
  assets/mint/proxie-avatar/`), not something a code tweak can fix --
  needs a redesign pass in Mint (Jeff has 4000+ tokens left, should
  cover it) and a re-export/reimport through `companionAvatar.ts`.
  Jeff's call on new direction; this cloud session can't complete
  Mint's OAuth (see the standing note above), so the generation side
  needs to happen from Jeff's own Mint session -- happy to wire up
  whatever comes out of it.
- [ ] **Idle animation** -- Jeff: current idle reads "a bit creepy."
  Likely the same Mint rigging pass fixes this alongside the look (new
  idle clip authored/selected together with the new character), rather
  than a separate fix -- flagging as one line item but expect it to
  land as part of the look redesign above. (Note: idle is already
  slowed 0.45x via `CLIP_TIMESCALE` in `companionAvatar.ts` from an
  earlier "busy swaying" review pass -- if the new clip still reads
  oddly, that's the first knob to check before requesting a full
  re-rig.)

## Deploy reminders

- Spark needs Node >= 20.19 to build now (`docs/DEPLOYMENT.md` §0).
- Keep `.npmrc` (legacy-peer-deps) -- SparkJS peer range vs super-three r181.
- Localhost dev injects the IWER simulator, which captures WASD; test
  desktop controls via the LAN URL or a production build.
