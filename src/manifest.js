// manifest.js
//
// Single source of truth for the World -> Scene -> Portal structure.
// The frontend reads this to build the scene loader + portal hotspots.
// Proxie (the chat agent) should be given the same "id" values so it can
// trigger a teleport by returning { action: "teleport", sceneId: "..." }
// alongside its chat reply. Keep ids stable once Proxie is wired up.
//
// Folder convention: each scene's assets live at
//   public/worlds/<worldId>/<sceneId>/marble/scene.glb   <- Marble export goes here
//   public/worlds/<worldId>/<sceneId>/reference/         <- your reference photos
//   public/worlds/<worldId>/<sceneId>/prompts.md         <- prompt iteration notes
//
// "entryPortals" describes which other scenes this scene has a visible
// portal/teleport point to, so you can wire hub navigation without
// hardcoding it in scene code.

export const worlds = [
  {
    id: "afternow",
    title: "AfterNow",
    scenes: [
      {
        id: "scene-01-holographic-studio",
        title: "Holographic Presentation Studio",
        description: "Prez immersive presentations — holographic presentation studio, HoloLens on podium",
        glb: "/worlds/afternow/scene-01-holographic-studio/marble/scene.glb",
        entryPortals: ["scene-02-smart-glasses-lab"],
      },
      {
        id: "scene-02-smart-glasses-lab",
        title: "Even Realities Product Lab",
        description: "Even Realities smart glasses work — minimalist eyewear product design lab",
        glb: "/worlds/afternow/scene-02-smart-glasses-lab/marble/scene.glb",
        entryPortals: ["scene-01-holographic-studio", "scene-03-collaborative-vr-studio"],
      },
      {
        id: "scene-03-collaborative-vr-studio",
        title: "Second Studio",
        description: "Second Studio collaborative VR design — shared virtual studio, translucent avatars",
        glb: "/worlds/afternow/scene-03-collaborative-vr-studio/marble/scene.glb",
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
        description: "Hybrid telepresence meetings — video/VR/in-person attendees at one table",
        glb: "/worlds/microsoft-consulting/scene-01-hybrid-telepresence/marble/scene.glb",
        entryPortals: ["scene-02-datacenter-training"],
      },
      {
        id: "scene-02-datacenter-training",
        title: "Data Center Technician Training",
        description: "Data center technician training — projection-mapped server racks, 3D printer",
        glb: "/worlds/microsoft-consulting/scene-02-datacenter-training/marble/scene.glb",
        entryPortals: ["scene-01-hybrid-telepresence", "scene-03-optical-computing"],
      },
      {
        id: "scene-03-optical-computing",
        title: "Optical Computing / Photonics",
        description: "Optical computing / photonics — Matrix-style glowing binary grid server room",
        glb: "/worlds/microsoft-consulting/scene-03-optical-computing/marble/scene.glb",
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
        description: "RNLAF maintenance hangar — F-16s, Chinook, industrial lighting",
        glb: "/worlds/education/scene-01-raf-hangar/marble/scene.glb",
        entryPortals: ["scene-02-tu-eindhoven"],
      },
      {
        id: "scene-02-tu-eindhoven",
        title: "TU Eindhoven Research Lab",
        description: "Rubber hand illusion setup + navigation/route-planning trust research",
        glb: "/worlds/education/scene-02-tu-eindhoven/marble/scene.glb",
        entryPortals: ["scene-01-raf-hangar", "scene-03-northeastern"],
      },
      {
        id: "scene-03-northeastern",
        title: "Northeastern University Lab",
        description: "Driving simulator rig + eye-tracking/data-glove research",
        glb: "/worlds/education/scene-03-northeastern/marble/scene.glb",
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
