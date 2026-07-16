// portal.js
//
// A-Frame component for a clickable "portal" hotspot that teleports the
// viewer to another scene. Dispatches a window-level "teleport-request"
// event rather than importing scene-manager.js directly, to keep this
// component decoupled and reusable.

import AFRAME from "aframe";

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

    this.onClick = () => {
      window.dispatchEvent(
        new CustomEvent("teleport-request", {
          detail: { sceneId: this.data.targetScene },
        })
      );
    };
    this.el.addEventListener("click", this.onClick);
  },

  remove() {
    this.el.removeEventListener("click", this.onClick);
  },
});
