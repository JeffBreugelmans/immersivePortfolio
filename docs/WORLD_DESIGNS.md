# FLAGSHIP WORLDS — Draft Design Package (overnight draft for Jeff's morning review)

Cinematic World Builder → Jeff. Written 2026-07-18, night before build day.
Replaces the 9-mediocre-scenes plan with **5 flagship scenes** across 2 worlds.
Nothing in the repo has been touched — this is the review package. Once you
bless it, I (or the lead) integrate: manifest restructure, per-scene
`prompts.md`, then generation runs in the order at the bottom.

Design law for every scene below: **one hero moment** (the screenshot),
**one interactive toy minimum** (legible, glowing, discoverable), **at least
one Easter egg**, **Proxie placard text on every key prop** (feeds
`gazeContext.ts`), and continuity of palette within a world so portals feel
intentional.

---

## 1. THE ROSTER — keep / merge / cut

| Legacy scene (manifest today) | Verdict | Becomes |
|---|---|---|
| `education/scene-01-raf-hangar` | **KEEP + upgrade** | **S1 — The Hangar on the Polder** (RNLAF + Dutch upbringing folded in: the childhood story lives on the break table, the Netherlands lives outside the hangar doors) |
| `education/scene-02-tu-eindhoven` | **MERGE** | **S2 — The Perception Lab** (one continuous research lab: Master's rubber-hand-illusion station on one bench, PhD eye-tracker + data-glove rig on the other) |
| `education/scene-03-northeastern` | **MERGE** (into S2) | Two universities, one lab. The story arc "how do people perceive? → can perception restore ability?" reads as a single chapter, and it halves generation cost while doubling prop density. The TU/NEU split was administrative, not narrative. |
| `afternow/scene-01-holographic-studio` | **KEEP + upgrade** | **S3 — The Holo Stage** (Prez on HoloLens 2 + Quest; also hosts the gear wall with the Vive that transports you to S4) |
| `afternow/scene-03-collaborative-vr-studio` | **KEEP, reframe** | **S4 — Second Studio: The Construct** (you don't walk here — you *put on the Vive* in S3 and wake up inside 2016 VR. The scene IS the inside of the headset.) |
| `afternow/scene-02-smart-glasses-lab` | **CUT as a scene** | Even Realities becomes the **glasses-on-a-desk interaction inside S5** (Jeff's grouping: Consulting/AI). A whole room for one pair of glasses was always going to feel empty; a desk you grab them from, lamp glowing beside it, is a moment. |
| `microsoft-consulting/scene-02-datacenter-training` | **MERGE** | **S5 — Lightworks** (one Microsoft mega-scene: server-repair training bay on one side, 4-projector optical-computing gallery on the other, AI-frontier alcove with the Even Realities desk as the finale) |
| `microsoft-consulting/scene-03-optical-computing` | **MERGE** (into S5) | Same building, same client, same "light as a tool" theme. Projection-mapped training and projected computation are literally the same technology pointed at different problems — that's the placard line, and it's true. |
| `microsoft-consulting/scene-01-hybrid-telepresence` | **CUT as a scene** | Project Malta becomes **content on the Prez stage in S3** — which is historically accurate: Jeff presented the 4D framework *using Prez*. The user-representation-spectrum becomes a floating hologram exhibit. NDA-friendliest possible treatment, zero generation cost. |

**Net: 9 scenes → 5 scenes, and every cut/merge makes a survivor richer.**

Proposed manifest structure (lead integrates):

```
worlds = [
  { id: "roots",  title: "Roots — Netherlands & the Path to Human-Centered Design",
    scenes: [ scene-01-hangar-polder, scene-02-perception-lab ] },
  { id: "career", title: "XR & AI — Building the Future of Work",
    scenes: [ scene-01-holo-stage, scene-02-second-studio-construct, scene-03-lightworks ] },
]
defaultSceneId = "scene-01-hangar-polder"   // chronological entry; see open Q #1
```

### Portal graph (spec item g, summarized — details per scene)

```
S1 Hangar  ⇄  S2 Perception Lab  ⇄  S3 Holo Stage  ⇄  S5 Lightworks
                                       ⇵ (Vive pickup / headset removal)
                                    S4 Second Studio Construct
S5 Lightworks ⇄ S1 Hangar   («full circle»: from jet engines to light engines)
```

Every scene has ≥2 exits, the career loop closes, and S4 is *only*
reachable by putting on the Vive (portal fallback exists but is visually
disguised as the headset on its pedestal — see S3/S4). Proxie can still
teleport anywhere by sceneId.

---

## 2. SHARED STYLE BIBLE (portal continuity)

One global rule: **every scene has exactly one signature light color** doing
the emotional work, over a neutral base. Portals always glow in the
*destination's* signature color — navigation becomes legible by color alone.

| Scene | Base palette | Signature light | Color temp / mood | Atmosphere |
|---|---|---|---|---|
| S1 Hangar | concrete grey, NATO green, safety yellow | **warm gold** (late-afternoon sun through hangar doors) | 3200K low sun vs cool interior fill | dust motes in god rays, thin haze |
| S2 Perception Lab | birch wood, white walls, navy accents | **warm gold** (same sun, now through venetian blinds) + one **Hue lamp** accent | 4000K neutral lab + 3200K window stripes | clean air, faint monitor glow |
| S3 Holo Stage | charcoal studio, matte black floor | **cyan-blue** hologram light | 5500K stage neutral, cyan bounce | subtle volumetric cone over the stage |
| S4 Second Studio Construct | deep teal void, white wireframe | **cyan-blue** (inherited from S3 — you're inside the same era) + magenta grab-highlights | n/a (unreal space) | glowing grid horizon, floating particles |
| S5 Lightworks | server-rack black, brushed steel | **emerald green** (rack LEDs, projector grids, HUD) | 6500K cold datacenter + green emissive | machine-room shimmer, projector beams visible in light haze |

Roots world = **gold** (memory, warmth, the Netherlands). Career world =
**cyan → green** (hologram light → machine light → the G2's green HUD).
The arc "sunlight → screenlight → lasers → light-you-wear" is the whole
biography told in lighting. Portals: gold-rimmed = toward the past,
cyan/green-rimmed = toward the future.

**Proxie companion continuity:** JB Proxie (rigged avatar, feature-queue
item 1) idles ~2m from spawn in every scene, never speaks unprompted. His
knowledge per scene = the placard `label`/`description` fields below, plus
one scene-level line (given per scene) he can use when asked "where are we?"

---

## 3. THE FIVE SCENES

Legend for prop source: **Marble-baked** (in the environment prompt, not a
separate asset) / **Tripo GLB** (`scripts/tripo-generate.mjs`) / **Mint**
(image, audio, or model via Mint MCP) / **custom-from-Jeff** (files Jeff
already owns — site images, videos, GLBs).

---

### S1 — THE HANGAR ON THE POLDER
`roots/scene-01-hangar-polder` (upgrade of legacy raf-hangar)

**(a) Concept + hero moment.**
A Royal Netherlands Air Force maintenance hangar at golden hour, doors
rolled wide open onto a flat polder landscape — canal, bike path, one
working windmill turning slowly against the sky. Inside: an F-16 with
panels open mid-maintenance, a Chinook parked deeper in shadow, tool
chests, a mechanic's break table. This is where the story starts: the
Dutch kid who mixed building kits, now standing under a jet. The
upbringing isn't a separate scene — it's the *stuff on the break table*
and the world outside the doors.
**Hero moment:** stand at the F-16's nose looking out the hangar doors —
jet silhouette in the foreground, golden polder + turning windmill behind
it. That's the screenshot. (The windmill sails turning is a small animated
mesh prop layered over the splat — the splat gives us the distant windmill
shape, the animated sails sell it. If Marble's baked windmill fights the
overlay, we place our own low-poly windmill outside the collider bounds.)

**(b) Marble world prompt (paste-ready, iteration v1):**
```
Interior of a Royal Netherlands Air Force maintenance hangar at golden hour,
camera at standing eye height in the middle of the smooth concrete floor.
Enormous hangar doors on one side are fully open to a flat Dutch polder
landscape: green fields, a narrow canal, a bike path, and one traditional
windmill in the middle distance under a warm late-afternoon sky. Low sun
pours through the doorway in long golden god rays with visible dust motes;
interior fill light is cool and industrial from high halide fixtures. A grey
F-16 fighter jet stands near the open doors with an engine access panel
open and a yellow maintenance stand beside it; a tandem-rotor Chinook
helicopter sits deeper in the hangar in soft shadow. Red rolling tool
chests, a workbench with hand tools, coiled air hoses, safety-yellow floor
markings, a small break table with two chairs near a side wall. Palette:
concrete grey, NATO green-grey aircraft, safety yellow accents, warm gold
sunlight. The concrete floor is clean, flat, and walkable throughout, with
a clear open area at least eight meters wide at the center. Atmosphere:
thin dust haze, quiet end-of-day stillness. No people, no text or signage
with readable writing, no clutter blocking the central floor, no low
ceilings, not night-time, not rain.
```
Iteration notes for `prompts.md`: if the F-16 comes out mangled (aircraft
are hard), v2 pivots to "F-16 partially covered by a fitted tarp" (hides
generation artifacts, adds mood) — log result either way. Keep the
windmill in-frame of the doorway in every iteration; it's the Easter-egg
anchor.

**2D pre-viz (Mint image, run BEFORE spending the Marble generation):**
```
Wide interior photo of a military maintenance hangar at golden hour, F-16
with open engine panel silhouetted against huge open hangar doors, Dutch
polder landscape with canal and one windmill outside, god rays and dust,
Chinook helicopter in shadow behind, concrete floor, warm gold and
concrete-grey palette, photoreal, eye-level shot.
```
Validate: sun direction, windmill legibility, floor openness. Two image
iterations max, then commit to Marble.

**(c) Props.**

| Prop | Source | Generation prompt / file |
|---|---|---|
| F-16, Chinook, hangar, windmill, tool chests | Marble-baked | (in world prompt) |
| Windmill sails (animated overlay, distant) | Tripo GLB | `traditional Dutch windmill with four lattice sails, low poly, game ready` — engineer spins sails via simple rotation; placed outside walkable bounds aligned to the baked windmill |
| Hybrid building-kit model (childhood) | Tripo GLB | `small toy model aircraft built from mixed colorful plastic building bricks and metal construction-set girders, charmingly mismatched, game ready` — sits on the break table |
| Inspection work lamp (interactive) | Tripo GLB | `industrial clamp work lamp on a tripod stand, metal cage around bulb, game ready` |
| Wooden clogs (klompen) | Tripo GLB | `pair of traditional Dutch wooden clogs, worn yellow paint, game ready` — under the workbench |
| Cat #1 (sleeping) | Tripo GLB | `sleeping cat curled up, short fur, low poly, game ready` — recolor in-material to match real cat; on a crate beside the Chinook |
| Stroopwafel + Delft-blue thermos | Mint (single model or asset pack) | `stroopwafel resting on top of a delft blue ceramic thermos cup, game ready` — break table |
| RNLAF roundel poster | custom-from-Jeff / Mint image | flat `image` prop on wall; Mint fallback: `Royal Netherlands Air Force orange roundel insignia on weathered metal plate, flat texture` |

**(d) Interactive elements.**

1. **Work lamp color-wave** — *hand-wave* in front of the tripod lamp cycles
   its light color (warm → orange → RNLAF orange-triangle glow). Jeff's
   verbatim gesture requirement, placed here first because a hangar lamp is
   the most legible possible lamp. Affordance: lamp hums and flickers
   slightly when you're within 1.5m. **Non-VR fallback:** click the lamp.
2. **F-16 canopy gaze-glow** — *gaze-dwell* (1.2s) on the cockpit canopy
   powers up a soft cockpit HUD glow + one radar "sweep" ping. Look away,
   it winds down. The "something lights up when looked at directly"
   requirement. **Non-VR fallback:** same, using the desktop gaze raycast
   (already exists — `window.__gazeContext`).
3. **Chinook rotor spin-up** — *proximity* under the Chinook: rotors do one
   slow, heavy quarter-turn with a deep whomp SFX, kicking a dust puff.
   Never a full spin (keeps it grounded, keeps perf cheap). **Non-VR:**
   identical (proximity works on desktop).
4. **Portal to S2** — gold-rimmed doorway by the side office door.

**(e) Easter eggs.** The turning windmill through the doors (hiding in
plain sight); the mixed-brick childhood model on the break table (the
About-page origin story, wordless); klompen under the workbench; cat #1
asleep by the Chinook; stroopwafel on the thermos. Optional deep cut if
Marble is kind: a bicycle leaning inside the hangar door.

**(f) Proxie placards** (`label` / `description`):

- **F-16 Fighting Falcon** — "During his Electrical Engineering bachelor's,
  Jeff interned with the Royal Netherlands Air Force around aircraft like
  this one. Black-box thinking — inputs, outputs, inner workings — started
  here and became the backbone of his human-centered design practice."
- **Chinook helicopter** — "The other resident of Jeff's RNLAF internship
  hangar. Years later a helicopter shows up again in his PhD — as a
  gesture-controlled ride in a rehabilitation game. Ask him about it in the
  Perception Lab."
- **Building-kit hybrid model** — "As a kid in the Netherlands, Jeff mixed
  incompatible building kits into hybrid creations. He never stopped —
  his whole career is combining systems that weren't designed to fit."
- **Windmill (gaze at doorway)** — "A working polder windmill: elegant
  engineering in service of keeping people's feet dry for five centuries.
  Dutch human-centered design before anyone named it."
- **Work lamp** — "Wave at it. Go on. Not everything in a portfolio has to
  be profound."
- Scene line for "where are we?": "A Royal Netherlands Air Force hangar,
  around the time Jeff's engineering story begins — with the Netherlands
  itself waiting outside the doors."

**(g) Portals.** → S2 Perception Lab (gold rim). → S5 Lightworks (green
rim, near the open doors — "skip ahead" loop-closer, labeled by color only).

**(h) Open questions for Jeff.**
- Do you have any real photos from the RNLAF internship era usable as
  Marble image-conditioning (even just a hangar interior)? Strong photo →
  image-led generation per the brief's rule of thumb.
- F-16 fidelity vs. tarp fallback: any attachment to seeing the jet fully
  uncovered, or is a half-tarped jet acceptable (safer generation)?
- Which cat sleeps in the hangar? Names + coat colors for all three, please.

**Audio (Mint, final-only):**
- Ambient loop: `large empty aircraft hangar room tone, low wind through open
  doors, distant birdsong from outside, occasional soft metallic tick of
  cooling metal, no music, seamless loop`
- SFX 1 (Chinook): `heavy helicopter rotor single slow whomp with deep sub
  thump and dusty air movement, one-shot`
- SFX 2 (lamp wave): `soft industrial lamp click with faint electrical hum
  rising, one-shot`

---

### S2 — THE PERCEPTION LAB
`roots/scene-02-perception-lab` (merge of tu-eindhoven + northeastern)

**(a) Concept + hero moment.**
One warm, lived-in university research lab that compresses a decade of
Jeff's science into two benches. **Bench A (Master's, Eindhoven):** the
rubber hand illusion, staged with JB Proxie as the subject — he sits at
the bench, his real hand hidden behind a partition, a fake hand on the
table where his should be, a brush waiting. **Bench B (PhD, Northeastern):**
the accessibility rig exactly as it really was — monitor running the
tropical-island game, black biosensor data glove on a stand, Tobii eye
tracker bar below the screen. Venetian-blind sunlight, corkboards, the
RISE award on a shelf. This is the room where "how do people perceive?"
became "can perception give ability back?"
**Hero moment:** the rubber hand illusion, full classic protocol. You pick
up the brush and stroke the fake hand; after ~5 synchronized strokes,
Proxie's *real* hand (behind the partition) starts twitching in sync.
Then the toy hammer sitting nearby becomes available — tap the fake hand
and Proxie yanks his real hand back with a yelp animation. Demonstrating a
1998 neuroscience classic *on your AI host* is the "wait, WHAT" of the
whole portfolio — perception research explained in four seconds with zero
words.

**(b) Marble world prompt (v1):**
```
Interior of a cozy university human-factors research lab, camera at
standing eye height at the room's center. Late-afternoon sun enters through
venetian blinds on one wall, casting warm gold stripes across the floor;
overall interior light is neutral and soft. Two workbench stations: on the
left, a wooden desk with a low vertical partition screen standing on the
desktop and a chair pulled up to it; on the right, a desk with a large
computer monitor, a keyboard, and a desktop PC tower beneath. White walls
with a corkboard of pinned notes and diagrams, a tall bookshelf with
journals and a few small trophies, a whiteboard with faded sketches, a
potted plant, a small side table with a coffee machine. Palette: birch
wood, white walls, navy blue chair fabric, warm gold window light. Wooden
floor, completely clear and walkable in the center, at least six meters of
open space between the benches. Atmosphere: quiet, studious, end-of-day
calm, faint monitor glow on the right bench. No people, no readable text,
no clutter on the floor, no fluorescent glare, not a hospital, not a
classroom with rows of desks.
```
Iteration note: the two-bench layout is the load-bearing request — if v1
merges them, v2 splits with "on opposite walls." Both monitors/screens in
the splat will be replaced or overlaid by our live props, so their baked
content doesn't matter.

**2D pre-viz (Mint image):**
```
Cozy university research lab interior, golden venetian-blind light, two
workbenches: left one with a small partition screen and chair, right one
with monitor and PC, corkboard and bookshelf with small trophies, birch
and white and navy palette, warm academic atmosphere, photoreal,
eye-level.
```

**(c) Props.**

| Prop | Source | Generation prompt / file |
|---|---|---|
| Lab, benches, partition, shelves | Marble-baked | (world prompt) |
| Rubber hand | Tripo GLB | `realistic prosthetic rubber right hand, pale silicone, resting flat palm-down, game ready` |
| Paintbrush (grabbable) | Tripo GLB | `soft wide artist paintbrush, wooden handle, game ready` |
| Toy hammer (grabbable) | Tripo GLB | `small rubber reflex hammer, orange head, game ready` |
| Black biosensor data glove (RESOLVED art direction) | Tripo GLB | `black fabric data glove, thin white sensor line running down the back of the middle finger and across the knuckles, small circuit board on the back of the hand, wires to a connector, game ready` — image-condition from `planning/reference/phd research/dataglove uncovered.jpg` (labeled sensor diagram, received) |
| Tobii eye tracker bar | Tripo GLB | `slim black eye tracker sensor bar with two small dark lenses, mounted below a monitor on a small stand, game ready` |
| PhD monitor (the mini-game) | custom (engineer) | `image`/render-texture plane replacing the baked monitor face — see interactive #2 |
| RISE award | Tripo GLB | `crystal glass research award trophy on a small wooden base, engraved rectangle, game ready` |
| Framed Boston Globe article | custom-from-Jeff | flat `image` prop (site asset: "Eye-tracking video game device subs for mouse") |
| Data-glove schematic poster | custom-from-Jeff | flat `image` prop on corkboard (site asset) |
| Philips-style Hue lamp (interactive) | Tripo GLB | `modern smart table lamp with soft glowing sphere shade, minimalist, game ready` |
| Cat #2 | Tripo GLB | `cat sitting upright on a desk looking at a screen, short fur, low poly, game ready` |
| JB Proxie seated pose | Tripo/Mint (avatar, feature queue #1) | seated variant or reposed idle at Bench A |

**(d) Interactive elements.**

1. **Rubber hand illusion (HERO)** — *pickup* the brush (auto-grab
   affordance glow), stroke the fake hand (collision zone over the hand,
   stroke count N≥5) → Proxie's hidden real hand twitches in sync
   (small looping anim) + goosebump SFX cue. Then the hammer's glow
   activates: *pickup* + tap fake hand → Proxie flinch anim + yelp +
   placard flash: "Your brain just adopted a rubber hand. So did his."
   **Non-VR fallback:** click brush → camera-locked auto-stroke loop
   (click again to stroke faster); click hammer → the tap. All triggers are
   click-driven on desktop, so nothing is lost but the hand-feel.
   *Feasibility flag for the XR engineer:* needs per-prop anim states on
   the Proxie avatar (twitch, flinch) — if avatar anim-states slip, the
   fallback subject is a second mannequin arm with the same anims, and
   Proxie stands beside it narrating instead. Decide by Saturday noon.
2. **The PhD rig — playable simulation (SECOND HERO, scope CONFIRMED
   simple 2026-07-19)** — Jeff's actual research mechanics, faithfully
   but deliberately minimal: the monitor on Bench B renders a live mini
   tropical-island scene (render-to-texture; tiny three.js island —
   water plane, sand, palms, one coconut target, styled after the real
   Unity screenshot Jeff shared: a rope suspension bridge to a
   torii-style wooden arch across mossy green hills). This is a screen
   you watch and control **from inside the Perception Lab** — not a
   separate scene/portal, confirmed. *Gaze-dwell* at the LEFT third of
   the screen → in-game camera rotates CCW; RIGHT third → CW (exact
   mechanic from the dissertation). "Putting on" the data glove (*pickup*
   the glove → it snaps to your hand) arms the forward control:
   **squeezing grip (VR) = flexing the hand = walk forward**. **Non-VR
   fallback:** mouse-hover on screen thirds = gaze; hold left-click =
   flex. The physical glove PROP animates in sync with this input on
   BOTH platforms — fingers curl toward closed while flexed/squeezed
   (VR: real pinch/squeeze strength; desktop: click-held = closed,
   released = open) — so the desk prop visibly "performs" the walk
   input, not just an abstract key-hold. Tobii bar under the monitor
   glows twin dots while gaze control is live. *Confirmed scope:* thumb
   (jump/throw) and wrist (camera-mode toggle) sensors from the real
   glove are OUT of scope for the hackathon build — stretch only if time
   allows, see (d)#2b below. *Feasibility flag:* render-to-texture
   island is the single riskiest custom build of the hackathon — engineer
   should prototype it FIRST (Saturday morning); the cheap fallback is
   Jeff's existing demo video (site asset) as a `video` prop with
   gaze-highlighted hotspots, which still honors the mechanics in
   narration.
2a. **SIMPLIFIED FALLBACK, built first (2026-07-19)** — the island game
   above is the reach goal; the mechanic that's guaranteed to ship is
   simpler and reuses the same don + flex-signal plumbing: click the
   data glove (same click-to-wear language as the Holo Stage Vive) and
   it lifts off the desk and settles onto your hand. From then on,
   flexing — hold-click on desktop, real squeeze/pinch strength in XR —
   brings a small desk lamp up from a dim ember to a warm bright glow
   and back down as you release, live, every frame. It's the same
   research point (the glove turns a hand gesture into a continuous
   analog signal) without needing the render-to-texture island to be
   working — no monitor, no third-person controller, no second scene
   render. Implemented in `src/dataGloveFx.ts`.
2b. **Thumb-pad bubble (STRETCH, hand-tracking only)** — a small glowing
   nub on the glove's thumb pad, poppable via a real pinch gesture
   (reuses the pinch-strength signal already computed for walk control —
   no new detection needed). Purely decorative/discoverable, not tied to
   game logic; skip entirely if time is short.
3. **Hue lamp hand-wave** — *hand-wave* over the lamp cycles gold → tulip
   orange → Philips blue. Placard notes the Eindhoven/Philips joke.
   **Non-VR:** click.
4. **RISE award gaze-glint** — *gaze-dwell* makes the trophy catch a
   sun-glint + soft chime. Pure discoverability candy.

**(e) Easter eggs.** RISE award on the shelf (Jeff's explicit ask);
stroopwafel balanced on the coffee machine ("proper use: on top of a hot
drink"); sticky note on the monitor bezel reading a hand-drawn ✦ (no
readable text in-splat, so the *placard* carries the payload: "shared
values > raw competence" — his thesis finding); cat #2 sitting on Bench B
staring at the island game (cats watch screens); a tiny windmill desk toy
by the PC tower (continuity with S1); Boston Globe frame.

**(f) Proxie placards.**

- **Rubber hand** — "The rubber hand illusion: stroke a fake hand in sync
  with a hidden real one and the brain adopts the fake as its own. Jeff's
  Master's work at TU Eindhoven began here — with how perception decides
  what's true, and how people come to trust what they can't verify."
- **Paintbrush** — "The entire experimental apparatus of a famous
  neuroscience study. Pick it up and stroke the fake hand — watch the
  subject."
- **Reflex hammer** — "Once the illusion takes hold, a threat to the fake
  hand is a threat to the subject. Ethics boards ask you to warn people.
  Consider yourself warned."
- **Data glove** — "Jeff built this biosensor glove by hand for his PhD:
  flex sensors on every finger, pressure on the thumb, wireless UDP link.
  Put it on — flexing your hand walks the island character forward, exactly
  as it did for his rehabilitation patients."
- **Tobii eye tracker** — "The other half of the interface: gaze at the
  left or right of the screen and the game camera turns with your eyes.
  Combined with the glove, it restored full computer access using only
  gestures and gaze — no mouse, no keyboard."
- **Island mini-game monitor** — "Unity's demo island, rebuilt by Jeff into
  a rehabilitation test bed: coconut throwing, bowling, a puzzle, and a
  gesture-controlled helicopter ride. Fourth place at the 2011 'People and
  Technologies that Change People's Lives' competition; 62 citations and
  counting."
- **RISE award** — "Northeastern's RISE:2012 'Excellence in Research'
  award, presented by the university president — one of two Jeff's
  dissertation won that year."
- **Hue lamp** — "A smart lamp, in the city of Philips. Eindhoven runs on
  light. Wave at it."
- Scene line: "Ten years of Jeff's research in one room — Eindhoven on the
  left bench, Boston on the right. The question never changed: what can
  perception do for people?"

**(g) Portals.** ← S1 Hangar (gold). → S3 Holo Stage (cyan rim,
positioned past Bench B — you literally walk from the monitor-based VR of
the PhD into real VR, which is the sentence on his About page).

**(h) Open questions.**
- Confirm data-glove reference photos I can pull for Tripo image
  conditioning (the site schematics look usable — anything higher-res?).
- Proxie-as-subject: happy for him to yelp? (Comedy beat vs. dignity of
  the guide — I vote yelp, it humanizes him.)
- Do you still have the actual dissertation demo video file for the
  monitor-fallback path?
- Any real Eindhoven lab detail you want smuggled in?

**Audio (Mint):**
- Ambient loop: `quiet university lab room tone, soft computer fan hum,
  faint clock tick, distant muffled hallway sounds, occasional page turn,
  no music, seamless loop`
- SFX 1 (illusion): `soft bristle brush strokes on skin, slow rhythmic,
  short loop` + `sudden startled gasp yelp, male, comedic not painful,
  one-shot`
- SFX 2 (mini-game): `bright tropical game jingle, marimba, one-shot` (goal
  scored on the island)

---

### S3 — THE HOLO STAGE
`career/scene-01-holo-stage` (upgrade of holographic-studio; absorbs
Project Malta as stage content)

**(a) Concept + hero moment.**
AfterNow's Prez, staged as what it is: a theater where presentations
become places. A dark, elegant studio — matte black floor, a low circular
stage dais washed in a volumetric cyan cone. On the dais, a HoloLens 2
rests on a podium. Around the stage float Prez holograms mid-presentation:
a Mars rover, a data-viz constellation, and — as the featured "slide" —
Project Malta's user-representation spectrum, the row of figures from
audio-icon to full VR avatar, rendered as translucent hologram statues
(exactly how Jeff actually presented Malta: in Prez). Along the back wall,
a warm-lit **gear wall**: shelf of headsets through the years — DK-era
relic, HTC Vive (glowing — it's the door to S4), Quest, HoloLens 2.
**Hero moment:** *gaze-dwell on the HoloLens 2 on the podium* and the
whole room performs — the holograms bloom to full brightness, the Mars
rover does a slow orbit of the stage, the data constellation rearranges —
a presentation with no presenter, conducted by your eyes. First-time
discovery of it is the screenshot (and the demo-video moment for judging).

**(b) Marble world prompt (v1):**
```
Interior of a sleek dark presentation studio, camera at standing eye height
facing a low circular stage platform at the room's center. Matte charcoal
walls and a matte black floor with a subtle reflective sheen. A single
volumetric cone of soft cyan-blue light falls on the stage from a high
rig; thin haze makes the light beam visible. On the stage, a slim dark
podium. Around the room's edge, low warm accent lighting along the base of
the walls; one long wall carries an empty display shelf unit with warm
spot lighting, museum-style. Palette: charcoal, matte black, cyan-blue key
light, small warm amber accents. The floor is flat, open, and walkable
everywhere, with the stage platform only ankle height. Atmosphere: quiet
anticipation, a theater before the show. No people, no chairs or audience
seating, no readable text, no bright ceiling lights, not an office, not a
cinema with rows of seats.
```
Iteration note: keep the shelf EMPTY in the splat — our Tripo headsets
populate it (baked headsets would be mush at splat resolution and would
fight the interactive ones).

**2D pre-viz (Mint image):**
```
Dark presentation studio, circular low stage under a volumetric cyan light
cone with haze, slim podium on stage, matte black floor with soft
reflection, warm-lit empty museum shelf along the back wall, charcoal and
cyan palette, moody, photoreal, eye-level.
```

**(c) Props.**

| Prop | Source | Generation prompt / file |
|---|---|---|
| Studio, stage, podium, shelf | Marble-baked | (world prompt) |
| HoloLens 2 (podium) | Tripo GLB | `Microsoft HoloLens 2 augmented reality headset resting on a stand, dark grey visor band, game ready` — image-condition with a product photo |
| HTC Vive (THE DOOR) | Tripo GLB | `HTC Vive virtual reality headset with dimpled sensor face and head strap, on a display stand, game ready` — image-conditioned |
| Meta Quest | Tripo GLB | `white Meta Quest 3 virtual reality headset on a display stand, game ready` |
| Mars rover hologram | Tripo GLB | `Mars rover with six wheels and camera mast, stylized, game ready` — rendered with additive cyan hologram material by engineer |
| Malta representation-spectrum | custom-from-Jeff + Mint | Jeff's spectrum diagram as a floating `image` prop; stretch: 3-4 Tripo mini-figures (`translucent stylized human figure holding a tablet, game ready` etc.) as hologram statues |
| Data-viz constellation | custom (engineer) | instanced glowing points — no generation needed |
| Oculus Launch Pad plaque | Mint image | `award plaque, dark glass with subtle rocket motif, flat texture` → framed `image` prop by the shelf |
| Holo-cat #3 | Tripo GLB | `low poly cat walking, game ready` — additive cyan wireframe material; slow patrol path across the stage |

**(d) Interactive elements.**

1. **Conductor's Gaze (HERO)** — *gaze-dwell* (1s) on the podium HoloLens
   triggers the room performance (hologram bloom, rover orbit,
   constellation shuffle; ~12s, re-triggerable). Affordance: the HoloLens
   visor carries a slow breathing glint. **Non-VR:** identical via desktop
   gaze ray; also click.
2. **The Vive door (Jeff's verbatim ask)** — *pickup* (VR grab) or *click*
   the Vive on the gear wall → you "put it on": screen irises to black
   through a lens-shaped vignette, one second of 2016-era Vive-home grid
   flicker, then you wake in **S4**. This is a portal wearing a costume.
   **Non-VR:** click does the same fade. (Engineer: reuse the standard
   teleport with a custom transition overlay; anti-bounce already exists.)
3. **Slide swipe** — *hand-wave* left/right anywhere near the stage
   advances/rewinds the floating "slides" (Malta spectrum → Mars rover
   close-up → data-viz). Echoes Prez's actual gestural model. **Non-VR:**
   arrow-key / edge-click.
4. **Quest & HoloLens placard gazes** — passive gaze targets with placards
   (below); the Quest gently rocks when gazed at.

**(e) Easter eggs.** The holographic wireframe cat padding across the
stage on a loop (cat #3 — the only cat who got to be a hologram); the
Launch Pad plaque; among the gear shelf, one tiny pair of *cardboard*
glasses (VR's humble ancestor); the Malta spectrum's smallest figure is a
familiar orange windmill silhouette instead of an audio icon — blink and
you miss it.

**(f) Proxie placards.**

- **HoloLens 2 (podium)** — "AfterNow Prez shipped on this headset: a
  codeless platform Jeff led that turns presentations into places. Look at
  it a moment longer and it will show you, rather than tell you."
- **HTC Vive** — "The headset that turned Jeff's monitor-based research
  into a place you could stand inside. Put it on — Second Studio is still
  running."
- **Meta Quest** — "Prez's second home, and the reason you might be
  watching this in a headset right now. AfterNow's Oculus Launch Pad grant
  helped make the jump."
- **Malta spectrum holograms** — "Project Malta, Microsoft Research: how do
  you make every meeting attendee equally present? Jeff mapped every way a
  person can show up — from a voice in a speaker to a full embodied avatar
  — and presented the framework inside Prez itself. You're standing in the
  presentation."
- **Mars rover hologram** — "A sample Prez asset. Architects, educators,
  and one very enthusiastic rover: Jeff's user studies put real early
  adopters in front of holograms like this to find out what spatial
  presenting actually needs."
- Scene line: "AfterNow's stage. Everything floating in this room is a
  slide — Jeff just doesn't believe slides should be rectangles."

**(g) Portals.** ← S2 Perception Lab (gold). → S5 Lightworks (green). ⇵ S4
via the Vive (cyan; the manifest `entryPortals` still lists S4 so Proxie
teleports work — its visible form is the headset, not a ring).

**(h) Open questions.**
- Which real Prez sample images/videos can I pull as stage slides? (Site
  shows CarCityLaser, MarsRover, DataVisualization, HandRaise — a
  `video` prop of the actual Prez trailer on a hologram panel would be
  gold and costs zero tokens.)
- Malta NDA check: is the representation-spectrum image cleared as-is
  (it's on your public site, so I assume yes)?
- Gear wall: own a real Vive/HoloLens photoset for Tripo conditioning?

**Audio (Mint):**
- Ambient loop: `dark theater room tone with a soft airy synth pad, very
  quiet electrical hum, spacious reverb, calm anticipation, no melody,
  seamless loop`
- SFX 1 (performance): `holographic interface bloom, glassy shimmer rising
  swell, one-shot`
- SFX 2 (Vive don): `virtual reality headset powering on, soft fabric
  rustle then a deep digital whoosh into silence, one-shot`

---

### S4 — SECOND STUDIO: THE CONSTRUCT
`career/scene-02-second-studio-construct` (reframe of collaborative-vr-studio)

**(a) Concept + hero moment — REDESIGNED 2026-07-19 from Jeff's real
Second Studio footage.** Original design (abstract teal wireframe void)
replaced: Jeff's actual product ran on a **floating mountaintop
platform** — real sky, snow-capped peaks, clouds below, a simple modern
deck with a guardrail, a work table with colorful low-poly furniture
mid-sculpt, floating reference-photo panels, a "Save Scene" UI panel.
You are *inside the Vive*: real, grounded, breathtaking, not abstract.
Recreating Second Studio's full grab-a-tool-and-sculpt mechanic was
judged too much scope for one scene among five — the interaction is
deliberately simpler. **Hero moment:** walk up to and around a
**human-scale (1.8m) sculpted hero model** standing on the platform —
a stylized skyscraper, the kind of thing a Second Studio user might
have designed — silhouetted against the mountain panorama. Simple,
grounded, and it *is* the real product's mission (architectural/spatial
design, sculpted in VR) made walkable rather than a rebuilt tool system.

**(b) World generation — RESOLVED: Marble, not Mint.** The mountain
vista is photoreal territory — Marble's strength, not Mint's stylized
lane (that reasoning applied to the OLD abstract-void concept, not this
one). This also settles NEXT_STEPS decision 6.

**World prompt (v1):**
```
A modern minimalist observation platform floating high above a dramatic
snow-capped mountain range, camera at standing eye height near the
platform's center. Endless jagged peaks stretch to the horizon under a
bright daytime sky, soft clouds drifting in the valleys far below. The
platform is a simple pale circular deck with a low glass guardrail at
the edge, open to the sky and mountains on all sides -- no walls, no
roof. A plain wooden work table with two simple modern chairs sits to
one side, unoccupied. The deck is clean, minimal, and flat, walkable in
every direction, at least eight meters across. Palette: pale platform
grey, warm wood table, crisp white clouds, cool blue-grey mountain rock,
bright open sky. Atmosphere: high-altitude clarity, thin drifting mist
at the platform edge, quiet vastness. No people, no readable text or
logos, no furniture beyond the one table and two chairs, not indoors,
not nighttime, not a city skyline.
```

**2D pre-viz (Mint image):**
```
Minimalist circular observation platform floating above snow-capped
mountains, glass guardrail, clouds drifting below, bright open sky, one
simple wood table with two chairs, clean modern deck, first-person
eye-level, photoreal.
```

**(c) Props.**

| Prop | Source | Generation prompt / file |
|---|---|---|
| Platform, mountains, sky, table+chairs | Marble-baked | (world prompt) |
| Skyscraper sculpture (HERO, human-scale) | Tripo GLB | `stylized modern skyscraper architectural model, 1.8 meters tall, clean geometric facade, small rooftop details, display-quality miniature, game ready` — the walk-around centerpiece |
| Floating reference-photo panels | custom (engineer) | flat `image` props, small (~0.3m), a few scattered at working height near the table -- set dressing only, no generation needed beyond simple placeholder crops |
| "Save Scene" panel | custom (engineer) | flat `image`/text panel, small, near the table edge -- Easter egg / gaze placard, non-functional |
| Wireframe windmill (far) | Tripo GLB | reuse S1 windmill GLB, placed as a tiny detail on the horizon silhouette (optional, stretch) |
| Delft-blue voxel tulip | Tripo GLB | `stylized tulip flower built from small cubes, delft blue and white ceramic pattern, game ready` — small sculpture on the table |

**Stretch garnish (optional, only if time allows -- NOT the hero
anymore):** two translucent collaborator avatars frozen mid-gesture near
the table (`stylized translucent human figure, smooth featureless
surface, game ready` x2), *gaze-dwell* triggers a quiet head-turn + nod
(cheap, reuses the existing gaze-glow-style effect, no new system) —
kept as ambient life, NOT wired to a tool-handoff/spline-drawing
mechanic (that whole system is cut from scope, see TECH_SPEC).

**(d) Interactive elements.**

1. **Walk the skyscraper (HERO)** — no trigger needed beyond walking
   around it; *gaze-dwell* on it triggers a subtle glow/highlight
   (existing Interactive framework, zero new code) so it reads as
   inspectable. **Non-VR:** identical, desktop gaze ray.
2. **Voxel tulip gaze-glint** — small discoverable detail on the table,
   same glow-on-gaze treatment as other worlds' garnish props.
3. *(Stretch only)* **Avatar gaze-wake** — see above, cut from hero
   status but cheap enough to keep as ambient flavor if time allows.
4. **Remove headset (exit)** — a floating Vive rests at the platform's
   edge; *pickup/click* = "taking the headset off": reverse fade to S3,
   same mechanic as putting it on (TECH_SPEC §C.1). Also *proximity*
   prompt after 4 minutes idle ("Proxie: whenever you're ready — the
   stage is still there").

**(e) Easter eggs.** The "Save Scene" panel (functionless nostalgia —
placard explains it was real UI); scattered reference-photo panels near
the table (glimpses of what was being designed); the Delft-blue voxel
tulip; optional distant wireframe windmill silhouette on the horizon (the
Netherlands follows Jeff even to a mountaintop).

**(f) Proxie placards.**

- **Skyscraper sculpture** — "This is what Second Studio was built for:
  architects, designers, and creators sculpting real spatial ideas in
  VR, at true scale. Jeff was VP of Product — walk around this one the
  way a client would have, checking proportions from every angle."
- **"Save Scene" panel** — "Real UI, frozen in time. Every session here
  ended with a click on a panel exactly like this one."
- **Reference-photo panels** — "Second Studio users often sculpted
  against real photo references pinned right in the air beside their
  work — no separate monitor needed."
- **Voxel tulip** — "Someone sculpted a Delft-blue tulip and left it
  running. No further comment from the Dutchman."
- Scene line: "This is the inside of the Vive you just put on — Second
  Studio, one of the first SaaS VR collaboration platforms, where Jeff
  was VP of Product. A mountaintop studio, because why sculpt indoors?"

**(g) Portals.** ⇵ S3 only (the floating Vive = exit; `entryPortals:
["scene-01-holo-stage"]`). Deliberately a cul-de-sac: nested worlds should
feel nested.

**(h) Open questions.**
- ~~Mint vs Marble~~ RESOLVED: Marble (photoreal mountain vista).
- The Second Studio trailer exists on the site — want it floating near
  the table as a `video` prop "memory screen," or does live footage
  break the dream?
- Any real Second Studio brand color to hit precisely on the table/chairs?
- Skyscraper sculpture: fine as a generic stylized building, or is there
  a specific real building/design language you'd want referenced?

**Audio (Mint):**
- Ambient loop: `high altitude open air, soft steady wind, distant faint
  clouds movement, quiet vast mountain silence, no music, seamless loop`
- SFX 1 (skyscraper gaze-glow): `soft architectural glass chime, gentle
  rising tone, one-shot`
- SFX 2 (Vive doff/exit): `virtual reality headset removal, soft fabric
  rustle, deep digital whoosh into silence, one-shot`

---

### S5 — LIGHTWORKS
`career/scene-03-lightworks` (merge of datacenter-training +
optical-computing + Even Realities alcove)

**(a) Concept + hero moment.**
Microsoft years + the AI frontier in one cathedral of machine light: a
dark datacenter gallery, two long walls of server racks breathing green
LED heartbeats, cold 6500K spill and visible haze. Three zones along one
walkable nave. **Zone 1 — Training Bay:** one rack under a projection-
mapped spotlight, a server sled half-out, a parts cart beside it: the
NDA-safe *simulation of the simulation* — you do the repair his trainees
did. **Zone 2 — Projector Gallery:** four gaming projectors on tripods
aimed at one big wall, each casting a slice of binary grid. **Zone 3 —
Frontier Alcove:** a small warm-lit **desk** (REVISED from "shelf" per
Jeff's reference render, 2026-07-19), out of place in the machine room —
a triangular faceted lamp glowing beside it — holding a pair of Even
Realities glasses that catch the lamp light (subtle gaze-glow affordance
draws the eye, per the reference).
**Hero moment (Zone 2, RESOLVED):** each projector alone throws
unreadable binary noise. Turn all four on and the overlapping grids
**sum into Jeff's own portrait made of light** (Even Realities G2/R1
review photo, bit-plane decomposition — see TECH_SPEC §F, validated and
approved 2026-07-19) — brightness levels adding exactly the way his
optical all-reduce research added GPU data streams. Watching noise
resolve into his face as you flip the fourth projector is the "staring
at the Matrix" moment Jeff described — now the visitor gets to feel it.
Click the resolved portrait to open his real G2/R1 review video.

**(b) Marble world prompt (v1):**
```
Interior of a dark modern data center aisle, camera at standing eye height
in the center of a wide central walkway. Two long rows of tall black
server racks with dense green and occasional amber LED points, cool
white-blue overhead strip lighting, visible thin haze catching the light.
At the far end of the walkway, one large clean matte white wall section,
empty and evenly lit dimly, like a projection screen. Midway along one
side, a single rack stands under a focused warm spotlight with a work area
in front of it and space for a small cart. Near the entrance, a small
recessed alcove with a small wooden desk and warm amber lamp lighting,
contrasting with the cold room. Polished dark concrete floor, completely flat and walkable, central
walkway at least four meters wide and fifteen meters long. Palette: black
racks, emerald green LEDs, cold white-blue light, one warm amber alcove.
Atmosphere: deep server hum implied, cathedral-like, slightly hazy. No
people, no readable text or logos, no cable mess on the floor, no ceiling
clutter, not a hallway with doors, not an office.
```
Iteration note: the empty white end-wall and the warm alcove are the two
load-bearing features — if v1 drops either, v2 leads with them. Dark
scenes are splat-risky (see generation order): if blacks come out muddy,
v2 raises ambient to "dim blue-grey" and we darken in the renderer.

**2D pre-viz (Mint image):**
```
Dark data center aisle, long rows of black server racks with emerald green
LED points, hazy cold blue light, one rack under a warm spotlight with a
pulled-out server sled, large blank white projection wall at the far end,
small warm-lit alcove near the viewer, cinematic, photoreal, eye-level.
```

**(c) Props.**

| Prop | Source | Generation prompt / file |
|---|---|---|
| Datacenter, racks, white wall, alcove | Marble-baked | (world prompt) |
| Server sled (interactive) | Tripo GLB | `open server chassis sled with visible motherboard, RAM slots, fans and one removable component bay, game ready` |
| Faulty module (grabbable) | Tripo GLB | `computer memory module with a scorched dark mark, game ready` — engineer adds pulsing red emissive |
| Replacement module (grabbable) | Tripo GLB | `clean new computer memory module, green circuit board, game ready` |
| Parts cart | Tripo GLB | `small metal service cart with foam-lined top tray, game ready` |
| 4 projectors on tripods | Tripo GLB (one, instanced) | `compact gaming projector on a tripod stand with glowing lens, game ready` |
| Baked bit-plane mask texture | custom bake script | RESOLVED: bit-plane decomposition of `planning/reference/cats/profileProjection.jpg` (Jeff's Even Realities review portrait), 80x80 grid, 5 luminance levels — see TECH_SPEC §F. Not a Mint generation. |
| Desk + lamp (Zone 3) | Marble-baked or Tripo GLB | REVISED from "shelf": small desk with a triangular faceted warm-lit lamp beside it — see Jeff's reference render, `planning/reference/s5-lightworks/` (pending push) |
| Even Realities G2 glasses | Tripo GLB | `minimalist smart glasses with thin rectangular frames, subtle temple modules, matte black finish, resting on a desk, game ready` — image-condition from Jeff's review video stills + reference render |
| Retroreflective-marker mannequin hand | Tripo GLB | `mannequin hand on a stand with small reflective tape dots on fingertips, game ready` |
| DGX Spark rack slice | Mint image | `small gold-bronze compact supercomputer in a server rack slot, flat texture` as an `image` prop on one rack + placard |
| Cat #3 shadow rig | custom (engineer) | animated cutout occluder crossing a projector beam — no asset generation needed beyond a cat silhouette texture (Mint: `walking cat silhouette, side view, flat black on white, texture`) |

**(d) Interactive elements.**

1. **Server repair sim (Zone 1)** — *click* the sled → slides out with a
   rack-clack; projection-mapped guidance (a light overlay on the sled —
   his actual training tech, quoted visually) draws an arrow to the
   red-pulsing faulty module. *Pickup* faulty module → place on cart foam;
   *pickup* replacement → socket glows green as you near, clicks in →
   whole rack's LEDs ripple from amber to green down the aisle (the
   payoff visible from anywhere in the room). **Non-VR fallback:** it's a
   3-click sequence: sled, faulty part, new part. NDA-safe: generic
   hardware, invented layout, no real procedures — "a simulation of the
   simulation."
2. **The Sum of Light (HERO, Zone 2, RESOLVED)** — each projector has a
   chunky glowing toggle: *click* (or *hand-wave through its beam* — wave
   requirement, second instance) flips its grid on/off. 1-3 projectors:
   genuine resolving noise (bit-plane decomposition, validated). All 4:
   the grids' brightness sums resolve into **Jeff's own portrait**
   (Even Realities G2/R1 review photo, 80x80 grid), held steady. Turn one
   off, it collapses to noise again — cause and effect is the lesson.
   Clicking the resolved portrait opens `youtu.be/sEDTmvGg-QY` (Jeff's
   real G2/R1 review video) in a new tab. **Non-VR:** click toggles.
3. **Even Realities try-on (Zone 3, Jeff's verbatim ask, REVISED AGAIN)**
   — glasses rest on a **desk** beside a warm-lit lamp (not a shelf),
   with a *gaze-glow* affordance drawing the eye per Jeff's reference
   render. *Pickup* the glasses → screen-edge fade, then a **monochrome
   green HUD** composites over your view as ONE head-locked panel
   (matches the real G2's binocular fusion — not two per-eye renders).
   The HUD is now **9 real screen captures from Jeff's actual simulator**
   (RECEIVED, `planning/reference/s5-lightworks/hud-captures/`): loading/
   title, welcome menu, starred items, sessions list, session detail,
   speakers list, speaker detail, expo list, expo detail — real speaker
   names/companies, real booth numbers, transparent PNGs so the alcove
   shows through around the green UI just like a real see-through
   display — genuine app content, not invented copy. *Click the
   left/right third of the panel to page between the 9 screens* (Jeff's
   "swipe between them" ask, delivered as click-zones —
   same spatial pattern as the PhD mini-game's screen-third steering, so
   the app has one consistent "click sides of a panel" language). *Pickup
   again / click center* to take them off. **Non-VR:** click toggles;
   arrow keys or click-left/right-third also page.
4. **Rack gaze-breath** — *gaze-dwell* on any rack makes its LED column
   breathe brighter toward you, a wave following your gaze down the aisle.
   Cheap, gorgeous, satisfies "lights up when looked at" in the career
   world too. **Non-VR:** desktop gaze ray.

**(e) Easter eggs.** The resolved portrait itself (a very meta easter
egg — Jeff's own face made of light, in the room about light-as-a-tool);
the retroreflective-dot mannequin hand by the training bay ("Yes, I put
retroreflective tape on my fingers and forehead" — placard quotes him
verbatim); the DGX Spark slice in one rack — gaze placard reveals Proxie
himself lives in this building, technically; one orange tulip in a
zip-tie "vase" on the parts cart; cat #3's shadow occasionally crossing a
projector beam (the only cat you never quite see); the HUD notification
in Dutch.

**(f) Proxie placards.**

- **Server sled** — "Microsoft trained datacenter technicians on Jeff's
  projection-mapped simulator: real spatial guidance, zero risk to
  million-dollar hardware. This is a simulation of that simulation — the
  real procedures stay under NDA. The broken part won't fix itself."
- **Projection guidance overlay** — "Body tracking plus projection mapping:
  instructions that land on the hardware itself instead of a manual.
  Trainees used it from day one with, in the client's words, zero bugs
  since deployment."
- **Projectors** — "Jeff's optical computing research, playable: four
  projectors, four data streams, and light itself does the addition.
  One projector is noise. Four is an answer. Try it."
- **The sum wall** — "In the real system, overlapping projected grids
  summed GPU data mid-air — an optical all-reduce for AI training that
  skips the usual sequential collect-and-sum: instead of gathering each
  sender's data one at a time, the sum appears in a single parallel
  glance. Papers pending; the light is already convinced. Watch closely
  — the fourth projector reveals more than data."
- **Even Realities glasses** — "Jeff's current frontier: AI on your face.
  He built a real SIGGRAPH 2026 guide app for these — schedule, sessions,
  his own contact info — all on a monochrome green HUD. Put them on;
  you're at the venue."
- **Retroreflective hand** — "Marker-based object tracking, hackathon
  style. Jeff's own words: 'Yes, I put retroreflective tape on my fingers
  and forehead.'"
- **DGX Spark slice** — "A DGX Spark, like the one humming under Jeff's
  desk right now — the machine I live on. Small world."
- Scene line: "Five Microsoft engagements and the road to AI, told in
  light: light that teaches, light that computes, and light you can wear."

**(g) Portals.** ← S3 Holo Stage (cyan). → S1 Hangar (gold, at the far end
past the projector wall — the loop closes: from light made of math back to
sunlight on a polder).

**(h) Open questions.**
- ~~Reveal image~~ RESOLVED: Jeff's own G2/R1 portrait, bit-plane
  decomposition, 80x80 grid.
- NDA comfort check on the whole Zone 1 framing — I've kept hardware
  generic and procedures invented; still open, see tracker.
- ~~G1 HUD content~~ RESOLVED: real SIGGRAPH 2026 guide app branding
  from Jeff's reference render (wordmark, dates, byline) — no more
  placeholder schedule copy. Green tone: match the render's phosphor
  green.
- `veel succes` line: dropped now that real app content is in — replaced
  by nothing in particular; revisit if a companion Easter-egg notification
  is still wanted.

**Audio (Mint):**
- Ambient loop: `dense data center server hum, layered fan whir, deep
  electrical drone, cold cavernous room tone, no music, seamless loop`
- SFX 1 (repair): `metal server sled sliding out with a firm click clack,
  one-shot` + `small component click into socket with confirming double
  beep, one-shot`
- SFX 2 (sum wall): `four-note rising synth chord locking into a warm
  resolved drone, one-shot` (fires when the 4th projector completes the
  image)
- SFX 3 (glasses): `soft UI chirp, retro green-phosphor beep, gentle,
  one-shot`

---

## 4. GLOBAL AUDIO (one-time)

- Portal whoosh (all scenes, Mint): `short teleport whoosh, airy with a
  soft harmonic tail, not aggressive, one-shot`
- Vive don/doff already in S3/S4 SFX above.
Audio manager is feature-queue item 3 — hand this list to the engineer as
its content spec. Total: 5 loops + ~10 one-shots ≈ well within Mint
budget alongside images (see budget).

---

## 5. GENERATION ORDER — front-load the risk

Assumption: Marble ≈ 9-world budget, Tripo arriving tomorrow, Mint 12k
live now. Rule: **nothing expensive before its cheap pre-viz passes.**

**Tonight / first thing (Mint images — cheap, do all five):**
1. Pre-viz S5 Lightworks (darkness risk for splats)
2. Pre-viz S1 Hangar (aircraft-fidelity risk)
3. Pre-viz S4 Construct (RESOLVED direction, low risk now — mountain
   vistas are squarely photoreal Marble territory)
4. Pre-viz S2 + S3 (low risk, sanity only)
→ ~10 image generations including one retry each ≈ small Mint spend.

**Marble worlds, in this order (each: generate → orientation check →
commit spz+collider → log in prompts.md). All five now go through Marble
— S4's Mint-vs-Marble question is RESOLVED (Marble; 42k tokens confirmed
loaded, well clear of a 5-world budget):**
1. **S1 Hangar** — first Marble run doubles as the pipeline shakedown
   (splat orientation flip, collider walk test) on our highest-wow scene;
   if aircraft fail we learn earliest, with the tarp fallback ready.
2. **S5 Lightworks** — the darkness experiment; needs slack for a v2.
3. **S4 Construct** — mountain-vista platform, low risk, simple geometry.
4. **S2 Perception Lab** — low risk, two-bench layout may need a v2.
5. **S3 Holo Stage** — lowest risk (simple geometry, empty shelf).
Budget math: 5 Marble runs against 42k tokens — comfortably banked for
retries, weighted toward S1/S5.

**Tripo queue (Pro month confirmed — hero interactions first):**
1. Data glove (image-conditioned from the received sensor diagram — S2
   hero#2 blocker, art direction RESOLVED: black fabric, white sensor
   line on the middle finger)
2. HTC Vive (image-conditioned from the received product shot — S3 hero,
   the door)
3. Even Realities G2 (image-conditioned from the received portrait — S5
   finale)
4. Rubber hand + brush + hammer (S2 hero#1 set)
5. Server sled + modules (S5 zone 1)
6. Skyscraper sculpture (S4 hero, REVISED from sculpting-tool+avatars —
   simpler scope, see S4 redesign)
7. HoloLens 2, Quest, projectors
8. Cats ×3 + wireframe cat, windmill, RISE award, garnish props
9. Proxie avatar (or Mint animation-set path per NEXT_STEPS) — parallel
   track with the engineer, since anim-states gate the rubber-hand hero.
Ring palette and the two S4 collaborator avatars are CUT from the queue
(stretch-only if time allows — see S4 redesign).

**Engineer's custom-build priorities (flagged feasibility items):**
1. Render-to-texture island mini-game (S2 — riskiest custom build; video
   fallback specced; island styled after Jeff's real Unity screenshot —
   rope bridge, torii-style arch, mossy hills)
2. Additive projector planes + sum reveal (S5 hero — shader-simple, test
   early anyway)
3. G2 HUD screen-space carousel (S5) — content RESOLVED, 9 real app
   screens
4. Vive-don/doff transition overlay reusing teleport (S3⇵S4)
5. Proxie anim states: idle / twitch / flinch / nod
6. Data-glove finger-curl animation synced to flex/pinch/click input
   (small addition, both platforms — see S2 rig)
7. Audio manager (queue item 3, spec above)
~~Spline-ribbon drawing (S4)~~ CUT from scope — the tool-handoff/drawing
mechanic is dropped in favor of the simpler walk-around-the-skyscraper
hero; keep only if there's spare time as a stretch garnish, not on the
critical path.

**Token pools CONFIRMED 2026-07-19:** Mint 12k · Marble (World Labs) 42k
· Tripo3D one month Pro (verification pending, see NEXT_STEPS). All
comfortably clear of the 5-Marble-world + full Tripo-queue + Mint-audio
budget below — coupons/credits check is effectively resolved by having
real numbers rather than needing the Notion page.

**Mint 12k rough allocation:** pre-viz images ~1.5k · audio (5 loops + 11
SFX) ~3k · flat-texture props ~1k · Proxie avatar/animation contingency
~2k · **reserve ~4.5k** (S4 no longer needs a Mint-world allocation now
that it's Marble). Coefficients are guesses, not hard limits.

---

## 6. OPEN QUESTIONS FOR JEFF

**All 7 original blocking decisions resolved as of 2026-07-19** — see
`planning/asset-tracker.xlsx`/`.csv` (Phase 0 rows) for the live record:
entry scene (S1), cats cast + photos, S5 reveal image (real bit-plane
portrait), Proxie yelp (approved), S5 NDA pass (approved w/ one
correction), reference photos (received — data glove, Vive, mini-game
island, Second Studio env; RNLAF/Prez still welcome, not blocking), and
S4 world-gen path (Marble, resolved via the Second Studio redesign
below). Remaining small open items are noted inline in each scene's
section (h): Second Studio trailer placement, brand-color precision,
skyscraper sculpture styling.

Everything above is drafted to drop straight into per-scene `prompts.md`
files and a restructured `src/manifest.js` the moment generation starts.
Don't hold back was the brief — this is five rooms I'd genuinely want to
get lost in. Tot morgen.
