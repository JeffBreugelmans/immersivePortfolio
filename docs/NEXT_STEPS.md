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

**Open question that decides Mint's role for environments:** does Mint
export worlds as downloadable splat files (`.spz`/`.ply`)? Our app needs
raw files it can self-host (`marble/scene.spz` + `collider.glb`); a hosted
play.mint.gg URL can only be iframed, which bypasses our portal/chat/gaze
systems. Check `docs.mint.gg` / the MCP tool list once reachable.

Example world for reference/inspiration: https://play.mint.gg/impossible-places

## Cloud-session network access (was blocking)

Cloud sandbox sessions run behind a domain allowlist. Jeff added `mint.gg`
via app Settings -> Capabilities -> Domain allowlist; still to confirm in a
fresh session. If mint.gg (or its subdomains) remain blocked:
- Add `*.mint.gg` (bare `mint.gg` may not cover `mcp.`/`play.`/`docs.`).
- Useful additional entries: `*.worldlabs.ai`, `api.tripo3d.ai`,
  `platform.tripo3d.ai`, `sensaihack.notion.site`, `sensaihack.com`.
- If the Capabilities panel doesn't affect Claude Code cloud sessions, the
  authoritative setting is claude.ai/code -> environment selector (cloud
  icon) -> gear -> Network access -> Custom.
- Alternative that needs no allowlist: add `https://mcp.mint.gg/` as a
  claude.ai custom connector (connector traffic routes through Anthropic).

Also still unread because of the allowlist: the SensAI "How to Prepare --
Learning Resources & Workshops" Notion page
(https://sensaihack.notion.site/How-to-Prepare-Learning-Resources-Workshops-b29d7964cb7c826eb08281d8b95d1ec7).

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
