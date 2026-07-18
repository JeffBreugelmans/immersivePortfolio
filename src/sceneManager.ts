// sceneManager.ts
//
// IWSDK port of the old scene-manager.js. Loads the current scene's
// Marble Gaussian splat (with the committed placeholder splat as a
// fallback until a real scene.spz is generated), spawns portal hotspots
// for every connected scene (per manifest.js "entryPortals"), renders any
// "props", and exposes window.teleportTo(sceneId) so both portal triggers
// and Proxie chat responses can change scenes through the same path.
//
// Window-event contract (unchanged from the A-Frame version, plus one):
//   "teleport-request" (in)  -> load that scene
//   "scene-loading"    (out) -> a swap started (drives the loading overlay)
//   "scene-changed"    (out) -> swap done (chat overlay, controls, overlay)

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  DistanceGrabbable,
  EnvironmentType,
  Interactable,
  LocomotionEnvironment,
  LocomotionSystem,
  MovementMode,
  type Entity,
  type World,
} from "@iwsdk/core";
import { GaussianSplatLoader, GaussianSplatLoaderSystem } from "./gaussianSplatLoader";
import { createPortal } from "./portals";
import { registerGazeTarget, unregisterGazeTarget } from "./gazeContext";
import { fadeThrough } from "./fade";
import {
  attachClickTrigger,
  registerInteractive,
  unregisterInteractive,
  type InteractionConfig,
} from "./interactions";
import { sceneById, defaultSceneId } from "./manifest.js";

const PORTAL_RADIUS = 2.5;

// Portals are placed PORTAL_RADIUS from scene center, so spawning at dead
// center on every load guarantees you're PORTAL_RADIUS away from all of
// them -- well outside the 1.3m proximity trigger. This plus the cooldown
// below is what prevents the teleport bounce-loop (see the long comment in
// the old scene-manager.js for the war story). If you ever shrink
// PORTAL_RADIUS, keep it well above the proximity distance.
const POST_TELEPORT_COOLDOWN_MS = 1500;

const PLACEHOLDER_SPLAT = `${import.meta.env.BASE_URL}placeholder/scene.spz`;

declare global {
  interface Window {
    teleportTo?: (sceneId: string) => void;
  }
}

function disposeObject3D(root: THREE.Object3D | undefined | null): void {
  if (!root) return;
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh || (child as THREE.Sprite).isSprite) {
      mesh.geometry?.dispose?.();
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        (material as THREE.Material & { map?: THREE.Texture | null })?.map?.dispose?.();
        material?.dispose?.();
      }
    }
  });
}

const gltfLoader = new GLTFLoader();

async function spawnCollider(world: World, url: string): Promise<Entity | null> {
  try {
    const gltf = await gltfLoader.loadAsync(url);
    gltf.scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) child.visible = false;
    });
    return world
      .createTransformEntity(gltf.scene)
      .addComponent(LocomotionEnvironment, { type: EnvironmentType.STATIC });
  } catch {
    // Expected until a real collider.glb is generated for the scene; the
    // invisible 100x100 floor in index.ts keeps XR teleport working.
    return null;
  }
}

interface PropEntry {
  id: string;
  kind: "glb" | "image" | "video";
  src: string;
  source?: string;
  label?: string;
  description?: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
  width?: number;
  height?: number;
  interaction?: InteractionConfig;
  role?: string;
}

