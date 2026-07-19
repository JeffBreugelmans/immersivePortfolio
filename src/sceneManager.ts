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
import { createMintGltfLoader } from "./gltfRuntime";
import {
  editorInit,
  editorRegisterEnv,
  editorRegisterProp,
  editorReset,
  editorSetFloorSampler,
} from "./editor";
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
import { sceneById as sceneByIdRaw, defaultSceneId } from "./manifest.js";

// The manifest is plain JS; not every scene sets every optional tuning
// key, and TS's union of the object literals would otherwise reject
// accessing a key that only some scenes define.
interface SceneEntry {
  worldId: string;
  worldTitle: string;
  id: string;
  title: string;
  description: string;
  splat: string;
  collider: string;
  ambient: string;
  entryPortals: string[];
  props: unknown[];
  spawnYawDeg?: number;
  envScale?: number;
  envYawDeg?: number;
  splatHiRes?: string;
  walkBounds?: { width: number; depth: number };
  projectorWall?: {
    position: [number, number, number];
    rotationYDeg?: number;
    width?: number;
    height?: number;
  };
}
const sceneById = sceneByIdRaw as Record<string, SceneEntry>;
import { WALK_BOUNDS_DEFAULT } from "./walkBounds";

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

// Live propId -> object3D lookup, populated by spawnProp and cleared on
// scene teardown below. wearableFx.ts uses this to grab the actual
// on-screen headset mesh for the don/doff animation without needing its
// own copy of the spawn logic.
export const livePropObjects = new Map<string, THREE.Object3D>();

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

// Shared Draco-capable loader (gltfRuntime.ts): required for Mint GLB
// props; also serves the Marble colliders, which are plain GLBs.
const gltfLoader = createMintGltfLoader();

// Diegetic edge of the walkable "sweet zone" (see src/walkBounds.ts):
// four low posts + a sagging band of black/yellow safety tape at the
// clamp perimeter, so the movement limit reads as set dressing.
function makeSafetyTapeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#e8c50a";
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = "#141414";
  for (let x = -64; x < 256 + 64; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 64);
    ctx.lineTo(x + 32, 0);
    ctx.lineTo(x + 64, 0);
    ctx.lineTo(x + 32, 64);
    ctx.closePath();
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

function spawnSafetyBarrier(
  world: World,
  halfW: number,
  halfD: number,
  floorY: number
): Entity {
  const group = new THREE.Group();
  const postGeo = new THREE.CylinderGeometry(0.035, 0.045, 1.0, 10);
  const postMat = new THREE.MeshBasicMaterial({ color: 0x2a2a2e });
  const tapeTexture = makeSafetyTapeTexture();
  const tapeHeight = 0.09;

  const corners: [number, number][] = [
    [-halfW, -halfD],
    [halfW, -halfD],
    [halfW, halfD],
    [-halfW, halfD],
  ];
  for (const [x, z] of corners) {
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(x, floorY + 0.5, z);
    group.add(post);
  }
  for (let i = 0; i < 4; i++) {
    const [x1, z1] = corners[i];
    const [x2, z2] = corners[(i + 1) % 4];
    const length = Math.hypot(x2 - x1, z2 - z1);
    const tapeMat = new THREE.MeshBasicMaterial({
      map: tapeTexture.clone(),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
    });
    tapeMat.map!.repeat.set(length / 0.6, 1);
    const tape = new THREE.Mesh(new THREE.PlaneGeometry(length, tapeHeight, 8, 1), tapeMat);
    // Slight sag: bow the middle rows down a touch so it reads as tape,
    // not a solid rail.
    const positionAttr = tape.geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let v = 0; v < positionAttr.count; v++) {
      const vx = positionAttr.getX(v);
      const t = 1 - Math.abs(vx) / (length / 2);
      positionAttr.setY(v, positionAttr.getY(v) - 0.05 * Math.sin(Math.PI * 0.5 * t));
    }
    positionAttr.needsUpdate = true;
    tape.position.set((x1 + x2) / 2, floorY + 0.85, (z1 + z2) / 2);
    tape.rotation.y = Math.atan2(x2 - x1, z2 - z1) + Math.PI / 2;
    tape.renderOrder = 1;
    group.add(tape);
  }

  registerGazeTarget(group, {
    id: "safety-barrier",
    label: "Safety tape barrier",
    description:
      "Black-and-yellow safety tape marking the visitor area. The rest of the space is view-only, like a real maintenance floor.",
  });
  return world.createTransformEntity(group);
}

