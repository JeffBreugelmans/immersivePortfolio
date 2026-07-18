// index.ts
//
// Bootstraps the IWSDK world: renderer, XR session plumbing, ECS systems,
// the persistent locomotion floor, and then hands off to sceneManager
// (world/scene/portal graph) and the Proxie chat overlay.
//
// Desktop-first: with no headset the page is an ordinary 3D site (drag to
// look, WASD to walk, click portals, chat with Proxie). On WebXR-capable
// devices the Enter VR button appears and the same world becomes an
// immersive session with controller/hand locomotion and grabbing.

import * as THREE from "three";
import {
  EnvironmentType,
  LocomotionEnvironment,
  LocomotionSystem,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SessionMode,
  VisibilityState,
  World,
} from "@iwsdk/core";
import { GaussianSplatLoaderSystem } from "./gaussianSplatLoader";
import { PortalSystem } from "./portals";
import { DesktopControlsSystem } from "./desktopControls";
import { GazeContextSystem } from "./gazeContext";
import { InteractionSystem } from "./interactions";
import { FadeSystem } from "./fade";
import { AudioManagerSystem } from "./audio";
import { CompanionSystem } from "./companion";
import { DebugOverlaySystem } from "./debugOverlay";
import { initSceneManager } from "./sceneManager";
import { initChatOverlay } from "./proxie-chat.js";

function initLoadingOverlay(): void {
  const overlay = document.querySelector<HTMLElement>("#loading-overlay");
  const title = document.querySelector<HTMLElement>("#loading-title");
  if (!overlay) return;

  window.addEventListener("scene-loading", (e) => {
    const scene = (e as CustomEvent).detail?.scene;
    if (title && scene) title.textContent = `Entering ${scene.title}...`;
    overlay.classList.remove("hidden");
  });
  window.addEventListener("scene-changed", () => {
    overlay.classList.add("hidden");
  });
}

/**
 * IWSDK's LocomotionSystem copies its physics engine's position onto
 * world.player every frame, unconditionally -- which would stomp the
 * desktop WASD movement (and the scene-respawn) whenever we're NOT in an
 * XR session. Locomotion is XR-only functionality anyway (controller
 * teleport/slide), so pause the system outside immersive sessions, and
 * hand it the visitor's current position when they enter one so the two
 * movement modes agree on where the player is standing.
 */
function syncLocomotionToVisibility(world: World): void {
  const locomotionSystem = world.getSystem(LocomotionSystem);
  if (!locomotionSystem) return;

  world.visibilityState.subscribe((state) => {
    if (state === VisibilityState.NonImmersive) {
      locomotionSystem.stop();
    } else {
      const locomotor = (locomotionSystem as unknown as { locomotor?: { teleport(p: THREE.Vector3): void } })
        .locomotor;
      locomotor?.teleport(world.player.position);
      locomotionSystem.play();
    }
  });
  if (world.visibilityState.value === VisibilityState.NonImmersive) {
    locomotionSystem.stop();
  }
}

function wireEnterVRButton(world: World): void {
  const button = document.querySelector<HTMLButtonElement>("#enter-vr");
  if (!button) return;

  navigator.xr
    ?.isSessionSupported("immersive-vr")
    .then((supported) => {
      if (!supported) return;
      button.hidden = false;
      button.addEventListener("click", () => {
        if (world.visibilityState.value === VisibilityState.NonImmersive) {
          world.launchXR();
        } else {
          world.exitXR();
        }
      });
      world.visibilityState.subscribe((state) => {
        button.textContent = state === VisibilityState.NonImmersive ? "Enter VR" : "Exit VR";
      });
    })
    .catch(() => {});
}

World.create(document.getElementById("scene-container") as HTMLDivElement, {
  assets: {},
  xr: {
    sessionMode: SessionMode.ImmersiveVR,
    offer: "always",
    features: { handTracking: true, layers: true },
  },
  render: {
    // Splats are unlit; we add our own ambient for GLB props.
    defaultLighting: false,
  },
  features: {
    locomotion: true,
    grabbing: true,
    physics: false,
    sceneUnderstanding: false,
  },
})
  .then((world) => {
    world.scene.background = new THREE.Color(0x000000);
    world.scene.add(new THREE.AmbientLight(0xffffff, 1.0));
    world.camera.position.set(0, 1.6, 0);

    world
      .registerSystem(GaussianSplatLoaderSystem)
      .registerSystem(PortalSystem)
      .registerSystem(DesktopControlsSystem)
      .registerSystem(GazeContextSystem)
      .registerSystem(InteractionSystem)
      .registerSystem(FadeSystem)
      .registerSystem(AudioManagerSystem)
      .registerSystem(CompanionSystem)
      .registerSystem(DebugOverlaySystem);

    // Invisible floor so XR teleport/slide locomotion always has a
    // walkable surface, even before a scene's collider.glb exists.
    // (Must be a Mesh for locomotion raycasting.)
    const floorGeometry = new PlaneGeometry(100, 100);
    floorGeometry.rotateX(-Math.PI / 2);
    const floor = new Mesh(floorGeometry, new MeshBasicMaterial());
    floor.visible = false;
    world
      .createTransformEntity(floor, { persistent: true })
      .addComponent(LocomotionEnvironment, { type: EnvironmentType.STATIC });

    syncLocomotionToVisibility(world);
    const sceneManager = initSceneManager(world);
    initChatOverlay(sceneManager);
    initLoadingOverlay();
    wireEnterVRButton(world);
  })
  .catch((err) => {
    console.error("[World] Failed to create the IWSDK world:", err);
    const overlay = document.querySelector("#loading-title");
    if (overlay) overlay.textContent = "Failed to start the 3D experience -- see console.";
  });