async function spawnProp(world: World, prop: PropEntry, sceneId: string): Promise<Entity | null> {
  let object3D: THREE.Object3D;
  let cleanupVideo: HTMLVideoElement | null = null;

  switch (prop.kind) {
    case "glb": {
      try {
        const gltf = await gltfLoader.loadAsync(prop.src);
        object3D = gltf.scene;
      } catch {
        // Same 404-quietly behavior as the old scene-manager: safe to list
        // props in the manifest before the actual asset exists.
        return null;
      }
      if (prop.scale !== undefined) {
        const s = prop.scale;
        if (Array.isArray(s)) object3D.scale.set(...s);
        else object3D.scale.setScalar(s);
      }
      break;
    }
    case "image": {
      const texture = await new THREE.TextureLoader().loadAsync(prop.src).catch(() => null);
      if (!texture) return null;
      texture.colorSpace = THREE.SRGBColorSpace;
      object3D = new THREE.Mesh(
        new THREE.PlaneGeometry(prop.width ?? 1, prop.height ?? 1),
        new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, transparent: true })
      );
      break;
    }
    case "video": {
      const video = document.createElement("video");
      video.src = prop.src;
      video.crossOrigin = "anonymous";
      video.loop = true;
      video.muted = true; // required for autoplay
      video.playsInline = true;
      video.play().catch(() => {});
      const texture = new THREE.VideoTexture(video);
      texture.colorSpace = THREE.SRGBColorSpace;
      object3D = new THREE.Mesh(
        new THREE.PlaneGeometry(prop.width ?? 1.6, prop.height ?? 0.9),
        new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide })
      );
      cleanupVideo = video;
      break;
    }
    default:
      console.warn(`[sceneManager] Unknown prop kind "${(prop as PropEntry).kind}" for prop "${prop.id}" -- skipping`);
      return null;
  }

  object3D.position.set(...prop.position);
  if (prop.rotation) {
    object3D.rotation.set(
      THREE.MathUtils.degToRad(prop.rotation[0]),
      THREE.MathUtils.degToRad(prop.rotation[1]),
      THREE.MathUtils.degToRad(prop.rotation[2])
    );
  }
  object3D.userData.propId = prop.id;
  object3D.userData.propSource = prop.source ?? "unknown";
  if (cleanupVideo) object3D.userData.video = cleanupVideo;

  const entity = world.createTransformEntity(object3D).addComponent(Interactable);
  if (prop.kind === "glb" && prop.interaction?.pickup !== false) {
    // Hand-grabbable in XR (hand tracking / controllers); inert on desktop
    // where the grab system doesn't run. `interaction.pickup: false` opts
    // out (e.g. a monitor shouldn't be stealable).
    entity.addComponent(DistanceGrabbable, {
      movementMode: MovementMode.MoveAtSource,
      translate: true,
      rotate: true,
      scale: false,
    });
  }

  if (prop.interaction) {
    registerInteractive(object3D, prop.id, sceneId, prop.interaction);
    if (prop.interaction.click) attachClickTrigger(world, object3D, prop.id);
  }

  registerGazeTarget(object3D, {
    id: prop.id,
    label: prop.label ?? prop.id,
    description: prop.description,
  });

  return entity;
}

export interface SceneManager {
  getCurrentSceneId: () => string | null;
}