// Marble -> three.js orientation fix (see the envEntity comment in
// initSceneManager): applies to every Marble-generated splat + collider.
const MARBLE_FLIP_X = Math.PI;

async function spawnCollider(
  world: World,
  url: string,
  scale = 1,
  yawRad = 0
): Promise<Entity | null> {
  try {
    const gltf = await gltfLoader.loadAsync(url);
    // YXZ order makes rotation = Ry(yaw) . Rx(flip): flip to y-up first,
    // then yaw about world Y -- in lockstep with the splat env transform.
    gltf.scene.rotation.order = "YXZ";
    gltf.scene.rotation.set(MARBLE_FLIP_X, yawRad, 0);
    gltf.scene.scale.setScalar(scale); // keep in lockstep with the splat's envScale
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

// Museum-placard prop: canvas-rendered text panel, no asset file needed.
// The body text doubles as the gaze description, so looking at a placard
// and asking Proxie about it feeds him exactly what it says.
function makePlacardMesh(title: string, body: string, widthM: number): THREE.Mesh {
  const canvas = document.createElement("canvas");
  const W = 1024;
  const PAD = 56;
  const ctx = canvas.getContext("2d")!;
  const bodyFont = "38px Georgia, 'Times New Roman', serif";
  const titleFont = "600 52px system-ui, sans-serif";

  // Wrap body text to the panel width.
  ctx.font = bodyFont;
  const words = body.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const attempt = line ? `${line} ${word}` : word;
    if (ctx.measureText(attempt).width > W - PAD * 2 && line) {
      lines.push(line);
      line = word;
    } else {
      line = attempt;
    }
  }
  if (line) lines.push(line);

  const lineHeight = 52;
  const H = PAD + 66 + 26 + lines.length * lineHeight + PAD;
  canvas.width = W;
  canvas.height = H;

  ctx.fillStyle = "#1b1d22";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#c9a227";
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, W - 20, H - 20);
  ctx.fillStyle = "#f5f0e6";
  ctx.font = titleFont;
  ctx.fillText(title, PAD, PAD + 48);
  ctx.fillStyle = "#d8d3c8";
  ctx.font = bodyFont;
  lines.forEach((text, i) => ctx.fillText(text, PAD, PAD + 66 + 26 + (i + 0.8) * lineHeight));

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(widthM, widthM * (H / W)),
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide })
  );
  mesh.renderOrder = 1; // draw after the splat, same as portal rings
  return mesh;
}

