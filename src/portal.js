// portal.js
//
// A-Frame component for a "portal" hotspot that teleports the viewer to
// another scene. Dispatches a window-level "teleport-request" event rather
// than importing scene-manager.js directly, to keep this component
// decoupled and reusable.
//
// Two trigger paths, both dispatching the same event:
//   1. Click -- the camera's cursor entity (index.html) uses a fixed gaze
//      raycaster (position "0 0 -1" relative to the camera, i.e. it always
//      casts straight out from screen-center, not from wherever the mouse
//      pointer visually is). That only registers a click when the portal is
//      centered in view, which reads as "works on mobile, not desktop"
//      when really it's "works when you're looking straight at it" --
//      desktop users naturally try clicking the portal wherever it appears
//      on screen instead. Kept as a secondary trigger since it still works
//      once you're facing the portal.
//   2. Proximity -- checked every frame in tick(): once the camera rig
//      (mouse-look, WASD, touch-drag, real walking on Quest, all move the
//      same camera entity) comes within PROXIMITY_TRIGGER_DISTANCE of the
//      portal, it fires automatically. This is what makes "walk through
//      the portal" work, and it's also the reliable path for desktop/mouse
//      users since it doesn't depend on precise aim.
//
// scene-manager.js sets window.__portalCooldownUntil after every scene
// load (see its loadScene()) so a portal you spawn next to on arrival
// doesn't instantly fire again and bounce you back.

import AFRAME from "aframe";

const PROXIMITY_TRIGGER_DISTANCE = 1.3; // meters

AFRAME.registerComponent("portal-hotspot", {
  schema: {
    targetScene: { type: "string" },
    label: { type: "string" },
  },

  init() {
    this.el.setAttribute("geometry", {
      primitive: "ring",
      radiusInner: 0.3,
      radiusOuter: 0.4,
    });
    this.el.setAttribute("material", {
      color: "#4CC3D9",
      shader: "flat",
      side: "double",
    });
    this.el.classList.add("clickable");
    this.el.setAttribute("animation__pulse", {
      property: "scale",
      dir: "alternate",
      dur: 1000,
      easing: "easeInOutSine",
      loop: true,
      to: "1.1 1.1 1.1",
    });

    const labelEl = document.createElement("a-text");
    labelEl.setAttribute("value", this.data.label);
    labelEl.setAttribute("align", "center");
    labelEl.setAttribute("position", "0 0.6 0");
    labelEl.setAttribute("scale", "1.2 1.2 1.2");
    this.el.appendChild(labelEl);

    this.triggered = false;
    this._portalWorldPos = new AFRAME.THREE.Vector3();
    this._camWorldPos = new AFRAME.THREE.Vector3();

    this.onClick = () => this.trigger();
    this.el.addEventListener("click", this.onClick);
  },

  trigger() {
    if (this.triggered) return;
    this.triggered = true; // this entity is torn down on the next scene
    // load anyway (scene-manager.js clears #portal-root), so no reset needed
    window.dispatchEvent(
      new CustomEvent("teleport-request", {
        detail: { sceneId: this.data.targetScene },
      })
    );
  },

  tick() {
    if (this.triggered) return;
    if (Date.now() < (window.__portalCooldownUntil || 0)) return;

    const camera = this.el.sceneEl.camera; // active THREE.Camera, not an a-entity
    if (!camera) return;

    this.el.object3D.getWorldPosition(this._portalWorldPos);
    camera.getWorldPosition(this._camWorldPos);
    // Match height so walking through at head-height counts as passing
    // through the ring, without needing to crouch to the ring's own y.
    this._portalWorldPos.y = this._camWorldPos.y;

    if (this._portalWorldPos.distanceTo(this._camWorldPos) < PROXIMITY_TRIGGER_DISTANCE) {
      this.trigger();
    }
  },

  remove() {
    this.el.removeEventListener("click", this.onClick);
  },
});
