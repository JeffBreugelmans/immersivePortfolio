// manifest.js
//
// Single source of truth for the World -> Scene -> Portal structure.
// The frontend reads this to build the scene loader + portal hotspots.
// Proxie (the chat agent) should be given the same "id" values so it can
// trigger a teleport by returning { action: "teleport", sceneId: "..." }
// alongside its chat reply. Keep ids stable once Proxie is wired up.
//
// ROSTER (RESTRUCTURED 2026-07-19, docs/WORLD_DESIGNS.md): 9 scenes
// consolidated to 5 flagship scenes across 2 worlds. See that doc for
// full concept/prompt/prop/interaction detail per scene; this file is
// just the runtime structure.
//
// Folder convention: each scene's assets live at
//   public/<worldId>/<sceneId>/marble/scene.spz    <- Marble Gaussian splat
//                                                     (500k variant; committed)
//   public/<worldId>/<sceneId>/marble/collider.glb <- Marble low-detail
//                                                     collision mesh (XR
//                                                     locomotion surface)
//   public/<worldId>/<sceneId>/reference/          <- your reference photos
//                                                     (Marble PROMPT tuning
//                                                     inputs only -- stays
//                                                     local, gitignored)
//   public/<worldId>/<sceneId>/props/              <- everything in "props"
//                                                     below lives here
//   public/<worldId>/<sceneId>/prompts.md          <- prompt iteration notes
//
// Until a scene's real scene.spz exists, the app falls back to the
// committed sample splat at public/placeholder/scene.spz (from the SensAI
// template) so every scene is walkable from day one.
//
// Asset paths below are built from import.meta.env.BASE_URL rather than
// hardcoded absolute paths. BASE_URL reflects vite.config.ts's "base"
// setting (currently "/worlds/", since the app is served under /worlds on
// the Spark) -- this keeps every reference correct automatically if the
// hosting path ever changes, instead of needing to update N hardcoded
// strings here.
//
// "entryPortals" describes which other scenes this scene has a visible
// portal/teleport point to, so you can wire hub navigation without
// hardcoding it in scene code. Portal graph (WORLD_DESIGNS §1):
//   S1 Hangar <-> S2 Perception Lab <-> S3 Holo Stage <-> S5 Lightworks
//                                          <-> (Vive) S4 Second Studio
//   S5 Lightworks <-> S1 Hangar (loop closes: jet engines to light engines)
// S4 is a cul-de-sac -- only reachable via the Vive wearable-teleport
// prop in S3 (TECH_SPEC C.1), not a ring portal; its entryPortals still
// lists S3 so window.teleportTo/Proxie can still jump there directly.
//
// "props" is an optional list of additional assets layered into the scene
// on top of the main Marble environment (splat). Three sources feed this,
// and the app doesn't care which one a given prop came from -- they all
// end up as plain files under props/ and get rendered the same way:
//   - World Labs Marble: the whole-room environment (the top-level "splat"
//     field, not a prop) -- best for the space itself.
//   - Tripo (or similar): focused single-object models -- best for a
//     specific recognizable product/prop that a whole-room generation
//     wouldn't render accurately (e.g. the actual Even Realities glasses).
//   - Your own existing assets: any GLB you already have, plus 2D images
//     or video you want physically present in the scene (e.g. a screen
//     playing a demo reel) -- distinct from reference/, which is only
//     ever prompt-tuning input, never rendered.
//
// Each prop entry:
//   { id, kind: "glb" | "image" | "video", src,
//     source: "marble" | "tripo" | "custom",
//     label, description?,
//     position: [x, y, z], rotation?: [xDeg, yDeg, zDeg],
//     scale?: number | [x, y, z], width?, height?,
//     interaction?: { click?, gaze?, wave?, pickup? },  -- see src/interactions.ts
//     role?: string }  -- routing key for feature systems (wearables, HUD, etc.)
// "source" is documentation only. "label" + "description" feed the gaze
// context system (src/gazeContext.ts): when a visitor looks at the prop
// and asks Proxie about it, this text is what Proxie gets told the
// visitor is looking at -- write it like a museum placard, one or two
// sentences. width/height apply to image and video (plane dimensions in
// meters); scale/rotation apply to glb. Position is required for all
// kinds (three.js Y-up, meters, [0,0,0] = scene center at floor level).
//
// Large binaries (a big video file, a heavy custom GLB) belong here
// rather than reference/ since these ship in the built app -- but check
// file size before committing. GitHub rejects anything over 100MB outright
// and anything in the tens-of-MB range will slow every future clone. If a
// prop file is large, flag it -- we may want to rsync it to the Spark
// directly instead of routing it through git.

