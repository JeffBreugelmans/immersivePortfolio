// manifest.js
//
// Single source of truth for the World -> Scene -> Portal structure.
// The frontend reads this to build the scene loader + portal hotspots.
// Proxie (the chat agent) should be given the same "id" values so it can
// trigger a teleport by returning { action: "teleport", sceneId: "..." }
// alongside its chat reply. Keep ids stable once Proxie is wired up.
//
// Folder convention: each scene's assets live at
//   public/<worldId>/<sceneId>/marble/scene.glb   <- Marble export goes here
//   public/<worldId>/<sceneId>/reference/         <- your reference photos
//                                                     (Marble PROMPT tuning
//                                                     inputs only -- stays
//                                                     local, gitignored)
//   public/<worldId>/<sceneId>/props/             <- everything in "props"
//                                                     below lives here
//   public/<worldId>/<sceneId>/prompts.md         <- prompt iteration notes
//
// Asset paths below are built from import.meta.env.BASE_URL rather than
// hardcoded absolute paths. BASE_URL reflects vite.config.js's "base"
// setting (currently "/worlds/", since the app is served under /worlds on
// the Spark) -- this keeps every reference correct automatically if the
// hosting path ever changes, instead of needing to update N hardcoded
// strings here.
//
// "entryPortals" describes which other scenes this scene has a visible
// portal/teleport point to, so you can wire hub navigation without
// hardcoding it in scene code.
//
// "props" is an optional list of additional assets layered into the scene
// on top of the main Marble environment (glb above). Three sources feed
// this, and the app doesn't care which one a given prop came from -- they
// all end up as plain files under props/ and get rendered the same way:
//   - World Labs Marble: the whole-room environment (the top-level "glb"
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
//   { id, kind: "glb" | "image" | "video", src, source: "marble" | "tripo" | "custom",
//     position, rotation?, scale?, width?, height? }
// "source" is documentation only (shows up in comments/metadata, doesn't
// change rendering) -- it's there so six months from now it's still
// obvious which pipeline produced which file. width/height apply to
// image and video (plane dimensions in meters); scale/rotation apply to
// glb. Position is required for all kinds.
//
// Large binaries (a big video file, a heavy custom GLB) belong here
// rather than reference/ since these ship in the built app -- but check
// file size before committing. GitHub rejects anything over 100MB outright
// and anything in the tens-of-MB range will slow every future clone. If a
// prop file is large, flag it -- we may want to rsync it to the Spark
// directly instead of routing it through git.

const BASE = import.meta.env.BASE_URL; // e.g. "/worlds/"

export const worlds = [
  {
    id: "afternow",
    title: "AfterNow",
    scenes: [
      {
        id: "scene-01-holographic-studio",
        title: "Holographic Presentation Studio",
        description: "Prez immersive presentations -- holographic presentation studio, HoloLens on podium",
        glb: `${BASE}afternow/scene-01-holographic-studio/marble/scene.glb`,
        entryPortals: ["scene-02-smart-glasses-lab"],
        props: [],
      },
      {
        id: "scene-02-smart-glasses-lab",
        title: "Even Realities Product Lab",
        description: "Even Realities smart glasses work -- minimalist eyewear product design lab",
        glb: `${BASE}afternow/scene-02-smart-glasses-lab/marble/scene.glb`,
        entryPortals: ["scene-01-holographic-studio", "scene-03-collaborative-vr-studio"],
        props: [],
      },
      {
        id: "scene-03-collaborative-vr-studio",
        title: "Second Studio",
        description: "Second Studio collaborative VR design -- shared virtual studio, translucent avatars",
        glb: `${BASE}afternow/scene-03-collaborative-vr-studio/marble/scene.glb`,
        entryPortals: ["scene-02-smart-glasses-lab"],
        props: [],
      },
    ],
  },
  {
    id: "microsoft-consulting",
    title: "Microsoft Consulting",
    scenes: [
      {
        id: "scene-01-hybrid-telepresence",
        title: "Hybrid Telepresence Meeting",
        description: "Hybrid telepresence meetings -- video/VR/in-person attendees at one table",
        glb: `${BASE}microsoft-consulting/scene-01-hybrid-telepresence/marble/scene.glb`,
        entryPortals: ["scene-02-datacenter-training"],
        props: [],
      },
      {
        id: "scene-02-datacenter-training",
        title: "Data Center Technician Training",
        description: "Data center technician training -- projection-mapped server racks, 3D printer",
        glb: `${BASE}microsoft-consulting/scene-02-datacenter-training/marble/scene.glb`,
        entryPortals: ["scene-01-hybrid-telepresence", "scene-03-optical-computing"],
        props: [],
      },
      {
        id: "scene-03-optical-computing",
        title: "Optical Computing / Photonics",
        description: "Optical computing / photonics -- Matrix-style glowing binary grid server room",
        glb: `${BASE}microsoft-consulting/scene-03-optical-computing/marble/scene.glb`,
        entryPortals: ["scene-02-datacenter-training"],
        props: [],
      },
    ],
  },
  {
    id: "education",
    title: "Education (stretch)",
    scenes: [
      {
        id: "scene-01-raf-hangar",
        title: "Royal Netherlands Air Force Hangar",
        description: "RNLAF maintenance hangar -- F-16s, Chinook, industrial lighting",
        glb: `${BASE}education/scene-01-raf-hangar/marble/scene.glb`,
        entryPortals: ["scene-02-tu-eindhoven"],
        props: [],
      },
      {
        id: "scene-02-tu-eindhoven",
        title: "TU Eindhoven Research Lab",
        description: "Rubber hand illusion setup + navigation/route-planning trust research",
        glb: `${BASE}education/scene-02-tu-eindhoven/marble/scene.glb`,
        entryPortals: ["scene-01-raf-hangar", "scene-03-northeastern"],
        props: [],
      },
      {
        id: "scene-03-northeastern",
        title: "Northeastern University Lab",
        description: "Driving simulator rig + eye-tracking/data-glove research",
        glb: `${BASE}education/scene-03-northeastern/marble/scene.glb`,
        entryPortals: ["scene-02-tu-eindhoven"],
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

export const defaultSceneId = worlds[0].scenes[0].id;
