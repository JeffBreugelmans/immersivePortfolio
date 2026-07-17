// scene-manager.js
//
// Loads the current scene's Marble glTF export, places portal hotspots for
// every connected scene (per manifest.js "entryPortals"), and exposes
// window.teleportTo(sceneId) so both portal clicks and Proxie chat
// responses can trigger a scene change through the same path.

import { sceneById, defaultSceneId } from "./manifest.js";

const PORTAL_RADIUS = 2.5;

// Portals are placed PORTAL_RADIUS from scene center (see the angle math
// below), so spawning at dead center on every load guarantees you're
// PORTAL_RADIUS away from all of them -- well outside portal.js's
// PROXIMITY_TRIGGER_DISTANCE (1.3m). Confirmed bug without this: teleport
// never used to move the camera, so walking into scene A's portal at e.g.
// (0, 1.2, -2.5) could land you inside scene B with ITS portal back to A
// placed at that exact same coordinate (both computed the same way, by
// index, independent of which direction you arrived from) -- an instant
// re-trigger loop the moment the cooldown below expired. If you ever
// shrink PORTAL_RADIUS, keep it well above PROXIMITY_TRIGGER_DISTANCE.
const SPAWN_POSITION = "0 1.6 0";

// portal.js triggers on proximity (walking through a portal), not just
// click. Without a cooldown, the frame right after loadScene() runs
// (before the new portal entities exist yet) shouldn't be judged at all.
// Must stay >= however long a teleport-request round trip (event ->
// loadScene -> new portals mounted) takes -- 1.5s is generous. The real
// bounce-prevention is SPAWN_POSITION above; this is just a small buffer
// on top of it.
const POST_TELEPORT_COOLDOWN_MS = 1500;

export function initSceneManager() {
  const root = document.querySelector("#current-scene-root");
  const portalRoot = document.querySelector("#portal-root");
  const sceneLabel = document.querySelector("#scene-label");
  const cameraRig = document.querySelector("#camera-rig");

  let currentSceneId = null;

  function loadScene(sceneId) {
    const scene = sceneById[sceneId];
    if (!scene) {
      console.warn(`[scene-manager] Unknown sceneId "${sceneId}" -- check manifest.js`);
      return;
    }
    currentSceneId = sceneId;

    root.innerHTML = "";
    portalRoot.innerHTML = "";

    // Marble export. Until a real scene.glb is dropped into
    // public/worlds/<world>/<scene>/marble/, this 404s quietly in the
    // console and you'll just see the fallback ground below -- expected
    // for scenes you haven't generated yet.
    const model = document.createElement("a-entity");
    model.setAttribute("gltf-model", scene.glb);
    model.setAttribute("shadow", "receive: true");
    root.appendChild(model);

    const ground = document.createElement("a-plane");
    ground.setAttribute("rotation", "-90 0 0");
    ground.setAttribute("width", 30);
    ground.setAttribute("height", 30);
    ground.setAttribute("color", "#222");
    root.appendChild(ground);

    scene.entryPortals.forEach((targetId, i) => {
      const angle = (i / Math.max(scene.entryPortals.length, 1)) * Math.PI * 2;
      const x = Math.sin(angle) * PORTAL_RADIUS;
      const z = -Math.cos(angle) * PORTAL_RADIUS;

      const portal = document.createElement("a-entity");
      portal.setAttribute("portal-hotspot", {
        targetScene: targetId,
        label: sceneById[targetId]?.title ?? targetId,
      });
      portal.setAttribute("position", `${x} 1.2 ${z}`);
      portalRoot.appendChild(portal);
    });

    if (sceneLabel) {
      sceneLabel.textContent = `${scene.worldTitle} -- ${scene.title}`;
    }

    if (cameraRig) {
      cameraRig.setAttribute("position", SPAWN_POSITION);
    }

    window.__portalCooldownUntil = Date.now() + POST_TELEPORT_COOLDOWN_MS;

    window.dispatchEvent(new CustomEvent("scene-changed", { detail: { sceneId, scene } }));
  }

  window.addEventListener("teleport-request", (e) => loadScene(e.detail.sceneId));
  window.teleportTo = loadScene;

  loadScene(defaultSceneId);

  return { getCurrentSceneId: () => currentSceneId };
}