export function initSceneManager(world: World): SceneManager {
  const splatSystem = world.getSystem(GaussianSplatLoaderSystem)!;
  const sceneLabel = document.querySelector("#scene-label");

  // ONE persistent environment entity reused across all scenes --
  // GaussianSplatLoaderSystem.load() auto-unloads the previous splat for
  // the same entity, so swapping is leak-free by construction.
  const envEntity = world.createTransformEntity(undefined, { persistent: true });
  envEntity.addComponent(GaussianSplatLoader, {
    splatUrl: "",
    meshUrl: "",
    autoLoad: false,
    animate: false,
    enableLod: true,
    lodSplatScale: 1.0,
  });
  // If Marble splats arrive in OpenCV orientation (+y down) and render
  // upside-down, flip the whole environment here:
  // envEntity.object3D!.rotation.x = Math.PI;

  let sceneEntities: (Entity | null)[] = [];
  let currentSceneId: string | null = null;
  let loadToken = 0;

  async function loadScene(sceneId: string): Promise<void> {
    const scene = sceneById[sceneId];
    if (!scene) {
      console.warn(`[sceneManager] Unknown sceneId "${sceneId}" -- check manifest.js`);
      return;
    }
    const token = ++loadToken; // guards against overlapping teleports
    window.dispatchEvent(new CustomEvent("scene-loading", { detail: { sceneId, scene } }));

    // Tear down the previous scene's portals/props/collider. destroy()
    // detaches the object3D from the scene graph; geometry/material
    // disposal is on us.
    for (const entity of sceneEntities) {
      if (!entity) continue;
      if (entity.object3D) {
        unregisterGazeTarget(entity.object3D);
        if (entity.object3D.userData.propId) {
          unregisterInteractive(entity.object3D.userData.propId);
        }
        entity.object3D.userData.video?.pause?.();
        disposeObject3D(entity.object3D);
      }
      entity.destroy();
    }
    sceneEntities = [];

    // Respawn at scene center BEFORE the new portals exist -- guarantees
    // we're PORTAL_RADIUS from every portal on arrival (anti-bounce).
    world.player.position.set(0, 0, 0);
    world.player.rotation.set(0, 0, 0);
    // Keep the XR locomotion physics engine in agreement, or it would
    // snap the player back to the pre-teleport spot on the next frame
    // when a session is active.
    const locomotor = (world.getSystem(LocomotionSystem) as unknown as {
      locomotor?: { teleport(p: THREE.Vector3): void };
    } | null)?.locomotor;
    locomotor?.teleport(world.player.position);

    // Environment splat, falling back to the committed placeholder until
    // the real scene.spz has been generated.
    envEntity.setValue(GaussianSplatLoader, "splatUrl", scene.splat);
    try {
      await splatSystem.load(envEntity, { animate: false });
    } catch {
      if (token !== loadToken) return;
      console.info(`[sceneManager] No splat at ${scene.splat} yet -- using placeholder`);
      envEntity.setValue(GaussianSplatLoader, "splatUrl", PLACEHOLDER_SPLAT);
      await splatSystem.load(envEntity, { animate: false }).catch((err) => {
        console.error("[sceneManager] Placeholder splat failed to load too:", err);
      });
    }
    if (token !== loadToken) return; // superseded mid-flight

    // XR walkable surface from Marble's low-detail collision mesh
    // (additional to the always-present invisible flat floor).
    if (scene.collider) {
      sceneEntities.push(await spawnCollider(world, scene.collider));
      if (token !== loadToken) return;
    }

    // Portals on the 2.5m circle, same angle math as the old version.
    scene.entryPortals.forEach((targetId: string, i: number) => {
      const angle = (i / Math.max(scene.entryPortals.length, 1)) * Math.PI * 2;
      sceneEntities.push(
        createPortal(world, {
          targetScene: targetId,
          label: sceneById[targetId]?.title ?? targetId,
          position: [Math.sin(angle) * PORTAL_RADIUS, 1.2, -Math.cos(angle) * PORTAL_RADIUS],
        })
      );
    });

    // Props: Tripo objects, custom GLBs, images/video screens.
    for (const prop of scene.props ?? []) {
      sceneEntities.push(await spawnProp(world, prop, sceneId));
      if (token !== loadToken) return;
    }

    currentSceneId = sceneId;
    if (sceneLabel) sceneLabel.textContent = `${scene.worldTitle} -- ${scene.title}`;
    window.__portalCooldownUntil = Date.now() + POST_TELEPORT_COOLDOWN_MS;
    window.dispatchEvent(new CustomEvent("scene-changed", { detail: { sceneId, scene } }));

    // Fly-in reveal (not awaited; purely cosmetic).
    splatSystem.replayAnimation(envEntity).catch(() => {});
  }

  // Every teleport goes through a fade-to-black (FadeSystem) so the splat
  // swap reads as a clean cut instead of a hard pop -- especially on
  // Quest, where the DOM loading overlay is invisible in-session. The
  // fade back in happens when the load settles, success or not, so a bad
  // sceneId can never strand the visitor on a black screen.
  function fadedLoad(sceneId: string): void {
    fadeThrough(() => {
      loadScene(sceneId)
        .catch((err) => console.error("[sceneManager] Scene load failed:", err))
        .finally(() => {
          window.dispatchEvent(new CustomEvent("fade-request", { detail: { toBlack: false } }));
        });
    });
  }

  window.addEventListener("teleport-request", (e) => {
    fadedLoad((e as CustomEvent).detail.sceneId);
  });
  window.teleportTo = (sceneId: string) => fadedLoad(sceneId);

  // Initial load: no fade (the loading overlay covers it).
  loadScene(defaultSceneId).catch((err) =>
    console.error("[sceneManager] Initial scene load failed:", err)
  );

  return { getCurrentSceneId: () => currentSceneId };
}
