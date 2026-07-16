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
      },
      {
        id: "scene-02-smart-glasses-lab",
        title: "Even Realities Product Lab",
        description: "Even Realities smart glasses work -- minimalist eyewear product design lab",
        glb: `${BASE}afternow/scene-02-smart-glasses-lab/marble/scene.glb`,
        entryPortals: ["scene-01-holographic-studio", "scene-03-collaborative-vr-studio"],
      },
      {
        id: "scene-03-collaborative-vr-studio",
        title: "Second Studio",
        description: "Second Studio collaborative VR design -- shared virtual studio, translucent avatars",
        glb: `${BASE}afternow/scene-03-collaborative-vr-studio/marble/scene.glb`,
        entryPortals: ["scene-02-smart-glasses-lab"],
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
      },
      {
        id: "scene-02-datacenter-training",
        title: "Data Center Technician Training",
        description: "Data center technician training -- projection-mapped server racks, 3D printer",
        glb: `${BASE}microsoft-consulting/scene-02-datacenter-training/marble/scene.glb`,
        entryPortals: ["scene-01-hybrid-telepresence", "scene-03-optical-computing"],
      },
      {
        id: "scene-03-optical-computing",
        title: "Optical Computing / Photonics",
        description: "Optical computing / photonics -- Matrix-style glowing binary grid server room",
        glb: `${BASE}microsoft-consulting/scene-03-optical-computing/marble/scene.glb`,
        entryPortals: ["scene-02-datacenter-training"],
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
      },
      {
        id: "scene-02-tu-eindhoven",
        title: "TU Eindhoven Research Lab",
        description: "Rubber hand illusion setup + navigation/route-planning trust research",
        glb: `${BASE}education/scene-02-tu-eindhoven/marble/scene.glb`,
        entryPortals: ["scene-01-raf-hangar", "scene-03-northeastern"],
      },
      {
        id: "scene-03-northeastern",
        title: "Northeastern University Lab",
        description: "Driving simulator rig + eye-tracking/data-glove research",
        glb: `${BASE}education/scene-03-northeastern/marble/scene.glb`,
        entryPortals: ["scene-02-tu-eindhoven"],
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