const BASE = import.meta.env.BASE_URL; // e.g. "/worlds/"

// Shared SFX library (AudioManagerSystem, src/audio.ts). Interaction
// configs reference these by key: interaction.click.sfx = "click".
// Files come from Mint generation (see planning/asset-tracker) -- missing
// files no-op silently, so keys can be wired before assets exist.
export const sfxLibrary = {
  "portal-whoosh": `${BASE}shared/audio/portal-whoosh.mp3`,
  "hud-blip": `${BASE}shared/audio/hud-blip.mp3`,
  click: `${BASE}shared/audio/click.mp3`,
  chime: `${BASE}shared/audio/chime.mp3`,
  hum: `${BASE}shared/audio/hum.mp3`,
  "headset-don": `${BASE}shared/audio/headset-don.mp3`,
  lever: `${BASE}shared/audio/lever.mp3`,
  // Mint-generated one-shots (2026-07-18): portal-whoosh above is now a
  // real file too, no longer a placeholder.
  "chinook-whomp": `${BASE}shared/audio/chinook-whomp.mp3`,
  "lamp-click": `${BASE}shared/audio/lamp-click.mp3`,
  "hologram-bloom": `${BASE}shared/audio/hologram-bloom.mp3`,
  "vive-don": `${BASE}shared/audio/vive-don.mp3`,
};

