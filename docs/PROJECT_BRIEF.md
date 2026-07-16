# Project Brief: Career World Explorer (SIGGRAPH LA Hackathon)

## Context
Jeff Breugelmans (co-founder/Head of Product, AfterNow; PhD Human Factors/Industrial
Engineering; jeffxr.com) is participating solo (open to teaming up) in **Worlds in Action
Hack [02]: SIGGRAPH LA**, July 18–19, 2026, ASU California Center – Grand, Downtown LA.
Hosted by SensAI Hackademy. Submission can be WebXR link, web app URL, or APK.

## The pitch
**Turn any professional's career/resume into an explorable, conversational portfolio.**
Jeff's own background (Proxie, his existing AI agent) is the first instance / proof of
concept — framed explicitly as a reusable template/product, not a personal vanity project.
This framing matters for judging and for finding teammates.

## Core components
1. **Proxie** — Jeff's existing locally-hosted AI agent (Qwen3 35B on NVIDIA DGX Spark),
   FastAPI backend, ChromaDB + LlamaIndex RAG over his dissertation/papers/resume,
   deployed via Cloudflare Worker + Tailscale Funnel. Publicly live at jeffxr.com/chat.
   Acts as the conversational guide inside the experience.
2. **World Labs Marble API** — generates explorable 3D worlds from text prompts or
   images. Async: POST to `/marble/v1/worlds:generate`, poll operation until done.
   Get an API key at platform.worldlabs.ai (billing/credits required — check Discord
   for any hackathon credit allotment, don't assume unlimited).
3. **WebXR delivery** — browser-based, works on desktop and Quest 3 browser (Jeff is
   bringing a Quest 3; no confirmed hardware provided on-site). No Unity requirement.

## Architecture decision (locked in)
- **Pre-generate, don't live-generate.** Build a fixed set of Marble worlds from
  prompts/images *before* the demo. Proxie answers questions in chat and triggers
  scene transitions ("teleports") to the matching pre-built world when a topic comes
  up — reliable, fast, no live-API risk during judging.
- **Portal/hub structure, not one fused scene.** Each sub-topic is its own Marble
  generation; 3 sub-scenes per "world" (chapter) are connected via portal/teleport
  points in the WebXR app. Marble does not fuse multiple distinct scenes into one
  generation — don't attempt a single "circular space with corners" prompt.
- **Stretch goal only, if MVP solid by Saturday night:** one live Marble generation
  as a flourish, with Proxie narrating "generating a scene for that, one sec" while
  polling.

## Scene priority
Career chapters first (illustrates real working experience), Education chapters as
stretch. Within career: AfterNow + Microsoft prioritized.

### World: AfterNow
1. Prez immersive presentations — holographic presentation studio, HoloLens on podium
2. Even Realities smart glasses work — minimalist eyewear product design lab
3. Second Studio collaborative VR design — shared virtual studio, translucent avatars

### World: Microsoft Consulting
1. Hybrid telepresence meetings — video/VR/in-person attendees at one table
2. Data center technician training — projection-mapped server racks, 3D printer
3. Optical computing / photonics — Matrix-style glowing binary grid server room

### World: Education (stretch)
1. Royal Netherlands Air Force maintenance hangar — F-16s, Chinook, industrial lighting
2. TU Eindhoven — rubber hand illusion setup + navigation/route-planning trust research
3. Northeastern University — driving simulator rig + eye-tracking/data-glove research

(Full detailed prompt text for each scene was drafted in prior chat — regenerate or
paste from there; keep lighting/mood descriptors consistent within each World for
portal continuity.)

## Image-vs-text generation rule of thumb
- Strong, uncluttered reference photo → lead with image-based generation, short
  style/mood text modifier only.
- Cluttered/close-up/no reference → full text prompt carries the scene.

## Hosting plan
- Squarespace (jeffxr.com) can't run the WebXR app/backend directly (static site only).
- Host the WebXR app separately — same pattern as Proxie (Cloudflare Worker + Tailscale
  Funnel off the DGX Spark, or Vercel/Netlify/Cloudflare Pages).
- Point `jeffxr.com/worlds` at it via redirect, or use a subdomain like
  `worlds.jeffxr.com`.

## Framing for judges/teammates
Lead with the **template/product angle**: "an AI agent that turns any professional's
career into an explorable, conversational portfolio — this is a proof of concept using
my own background as the first instance." Avoid framing as personal showcase alone.

## Open items / to verify on-site
- Marble credit allotment for hackathon participants (check Discord)
- Whether venue provides any Quest headsets (bring own regardless)
- No known support for XREAL Project Aura in the hack's toolkit (WebXR/Unity/Unreal
  only) — treat any Aura integration as a stretch demo, not core deliverable
- Team status: solo-viable scope defined above; open to teaming, especially with
  spatial UI/UX or multi-agent specialists met via Discord

## Links
- jeffxr.com / jeffxr.com/chat (Proxie)
- github.com/JeffBreugelmans
- linkedin.com/in/jbreugelmans
- Marble docs: docs.worldlabs.ai/api
