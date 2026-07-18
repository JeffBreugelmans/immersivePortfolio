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
        splat: `${BASE}roots/scene-01-hangar-polder/marble/scene.spz`,
        collider: `${BASE}roots/scene-01-hangar-polder/marble/collider.glb`,
        ambient: `${BASE}roots/scene-01-hangar-polder/audio/ambient.mp3`,
        entryPortals: ["scene-02-perception-lab", "scene-03-lightworks"],
        props: [],
      },
      {
        id: "scene-02-perception-lab",
        title: "The Perception Lab",
        description:
          "One research lab spanning Jeff's Master's (rubber hand illusion) and PhD (eye-tracker + data-glove accessibility rig) -- Eindhoven on one bench, Northeastern on the other.",
        splat: `${BASE}roots/scene-02-perception-lab/marble/scene.spz`,
        collider: `${BASE}roots/scene-02-perception-lab/marble/collider.glb`,
        ambient: `${BASE}roots/scene-02-perception-lab/audio/ambient.mp3`,
        entryPortals: ["scene-01-hangar-polder", "scene-01-holo-stage"],
        props: [],
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
        ambient: `${BASE}career/scene-01-holo-stage/audio/ambient.mp3`,
        entryPortals: ["scene-02-perception-lab", "scene-03-lightworks", "scene-02-second-studio-construct"],
        props: [],
      },
      {
        id: "scene-02-second-studio-construct",
        title: "Second Studio: The Construct",
        description:
          "Inside the Vive you just put on -- a mountaintop observation platform where Second Studio's VR sculpting tools once ran. Walk around a human-scale skyscraper sculpture.",
        splat: `${BASE}career/scene-02-second-studio-construct/marble/scene.spz`,
        collider: `${BASE}career/scene-02-second-studio-construct/marble/collider.glb`,
        ambient: `${BASE}career/scene-02-second-studio-construct/audio/ambient.mp3`,
        // Cul-de-sac: reachable via the Vive wearable-teleport prop in
        // scene-01-holo-stage (TECH_SPEC C.1), not a ring portal. Listed
        // here so window.teleportTo / Proxie can still jump directly.
        entryPortals: ["scene-01-holo-stage"],
        props: [],
      },
      {
        id: "scene-03-lightworks",
        title: "Lightworks",
        description:
          "A datacenter cathedral in three zones: server-repair training bay, four-projector optical-computing gallery, and the Even Realities frontier desk. Light that teaches, light that computes, light you can wear.",
        splat: `${BASE}career/scene-03-lightworks/marble/scene.spz`,
        collider: `${BASE}career/scene-03-lightworks/marble/collider.glb`,
        ambient: `${BASE}career/scene-03-lightworks/audio/ambient.mp3`,
        entryPortals: ["scene-01-holo-stage", "scene-01-hangar-polder"],
        props: [],
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