export const worlds = [
  {
    id: "roots",
    title: "Roots -- Netherlands & the Path to Human-Centered Design",
    scenes: [
      {
        id: "scene-01-hangar-polder",
        title: "The Hangar on the Polder",
        description:
          "Royal Netherlands Air Force maintenance hangar at golden hour -- F-16, Chinook, doors open onto a Dutch polder with a turning windmill. Where Jeff's engineering story begins.",
        // ?v= busts the year-long immutable browser cache after a Marble
        // regen -- bump it whenever scene/collider files are replaced.
        splat: `${BASE}roots/scene-01-hangar-polder/marble/scene.spz?v=2`,
        collider: `${BASE}roots/scene-01-hangar-polder/marble/collider.glb?v=2`,
        ambient: `${BASE}roots/scene-01-hangar-polder/audio/ambient.mp3`,
        // Regenerated 2026-07-18 from Jeff's empty-hangar reference plate
        // (v2: empty interior, Chinook outside on the apron). Orientation
        // and scale re-tuned below via headless screenshots.
        // After Jeff's -54 env rotation the hero view (F-16 nose + open
        // doors + sunset) sits at yaw 90 -- spawn facing it.
        spawnYawDeg: 90,
        envScale: 1,
        // Squares the splat+collider with the axis-aligned walk bounds
        // (Marble's camera wasn't square to the hangar). Tune live in
        // ?edit with [ / ], then bake the panel's number here.
        envYawDeg: -54,
        // Full-res 2M-splat variant (gitignored, rsync'd to the Spark --
        // see DEPLOYMENT.md): served to desktop browsers; Quest and
        // anything missing the file falls back to the 500k scene.spz.
        splatHiRes: `${BASE}roots/scene-01-hangar-polder/marble/scene-fullres.spz?v=2`,
        // Walkable sweet zone (meters, centered on spawn; 4x4 is also the
        // code default). Splat quality collapses a few meters out from the
        // generation camera, so the visitor stays behind safety tape --
        // fitting for a maintenance floor.
        walkBounds: { width: 8, depth: 8 },
        entryPortals: ["scene-02-perception-lab", "scene-03-lightworks"],
        // Layout (regen 2026-07-18, spawnYaw 0): roundel wall to the LEFT
        // (-x), open hangar doors + Chinook + sunset to the RIGHT (+x),
        // deep interior ahead (-z). Splat is empty inside by design; the
        // F-16 and service props below are real GLBs -- the hackathon's
        // splat+model composite. Prop y = height ABOVE the raycast floor
        // (Mint GLBs are unit-normalized with center origin, so y is
        // half-height x scale).
        props: [
          {
            id: "f16-hero",
            kind: "glb",
            source: "mint",
            src: `${BASE}assets/mint/f16-hero/original_glb.glb`,
            label: "RNLAF F-16 Fighting Falcon",
            description:
              "A Royal Netherlands Air Force F-16 -- the aircraft Jeff worked around during his RNLAF internship, where maintenance efficiency became his first engineering obsession.",
            // Jeff's final ?edit layout 2026-07-18 (scale 7.8 = display
            // model size rather than 1:1, his call -- fits the splat
            // hangar's proportions better).
            position: [-6.52, 1.46, -1.36],
            rotation: [0, 155, 0],
            scale: [10.833, 8.12, 8.12],
            interaction: { pickup: false },
          },
          {
            id: "s1-maintenance-stand",
            kind: "glb",
            source: "mint",
            src: `${BASE}assets/mint/s1-hangar-props/asset_pack_item_glb-vd74sdj4ynbc52j4f7q2vf80hs8at9jd-2-ks7558zknhj961pc1vbddkn6ys8attm1.glb`,
            label: "Maintenance stand",
            position: [-2.72, 1.02, -5.53],
            rotation: [0, -90, 0],
            scale: 2.0,
            interaction: { pickup: false },
          },
          {
            id: "s1-tool-chest",
            kind: "glb",
            source: "mint",
            src: `${BASE}assets/mint/s1-hangar-props/asset_pack_item_glb-vd74sdj4ynbc52j4f7q2vf80hs8at9jd-0-ks7f3eq57gt9vzhy6shssz978x8atrpq.glb`,
            label: "Tool chest",
            position: [-4.96, 0.76, -4.0],
            rotation: [0, 90, 0],
            scale: 1.6,
            interaction: { pickup: false },
          },
          {
            id: "s1-tool-cart",
            kind: "glb",
            source: "mint",
            src: `${BASE}assets/mint/s1-hangar-props/asset_pack_item_glb-vd74sdj4ynbc52j4f7q2vf80hs8at9jd-1-ks75ntgtawfasbh139bw1r9fd98avrmn.glb`,
            label: "Tool cart",
            position: [-5.16, 0.64, 1.47],
            rotation: [0, 25, 0],
            scale: 1.332,
            interaction: { pickup: false },
          },
          {
            id: "s1-workbench",
            kind: "glb",
            source: "mint",
            src: `${BASE}assets/mint/s1-hangar-props/asset_pack_item_glb-vd74sdj4ynbc52j4f7q2vf80hs8at9jd-3-ks75d8gtbp23cc4qdmpqgvd4rn8avgdy.glb`,
            label: "Workbench",
            position: [-7.2, 0.46, -7.5],
            rotation: [0, 90, 0],
            scale: 1.1,
            interaction: { pickup: false },
          },
          {
            id: "s1-hose-reel",
            kind: "glb",
            source: "mint",
            src: `${BASE}assets/mint/s1-hangar-props/asset_pack_item_glb-vd74sdj4ynbc52j4f7q2vf80hs8at9jd-4-ks781kx485bz6a78bs1pwf821d8avm7d.glb`,
            label: "Air hose reel",
            position: [-3.29, 0.84, 3.52],
            rotation: [0, 90, 0],
            scale: 1.602,
            interaction: { pickup: false },
          },
          {
            id: "placard-rnlaf-internship",
            kind: "placard",
            source: "custom",
            title: "Where It Started",
            text:
              "During his Bachelor's in Electrical Engineering, Jeff interned with the Royal Netherlands Air Force, working on maintenance efficiency and repair task scheduling -- his first taste of engineering for the people who keep complex machines flying.",
            label: "RNLAF internship placard",
            position: [5.12, 1.72, -5.54],
            rotation: [0, 90, 0],
            width: 0.9,
            scale: 3.415,
          },
        ],
      },
      {
        id: "scene-02-perception-lab",
        title: "The Perception Lab",
        description:
          "One research lab spanning Jeff's Master's (rubber hand illusion) and PhD (eye-tracker + data-glove accessibility rig) -- Eindhoven on one bench, Northeastern on the other.",
        splat: `${BASE}roots/scene-02-perception-lab/marble/scene.spz`,
        collider: `${BASE}roots/scene-02-perception-lab/marble/collider.glb`,
        splatHiRes: `${BASE}roots/scene-02-perception-lab/marble/scene-fullres.spz`,
        ambient: `${BASE}roots/scene-02-perception-lab/audio/ambient.mp3`,
        // Marble generated the lab at ~40% size (collider showed a 1.38m
        // floor-to-ceiling at origin); 2.5x restores a ~3.5m ceiling and
        // puts the 1.6m eye height back inside the room.
        envScale: 2.5,
        // Jeff's ?edit alignment pass 2026-07-19 (rotation only; bench
        // props still need re-placement against the rotated splat).
        envYawDeg: 31,
        entryPortals: ["scene-01-hangar-polder", "scene-01-holo-stage"],
        // Flex-lamp desk toy (TECH_SPEC G, simplified fallback):
        // dataGloveFx.ts spawns a procedural lamp here once the scene's
        // `role: "data-glove"` prop exists -- no separate asset, position
        // is a placeholder next to the (not-yet-generated) PhD bench,
        // tune alongside the glove once it lands via `?edit`.
        flexLamp: { position: [1.6, 0.75, -1.8] },
        props: [
          {
            id: "rubber-hand",
            kind: "glb",
            source: "tripo",
            src: `${BASE}roots/scene-02-perception-lab/props/rubber-hand.glb`,
            label: "Rubber hand",
            description:
              "The rubber hand illusion: stroke the fake hand while your real hand is hidden behind the partition, and your brain adopts it as its own. The heart of Jeff's Master's research on body ownership at TU Eindhoven.",
            // Lying palm-down on the left bench, cuff toward the baked
            // partition (real-illusion staging hides the arm's cut end).
            // Bench props use TINY y: the per-prop ground ray hits the
            // desk top (it's in the collider), so y is height above THAT.
            position: [-2.3, 0.04, -1.6],
            rotation: [-90, 0, 0],
            scale: 0.45,
            interaction: {
              pickup: false,
              gaze: { dwellMs: 600, effect: "glow" },
              click: { effect: "pulse" },
            },
          },
          {
            id: "paintbrush",
            kind: "glb",
            source: "tripo",
            src: `${BASE}roots/scene-02-perception-lab/props/paintbrush.glb`,
            label: "Paintbrush",
            description:
              "The experimenter's brush -- in the rubber hand illusion this strokes the fake hand and the hidden real one in sync.",
            position: [-1.9, 0.03, -1.2],
            rotation: [-90, 0, 25],
            scale: 0.25,
            interaction: {
              gaze: { dwellMs: 600, effect: "glow" },
              click: { effect: "pulse" },
            },
          },
          {
            id: "reflex-hammer",
            kind: "glb",
            source: "tripo",
            src: `${BASE}roots/scene-02-perception-lab/props/reflex-hammer.glb`,
            label: "Reflex hammer",
            description:
              "The experimenter's reflex hammer. Once the illusion takes hold, a sudden tap toward the rubber hand makes people flinch for a hand that isn't theirs.",
            position: [-2.0, 0.03, -2.1],
            rotation: [-90, 0, -30],
            scale: 0.22,
            interaction: {
              gaze: { dwellMs: 600, effect: "glow" },
              click: { effect: "pulse" },
            },
          },
          {
            // PhD bench (Northeastern), generated 2026-07-19 from Jeff's
            // real glove photo (API queue). `role: "data-glove"` routes to
            // dataGloveFx.ts: click to don, flex (hold-click desktop /
            // squeeze XR) drives the flexLamp. Retune via ?edit.
            id: "data-glove",
            kind: "glb",
            source: "tripo",
            src: `${BASE}roots/scene-02-perception-lab/props/data-glove.glb`,
            label: "Data glove -- flex to bring the lamp up",
            description:
              "The sensor-laden data glove from Jeff's PhD at Northeastern. Click it to put it on, then flex your hand -- exactly how it once turned a hand gesture into a continuous accessibility signal -- and watch the desk lamp answer.",
            position: [3.2, 1.43, 0],
            rotation: [0, -20, 0],
            scale: 1.142,
            snapToGround: false, // desk collider coverage is unreliable
            role: "data-glove",
            interaction: {
              pickup: false,
              gaze: { dwellMs: 600, effect: "glow" },
              click: { effect: "pulse", sfx: "chime" },
            },
          },
          {
            id: "tobii-eyetracker",
            kind: "glb",
            source: "tripo",
            src: `${BASE}roots/scene-02-perception-lab/props/tobii-eyetracker.glb`,
            label: "Tobii eye tracker",
            description:
              "The eye-tracker bar from Jeff's PhD rig -- it watched where players looked so games could be driven by gaze alone, no hands needed. The Boston Globe covered it: 'Eye-tracking video game device subs for mouse.'",
            position: [3.24, 1.52, -1.15],
            rotation: [0, -10, 0],
            scale: 0.827,
            snapToGround: false,
            interaction: {
              pickup: false,
              gaze: { dwellMs: 600, effect: "glow" },
            },
          },
          {
            id: "smart-lamp",
            kind: "glb",
            source: "tripo",
            src: `${BASE}roots/scene-02-perception-lab/props/smart-lamp.glb`,
            label: "Smart lamp",
            description:
              "A Hue-style smart lamp -- an Eindhoven joke that writes itself: Jeff studied human-technology interaction in Philips' hometown. Wave at it.",
            position: [3.32, 1.48, -2.11],
            scale: 0.692,
            snapToGround: false,
            interaction: {
              pickup: false,
              gaze: { dwellMs: 600, effect: "glow" },
              wave: { radius: 0.5, effect: "cycle-color", sfx: "chime" },
              click: { effect: "cycle-color", sfx: "chime" },
            },
          },
          {
            id: "placard-perception-lab",
            kind: "placard",
            source: "custom",
            title: "The Perception Lab",
            text:
              "Two chapters of research share this room. On the left bench: the rubber hand illusion from Jeff's Master's at TU Eindhoven -- stroke a fake hand in sync with a hidden real one and the brain claims it as its own. On the right: his PhD at Northeastern, where eye trackers and a sensor-laden data glove turned video games into rehabilitation and accessibility tools.",
            label: "Perception Lab placard",
            position: [1.8, 1.3, -3.2],
            rotation: [0, -30, 0],
            width: 0.9,
            scale: 2.5,
          },
        ],
      },
    ],
  },
  {
    id: "career",
    title: "XR & AI -- Building the Future of Work",
    scenes: [
      {
        id: "scene-01-holo-stage",
        title: "The Holo Stage",
        description:
          "AfterNow Prez as a dark presentation theater -- podium HoloLens, floating hologram exhibits including Project Malta, a gear wall of headsets through the years.",
        splat: `${BASE}career/scene-01-holo-stage/marble/scene.spz`,
        collider: `${BASE}career/scene-01-holo-stage/marble/collider.glb`,
        splatHiRes: `${BASE}career/scene-01-holo-stage/marble/scene-fullres.spz`,
        ambient: `${BASE}career/scene-01-holo-stage/audio/ambient.mp3`,
        // Marble under-scale (collider floor -0.58 at origin) -> 2.76x
        // restores a 1.6m eye height.
        envScale: 2.76,
        // Jeff's ?edit pass 2026-07-19 ("progress placement"): rotation +
        // video/placard placed; shelf headsets still need re-placement
        // against the rotated splat.
        envYawDeg: 87,
        // Stage ended up on the -x side after the rotation; face it.
        spawnYawDeg: 90,
        entryPortals: ["scene-02-perception-lab", "scene-03-lightworks", "scene-02-second-studio-construct"],
        props: [
          {
            id: "htc-vive",
            kind: "glb",
            source: "tripo",
            src: `${BASE}career/scene-01-holo-stage/props/htc-vive.glb`,
            label: "HTC Vive -- put it on",
            description:
              "The original HTC Vive: the headset Second Studio's collaborative VR sculpting ran on. Click it to put it on and step into the Construct.",
            position: [3.0, 1.35, 0],
            rotation: [0, 90, 0],
            scale: 0.5,
            snapToGround: false,
            interaction: {
              pickup: false,
              gaze: { dwellMs: 600, effect: "glow" },
              click: { effect: "pulse", sfx: "vive-don" },
            },
            // Wearable-teleport (TECH_SPEC C.1): clicking the headset
            // plays the don animation (wearableFx.ts) -- off the shelf,
            // 180 flip, over your head, slide down -- then fades into
            // the world it used to render. Returning flies it back.
            teleportTo: "scene-02-second-studio-construct",
            wearable: true,
          },
          {
            // Gear wall neighbors (T036/T038): the museum shelf becomes
            // "headsets through the years" -- HoloLens left, Vive center
            // (THE DOOR), Quest 3 right.
            id: "hololens-2",
            kind: "glb",
            source: "tripo",
            src: `${BASE}career/scene-01-holo-stage/props/hololens-2.glb`,
            label: "Microsoft HoloLens 2",
            description:
              "The HoloLens 2 -- AfterNow's home platform. Prez presentations ran on this: holographic slides you walk around, pinned to the real room.",
            position: [3.0, 1.3, -1.1],
            rotation: [0, 90, 0],
            scale: 0.4,
            snapToGround: false,
            interaction: {
              pickup: false,
              gaze: { dwellMs: 600, effect: "glow" },
            },
          },
          {
            id: "quest-3",
            kind: "glb",
            source: "tripo",
            src: `${BASE}career/scene-01-holo-stage/props/quest-3.glb`,
            label: "Meta Quest 3",
            description:
              "Meta Quest 3 -- the headset this very portfolio is built for. If you are reading this inside one: hello, you found the recursion.",
            position: [3.0, 1.3, 1.1],
            rotation: [0, 90, 0],
            scale: 0.4,
            snapToGround: false,
            interaction: {
              pickup: false,
              gaze: { dwellMs: 600, effect: "glow" },
            },
          },
          {
            id: "prez-video",
            kind: "video",
            source: "custom",
            src: `${BASE}career/scene-01-holo-stage/props/prez-demo.mp4`,
            label: "Prez in action",
            description:
              "The AfterNow Prez trailer: presentations that are places -- walk-around holographic slides, 3D exhibits and data you stand inside, delivered on HoloLens.",
            position: [-9.53, 2.49, -0.22],
            rotation: [0, 55, 0],
            scale: 1.92,
            width: 3.2,
            height: 1.8,
          },
          {
            id: "placard-holo-stage",
            kind: "placard",
            source: "custom",
            title: "The Holo Stage",
            text:
              "At AfterNow, Jeff built Prez: a holographic presentation platform for HoloLens that turns slides into spaces. Instead of projecting flat rectangles, presenters stage 3D exhibits around the room -- cars, Mars rovers, living data -- and walk their audience through them.",
            label: "Holo Stage placard",
            position: [-0.44, 2.14, 4.29],
            rotation: [0, 140, 0],
            width: 0.9,
            scale: 3.199,
          },
        ],
      },
      {
        id: "scene-02-second-studio-construct",
        title: "Second Studio: The Construct",
        description:
          "Inside the Vive you just put on -- a mountaintop observation platform where Second Studio's VR sculpting tools once ran. Walk around a human-scale skyscraper sculpture.",
        splat: `${BASE}career/scene-02-second-studio-construct/marble/scene.spz`,
        collider: `${BASE}career/scene-02-second-studio-construct/marble/collider.glb`,
        splatHiRes: `${BASE}career/scene-02-second-studio-construct/marble/scene-fullres.spz`,
        ambient: `${BASE}career/scene-02-second-studio-construct/audio/ambient.mp3`,
        // Marble generated this one OVER-scale (deck 3.76m below the
        // camera); 0.43x brings the eye back to standing height.
        envScale: 0.43,
        // Cul-de-sac: reachable via the Vive wearable-teleport prop in
        // scene-01-holo-stage (TECH_SPEC C.1), not a ring portal. Listed
        // here so window.teleportTo / Proxie can still jump directly.
        entryPortals: ["scene-01-holo-stage"],
        props: [
          {
            id: "second-studio-video",
            kind: "video",
            source: "custom",
            // Self-hosted 640x360 remux of the jeffxr.com/work/second-studio
            // clip -- cross-origin video can't feed a WebGL texture, so
            // the file lives in public/. Muted+looping (autoplay-safe).
            src: `${BASE}career/scene-02-second-studio-construct/props/second-studio-demo.mp4`,
            label: "Second Studio in action",
            description:
              "Real footage of Second Studio's collaborative VR sculpting -- the software this mountaintop construct ran on. Multiple artists sharing one virtual space, sculpting at human scale.",
            position: [4.24, 1.89, 0.03],
            rotation: [0, -35, 0],
            width: 3.2,
            height: 1.8,
            scale: 1.517,
          },
          {
            id: "placard-second-studio",
            kind: "placard",
            source: "custom",
            title: "Second Studio: The Construct",
            text:
              "Second Studio was collaborative VR creation: multiple artists sharing one virtual space, sculpting and building at human scale, walking around work-in-progress like it was already real. This platform above the peaks recreates that feeling -- a studio with no walls, where the only limit is what you can imagine standing inside.",
            label: "Second Studio placard",
            position: [0.09, 1.36, 2.93],
            rotation: [0, 40, 0],
            width: 0.9,
            scale: 2.5,
          },
        ],
      },
      {
        id: "scene-03-lightworks",
        title: "Lightworks",
        description:
          "A datacenter cathedral in three zones: server-repair training bay, four-projector optical-computing gallery, and the Even Realities frontier desk. Light that teaches, light that computes, light you can wear.",
        splat: `${BASE}career/scene-03-lightworks/marble/scene.spz`,
        collider: `${BASE}career/scene-03-lightworks/marble/collider.glb`,
        splatHiRes: `${BASE}career/scene-03-lightworks/marble/scene-fullres.spz`,
        ambient: `${BASE}career/scene-03-lightworks/audio/ambient.mp3`,
        // Marble under-scale (collider floor -0.64 at origin) -> 2.5x.
        envScale: 2.5,
        // Self-running bit-plane exhibit on the baked white end-wall
        // (projectorWall.ts): position tuned via headless screenshots.
        // Jeff's ?edit placement 2026-07-19: panel on the right rack
        // face, mid-aisle. Export was floor-relative (y 1.58) + uniform
        // scale 0.398 on the 4.5m plane -- baked here as absolute y
        // (S5 floor -1.6) and real dimensions.
        projectorWall: {
          position: [3.38, -0.02, 0.44],
          rotationYDeg: -90,
          width: 1.79,
          height: 1.79,
        },
        entryPortals: ["scene-01-holo-stage", "scene-01-hangar-polder"],
        props: [
          {
            id: "placard-lightworks",
            kind: "placard",
            source: "custom",
            title: "Lightworks",
            text:
              "Light that teaches, light that computes, light you can wear. Jeff's current chapter: immersive training inside working datacenters, research into computing with overlapping projections -- watch the wall at the end of the aisle, where four noisy projectors sum into a portrait in a single optical step (papers pending) -- and everyday smart glasses that put a quiet green HUD in your line of sight.",
            label: "Lightworks placard",
            position: [-2.83, 1.3, 0.48],
            rotation: [0, -30, 0],
            width: 0.9,
            scale: 2.5,
          },
        ],
      },
    ],
  },
];

// Flat lookup used by the scene loader and the portal/teleport component.
export const sceneById = Object.fromEntries(
  worlds.flatMap((world) =>
    world.scenes.map((scene) => [scene.id, { ...scene, worldId: world.id, worldTitle: world.title }])
  )
);

// Chronological entry point (WORLD_DESIGNS open question #1, RESOLVED
// 2026-07-19): start at the hangar, not career-first.
export const defaultSceneId = "scene-01-hangar-polder";
