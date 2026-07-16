// scene-manager.js
//
// Loads the current scene's Marble glTF export, places portal hotspots for
// every connected scene (per manifest.js "entryPortals"), and exposes
// window.teleportTo(sceneId) so both portal clicks and Proxie chat
// responses can trigger a scene change through the same path.

import { sceneById, defaultSceneId } from "./manifest.js";

const PORTAL_RADIUS = 2.5;

export function initSceneManager() {
  const root = document.querySelector("#current-scene-root");
  const portalRoot = document.querySelector("#portal-root");
  const sceneLabel = document.querySelector("#scene-label");

  let currentSceneId = null;

  function loadScene(sceneId) {
    const scene = sceneById[sceneId];
    if (!scene) {
      console.warn(`[scene-manager] Unknown sceneId "${sceneId}" — check manifest.js`);
      return;
    }
    currentSceneId = sceneId;

    root.innerHTML = "";
    portalRoot.innerHTML = "";

    // Marble export. Until a real scene.glb is dropped into
    // public/worlds/<world>/<scene>/marble/, this 404s quietly in the
    // console and you'll just see the fallback ground below — expected
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
      sceneLabel.textContent = `${scene.worldTitle} — ${scene.title}`;
    }

    window.dispatchEvent(new CustomEvent("scene-changed", { detail: { sceneId, scene } }));
  }

  window.addEventListener("teleport-request", (e) => loadScene(e.detail.sceneId));
  window.teleportTo = loadScene;

  loadScene(defaultSceneId);

  return { getCurrentSceneId: () => currentSceneId };
}