interface PropEntry {
  id: string;
  kind: "glb" | "image" | "video" | "placard";
  src?: string;
  title?: string;
  text?: string;
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

async function spawnProp(
  world: World,
  prop: PropEntry,
  sceneId: string,
  floorAt: (x: number, z: number) => number = () => 0
): Promise<Entity | null> {
  let object3D: THREE.Object3D;
  let cleanupVideo: HTMLVideoElement | null = null;

  switch (prop.kind) {
    case "placard": {
      object3D = makePlacardMesh(
        prop.title ?? prop.label ?? "",
        prop.text ?? prop.description ?? "",
        prop.width ?? 0.9
      );
      break;
    }
    case "glb": {
      try {
        const gltf = await gltfLoader.loadAsync(prop.src!);
        object3D = gltf.scene;
      } catch {
        // Same 404-quietly behavior as the old scene-manager: safe to list
        // props in the manifest before the actual asset exists.
        return null;
      }
      break;
    }
    case "image": {
      const texture = await new THREE.TextureLoader().loadAsync(prop.src!).catch(() => null);
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
      video.src = prop.src!;
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

  // Scale applies to every prop kind (placards included -- the ?edit
  // exporter emits scale for whatever got resized).
  if (prop.scale !== undefined) {
    const s = prop.scale;
    if (Array.isArray(s)) object3D.scale.set(...s);
    else object3D.scale.setScalar(s);
  }

  // Prop y is authored ABOVE THE FLOOR; each prop raycasts the collider
  // under its own XZ, so a sloped or uneven Marble ground can't leave
  // props floating (the spawn-point floor height is only a fallback).
  object3D.position.set(
    prop.position[0],
    floorAt(prop.position[0], prop.position[2]) + prop.position[1],
    prop.position[2]
  );
  if (prop.rotation) {
    object3D.rotation.set(
      THREE.MathUtils.degToRad(prop.rotation[0]),
      THREE.MathUtils.degToRad(prop.rotation[1]),
      THREE.MathUtils.degToRad(prop.rotation[2])
    );
  }
  object3D.userData.propId = prop.id;
  object3D.userData.propSource = prop.source ?? "unknown";
  livePropObjects.set(prop.id, object3D);
  editorRegisterProp(prop as never, object3D);
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
    label: prop.label ?? prop.title ?? prop.id,
    // Placards feed their own text to the gaze context, so Proxie can
    // literally read the sign the visitor is looking at.
    description: prop.description ?? prop.text,
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
  // Marble delivers splats and colliders in OpenCV camera convention
  // (+y down, +z forward); rotate pi about X to get three.js y-up.
  // Verified on the first real generation (S1 hangar, 2026-07-18): the
  // collider spanned y -6.6..+0.8 (whole hangar hanging downward) and the
  // in-app view was floor-only with black above. The placeholder splat is
  // already y-up, so the flip is applied per-load in loadScene, not here.

  let sceneEntities: (Entity | null)[] = [];
  let currentSceneId: string | null = null;
  let loadToken = 0;
  const prefetchedUrls = new Set<string>();

  editorInit(world); // no-op unless the URL has ?edit

  // Manifest-driven portal props: a prop with `teleportTo` jumps to that
  // scene when clicked. Slight delay lets the click SFX breathe before
  // the fade. Props also marked `wearable: true` (the Holo Stage Vive)
  // are owned by wearableFx.ts instead -- it plays the don animation and
  // fires the teleport itself once the headset reaches the visitor's
  // eyes, so skip them here.
  window.addEventListener("prop-interaction", (e) => {
    const detail = (e as CustomEvent).detail as
      | { propId?: string; sceneId?: string; trigger?: string }
      | undefined;
    if (!detail || detail.trigger !== "click") return;
    const scene = detail.sceneId ? sceneById[detail.sceneId] : null;
    const entry = (
      scene?.props as { id?: string; teleportTo?: string; wearable?: boolean }[] | undefined
    )?.find((p) => p.id === detail.propId);
    if (entry?.teleportTo && !entry.wearable) {
      setTimeout(() => window.teleportTo?.(entry.teleportTo!), 500);
    }
  });

  async function loadScene(sceneId: string): Promise<void> {
    const scene = sceneById[sceneId];
    if (!scene) {
      console.warn(`[sceneManager] Unknown sceneId "${sceneId}" -- check manifest.js`);
      return;
    }
    const token = ++loadToken; // guards against overlapping teleports
    window.dispatchEvent(new CustomEvent("scene-loading", { detail: { sceneId, scene } }));
    editorReset();

    // Tear down the previous scene's portals/props/collider. destroy()
    // detaches the object3D from the scene graph; geometry/material
    // disposal is on us.
    for (const entity of sceneEntities) {
      if (!entity) continue;
      if (entity.object3D) {
        unregisterGazeTarget(entity.object3D);
        if (entity.object3D.userData.propId) {
          unregisterInteractive(entity.object3D.userData.propId);
          livePropObjects.delete(entity.object3D.userData.propId);
        }
        entity.object3D.userData.video?.pause?.();
        disposeObject3D(entity.object3D);
      }
      entity.destroy();
    }
    sceneEntities = [];

    // Respawn at scene center BEFORE the new portals exist -- guarantees
    // we're PORTAL_RADIUS from every portal on arrival (anti-bounce).
    // spawnYawDeg (manifest, optional) faces the visitor toward the
    // scene's hero view when the generation camera faced elsewhere;
    // DesktopControlsSystem picks the same value up off scene-changed.
    world.player.position.set(0, 0, 0);
    world.player.rotation.set(0, THREE.MathUtils.degToRad(scene.spawnYawDeg ?? 0), 0);
    // Keep the XR locomotion physics engine in agreement, or it would
    // snap the player back to the pre-teleport spot on the next frame
    // when a session is active.
    const locomotor = (world.getSystem(LocomotionSystem) as unknown as {
      locomotor?: { teleport(p: THREE.Vector3): void };
    } | null)?.locomotor;
    locomotor?.teleport(world.player.position);

    // Environment splat, falling back to the committed placeholder until
    // the real scene.spz has been generated. Desktop browsers get the
    // full-res variant when the manifest lists one (splatHiRes -- too
    // heavy for git/Quest, present only where it was rsync'd); a 404
    // falls through to the 500k splat, then to the placeholder.
    const envScale = scene.envScale ?? 1;
    // envYawDeg (manifest, optional) squares the generated world with the
    // axis-aligned walk bounds when Marble's camera wasn't square to the
    // architecture. YXZ = flip to y-up first, then yaw about world Y.
    const envYawRad = THREE.MathUtils.degToRad(scene.envYawDeg ?? 0);
    envEntity.object3D!.rotation.order = "YXZ";
    envEntity.object3D!.rotation.set(MARBLE_FLIP_X, envYawRad, 0);
    envEntity.object3D!.scale.setScalar(envScale);
    const isMobileXrBrowser = /OculusBrowser|Quest|Pico|Android/i.test(navigator.userAgent);
    // Software GL (SwiftShader in headless/cloud harnesses, llvmpipe in
    // VMs) chokes on the 2M-splat shader -- give it the 500k build too.
    const glCtx = world.renderer.getContext();
    const dbgExt = glCtx.getExtension("WEBGL_debug_renderer_info");
    const glRenderer = dbgExt ? String(glCtx.getParameter(dbgExt.UNMASKED_RENDERER_WEBGL)) : "";
    const isSoftwareGL = /swiftshader|llvmpipe|software/i.test(glRenderer);
    let splatLoaded = false;
    envEntity.setValue(GaussianSplatLoader, "splatUrl", scene.splat);
    try {
      await splatSystem.load(envEntity, { animate: false });
      splatLoaded = true;
    } catch {
      if (token !== loadToken) return;
    }
    if (splatLoaded && scene.splatHiRes && !isMobileXrBrowser && !isSoftwareGL) {
      // Quality upgrade in the background: the 500k splat gets the
      // visitor into the world fast (the public URL rides Tailscale
      // Funnel, a few Mbps -- the 2M file alone took >60s there and
      // black-screened the initial load when it was the primary).
      // Download fully first, then swap, so the visitor never stares
      // at an unloading environment. Blob first (no double-download),
      // plain URL as fallback in case the loader needs the extension.
      const hiResUrl = scene.splatHiRes; // narrow once for the closure
      void (async () => {
        try {
          const res = await fetch(hiResUrl);
          if (!res.ok || token !== loadToken) return;
          const blob = await res.blob();
          if (token !== loadToken) return;
          const blobUrl = URL.createObjectURL(blob);
          try {
            envEntity.setValue(GaussianSplatLoader, "splatUrl", blobUrl);
            await splatSystem.load(envEntity, { animate: false });
          } catch {
            if (token !== loadToken) return;
            envEntity.setValue(GaussianSplatLoader, "splatUrl", hiResUrl);
            await splatSystem.load(envEntity, { animate: false });
          } finally {
            URL.revokeObjectURL(blobUrl);
          }
          console.info(`[sceneManager] Upgraded ${scene.id} to full-res splat`);
        } catch {
          /* stay on the 500k splat */
        }
      })();
    }
    if (!splatLoaded) {
      console.info(`[sceneManager] No splat at ${scene.splat} yet -- using placeholder`);
      envEntity.object3D!.rotation.x = 0; // placeholder is already y-up
      envEntity.object3D!.scale.setScalar(1);
      envEntity.setValue(GaussianSplatLoader, "splatUrl", PLACEHOLDER_SPLAT);
      await splatSystem.load(envEntity, { animate: false }).catch((err) => {
        console.error("[sceneManager] Placeholder splat failed to load too:", err);
      });
    }
    if (token !== loadToken) return; // superseded mid-flight

    // XR walkable surface from Marble's low-detail collision mesh
    // (additional to the always-present invisible flat floor).
    // Marble puts the world origin at the generation camera, so the real
    // floor is somewhere below y=0 (and envScale moves it further):
    // raycast straight down against the collider and stand the player on
    // it -- desktop eye height and XR locomotion then both start from
    // the actual ground instead of floating at the camera's altitude.
    let floorY = 0;
    let colliderObj: THREE.Object3D | null = null;
    if (scene.collider) {
      const colliderEntity = await spawnCollider(world, scene.collider, envScale, envYawRad);
      sceneEntities.push(colliderEntity);
      if (token !== loadToken) return;
      if (colliderEntity?.object3D) {
        colliderObj = colliderEntity.object3D;
        colliderObj.updateMatrixWorld(true);
        // Cast from y=0: Marble's origin IS the generation camera, which
        // sat inside the room at eye height -- floor below it, ceiling
        // above it, always. Casting from any height above origin risks
        // starting above a low ceiling and standing the player on the
        // roof (y=50 broke the S2 lab; +1.0 still did).
        const down = new THREE.Raycaster(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -1, 0));
        const hit = down.intersectObject(colliderObj, true)[0];
        if (hit) {
          floorY = hit.point.y;
          world.player.position.y = floorY;
          locomotor?.teleport(world.player.position);
        }
      }
    }

    // Ground sampler for props: cast from just above head height under
    // each prop's own XZ so roof geometry in the collider can't shadow
    // the floor hit, and sloped ground can't leave props hovering.
    const _floorRay = new THREE.Raycaster();
    const floorAt = (x: number, z: number): number => {
      if (!colliderObj) return floorY;
      // Start 1.5m over the spawn floor: above furniture, but safely
      // below even a low ceiling (see the spawn-raycast note above).
      _floorRay.set(new THREE.Vector3(x, floorY + 1.5, z), new THREE.Vector3(0, -1, 0));
      const hit = _floorRay.intersectObject(colliderObj, true)[0];
      return hit ? hit.point.y : floorY;
    };
    editorSetFloorSampler(floorAt);
    editorRegisterEnv([envEntity.object3D!, colliderObj], scene.envYawDeg ?? 0);

    // Walkable sweet zone: WalkBoundsSystem clamps the player to this box
    // (default 4x4m); the safety-tape barrier makes the limit diegetic.
    // Only fence scenes with a REAL splat -- the placeholder is a demo
    // space and the tape would just be clutter there.
    const halfW = (scene.walkBounds?.width ?? WALK_BOUNDS_DEFAULT.width) / 2;
    const halfD = (scene.walkBounds?.depth ?? WALK_BOUNDS_DEFAULT.depth) / 2;
    if (splatLoaded) {
      sceneEntities.push(spawnSafetyBarrier(world, halfW, halfD, floorY));
    }

    // Portals ring the spawn just INSIDE the tape (the fence would make
    // the old 2.5m circle unreachable), rings at chest height above the
    // actual floor. Their walk-in trigger shrinks proportionally so
    // spawning at the center keeps a safe anti-bounce margin.
    const portalRadius = Math.min(PORTAL_RADIUS, Math.min(halfW, halfD) - 0.2);
    const portalProximity = Math.min(1.3, portalRadius * 0.45);
    scene.entryPortals.forEach((targetId: string, i: number) => {
      const angle = (i / Math.max(scene.entryPortals.length, 1)) * Math.PI * 2;
      sceneEntities.push(
        createPortal(world, {
          targetScene: targetId,
          label: sceneById[targetId]?.title ?? targetId,
          position: [Math.sin(angle) * portalRadius, floorY + 1.2, -Math.cos(angle) * portalRadius],
          proximity: portalProximity,
        })
      );
    });

    // Props: Tripo objects, custom GLBs, images/video screens.
    for (const prop of scene.props ?? []) {
      sceneEntities.push(await spawnProp(world, prop as PropEntry, sceneId, floorAt));
      if (token !== loadToken) return;
    }

    currentSceneId = sceneId;
    if (sceneLabel) sceneLabel.textContent = `${scene.worldTitle} -- ${scene.title}`;
    window.__portalCooldownUntil = Date.now() + POST_TELEPORT_COOLDOWN_MS;
    window.dispatchEvent(new CustomEvent("scene-changed", { detail: { sceneId, scene } }));

    // Fly-in reveal (not awaited; purely cosmetic).
    splatSystem.replayAnimation(envEntity).catch(() => {});

    // TECH_SPEC H / tracker T092: warm the HTTP cache for the scenes
    // this one links to, 3s after arrival and only when idle. Fetch-only
    // (bytes are discarded); the real load later hits the browser cache,
    // which the server marks immutable. 500k splat + collider only --
    // never the full-res file.
    setTimeout(() => {
      if (token !== loadToken) return; // already left this scene
      if ((navigator as { connection?: { saveData?: boolean } }).connection?.saveData) return;
      const idle = (window as { requestIdleCallback?: (cb: () => void) => void })
        .requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 500));
      idle(() => {
        for (const targetId of scene.entryPortals ?? []) {
          const target = sceneById[targetId];
          if (!target) continue;
          for (const url of [target.splat, target.collider]) {
            if (!url || prefetchedUrls.has(url)) continue;
            prefetchedUrls.add(url);
            fetch(url)
              .then((res) => (res.ok ? res.arrayBuffer() : null))
              .catch(() => prefetchedUrls.delete(url));
          }
        }
      });
    }, 3000);
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

  // Initial load: no fade (the loading overlay covers it). ?scene=<n>
  // (index in manifest order: 0=hangar .. 4=lightworks) or ?scene=<id>
  // overrides the default -- mainly so ?edit sessions can jump straight
  // into any scene (edit mode suppresses portal travel).
  const requestedScene = new URLSearchParams(location.search).get("scene");
  const orderedIds = Object.keys(sceneById);
  const resolvedScene =
    requestedScene && /^\d+$/.test(requestedScene)
      ? orderedIds[Number(requestedScene)]
      : requestedScene;
  const initialScene = resolvedScene && sceneById[resolvedScene] ? resolvedScene : defaultSceneId;
  if (requestedScene && (!resolvedScene || !sceneById[resolvedScene])) {
    console.warn(
      `[sceneManager] Unknown ?scene=${requestedScene}; use 0-${orderedIds.length - 1} or an id:`,
      orderedIds
    );
  }
  loadScene(initialScene).catch((err) =>
    console.error("[sceneManager] Initial scene load failed:", err)
  );

  return { getCurrentSceneId: () => currentSceneId };
}
