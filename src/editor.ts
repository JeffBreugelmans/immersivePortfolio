// editor.ts
//
// Desktop prop-placement mode, enabled with ?edit in the URL.
//
//   left-click a prop   select it (gizmo appears)
//   drag gizmo          move it; keys 1 / 2 / 3 = translate / rotate / scale
//   right-drag          look around (left-drag is reserved for the gizmo)
//   Esc                 deselect
//   "Copy props JSON"   puts the scene's updated props array on the
//                       clipboard, ready to paste into manifest.js --
//                       y is converted back to floor-relative using the
//                       same collider sampler spawnProp used.
//
// Edit mode also suppresses portal walk-in teleports and the companion
// (portals.ts / companion.ts check editModeEnabled) so the scene holds
// still while you work. Desktop-only; XR sessions ignore all of this.

import * as THREE from "three";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { sceneById } from "./manifest.js";

// Scene index in manifest order -- the number Jeff uses in ?scene=<n>
// and the one stamped into the export JSON.
const sceneIndexOf = (id: string): number => Object.keys(sceneById).indexOf(id);

export const editModeEnabled =
  typeof location !== "undefined" && new URLSearchParams(location.search).has("edit");

type PropEntryLike = {
  id: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
  [key: string]: unknown;
};

type Editable = { object: THREE.Object3D; entry: PropEntryLike };

let world: { scene: THREE.Scene; camera: THREE.Camera; renderer: THREE.WebGLRenderer } | null =
  null;
let gizmo: TransformControls | null = null;
let gizmoHelper: THREE.Object3D | null = null;
let editables: Editable[] = [];
let selected: Editable | null = null;
let floorAt: (x: number, z: number) => number = () => 0;
let panel: HTMLDivElement | null = null;
let readout: HTMLDivElement | null = null;
let envLine: HTMLDivElement | null = null;
let envObjects: THREE.Object3D[] = [];
let envYawDeg = 0;
let currentSceneId = "";

const _raycaster = new THREE.Raycaster();
const _pointer = new THREE.Vector2();

export function editorInit(w: typeof world): void {
  if (!editModeEnabled || !w || world) return;
  world = w;

  gizmo = new TransformControls(world.camera, world.renderer.domElement);
  gizmo.addEventListener("dragging-changed", (e) => {
    (window as unknown as { __editorDragging?: boolean }).__editorDragging = !!(
      e as { value?: unknown }
    ).value;
  });
  gizmo.addEventListener("objectChange", () => {
    // Scale-drag multiplies the object's current scale, so on a 15x prop
    // one flick reaches the millions -- clamp to something recoverable.
    if (selected) {
      const s = selected.object.scale;
      s.set(
        THREE.MathUtils.clamp(s.x, 0.005, 100),
        THREE.MathUtils.clamp(s.y, 0.005, 100),
        THREE.MathUtils.clamp(s.z, 0.005, 100)
      );
    }
    updateReadout();
  });
  // three r169+: the visual part of TransformControls is a separate helper.
  const maybeHelper = (gizmo as unknown as { getHelper?: () => THREE.Object3D }).getHelper;
  gizmoHelper = maybeHelper ? maybeHelper.call(gizmo) : (gizmo as unknown as THREE.Object3D);

  const canvas = world.renderer.domElement;
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("scene-changed", (e) => {
    currentSceneId = ((e as CustomEvent).detail?.sceneId as string) ?? currentSceneId;
    updateEnvLine();
  });

  buildPanel();
  console.info("[editor] edit mode active -- click a prop to select it");
}

/** Scene teardown: forget last scene's objects and hide the gizmo. */
export function editorReset(): void {
  if (!editModeEnabled) return;
  deselect();
  editables = [];
  envObjects = [];
}

/**
 * Splat env + collider, rotated together live with [ / ] so the world can
 * be squared against the axis-aligned walk bounds; the resulting angle is
 * baked into the manifest as envYawDeg.
 */
export function editorRegisterEnv(objects: (THREE.Object3D | null)[], yawDeg: number): void {
  if (!editModeEnabled) return;
  envObjects = objects.filter((o): o is THREE.Object3D => !!o);
  envYawDeg = yawDeg;
  updateEnvLine();
}

function nudgeEnvYaw(deltaDeg: number): void {
  envYawDeg = Math.round((envYawDeg + deltaDeg) * 10) / 10;
  const rad = THREE.MathUtils.degToRad(envYawDeg);
  for (const obj of envObjects) obj.rotation.y = rad;
  updateEnvLine();
  console.log(`[editor] envYawDeg: ${envYawDeg}`);
}

function updateEnvLine(): void {
  if (envLine) {
    const index = sceneIndexOf(currentSceneId);
    const last = Object.keys(sceneById).length - 1;
    envLine.textContent =
      `scene ${index >= 0 ? index : "?"}: ${currentSceneId || "(loading)"}\n` +
      `env yaw ${envYawDeg}°  ( [ / ] adjust, shift = 5° )\n` +
      `other scenes: &scene=0..${last} in the URL`;
  }
}

export function editorSetFloorSampler(fn: typeof floorAt): void {
  if (editModeEnabled) floorAt = fn;
}

export function editorRegisterProp(entry: PropEntryLike, object: THREE.Object3D): void {
  if (!editModeEnabled) return;
  editables.push({ object, entry });
}

function onPointerDown(e: PointerEvent): void {
  if (!world || e.button !== 0) return;
  if ((window as unknown as { __editorDragging?: boolean }).__editorDragging) return;
  const rect = world.renderer.domElement.getBoundingClientRect();
  _pointer.set(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1
  );
  _raycaster.setFromCamera(_pointer, world.camera);
  const hits = _raycaster.intersectObjects(
    editables.map((p) => p.object),
    true
  );
  if (!hits.length) return;
  let node: THREE.Object3D | null = hits[0].object;
  while (node) {
    const found = editables.find((p) => p.object === node);
    if (found) return select(found);
    node = node.parent;
  }
}

function onKeyDown(e: KeyboardEvent): void {
  if (!gizmo) return;
  if (e.code === "Escape") deselect();
  if (e.code === "Digit1") gizmo.setMode("translate");
  if (e.code === "Digit2") gizmo.setMode("rotate");
  if (e.code === "Digit3") gizmo.setMode("scale");
  if (e.code === "BracketLeft") nudgeEnvYaw(e.shiftKey ? -5 : -1);
  if (e.code === "BracketRight") nudgeEnvYaw(e.shiftKey ? 5 : 1);
}

function select(target: Editable): void {
  if (!world || !gizmo || !gizmoHelper) return;
  selected = target;
  gizmo.attach(target.object);
  if (!gizmoHelper.parent) world.scene.add(gizmoHelper);
  updateReadout();
}

function deselect(): void {
  selected = null;
  gizmo?.detach();
  gizmoHelper?.removeFromParent();
  updateReadout();
}

const round = (v: number, p = 2) => Number(v.toFixed(p));

/** Manifest-shaped entry for one editable, with floor-relative y. */
function entryFor({ object, entry }: Editable): PropEntryLike {
  const out: PropEntryLike = { ...entry };
  out.position = [
    round(object.position.x),
    round(object.position.y - floorAt(object.position.x, object.position.z)),
    round(object.position.z),
  ];
  const deg = (r: number) => round(THREE.MathUtils.radToDeg(r), 1);
  const rot: [number, number, number] = [
    deg(object.rotation.x),
    deg(object.rotation.y),
    deg(object.rotation.z),
  ];
  if (rot.some((v) => v !== 0)) out.rotation = rot;
  else delete out.rotation;
  const { x, y, z } = object.scale;
  if (Math.abs(x - y) < 1e-3 && Math.abs(y - z) < 1e-3) {
    if (Math.abs(x - 1) > 1e-3) out.scale = round(x, 3);
    else delete out.scale;
  } else {
    out.scale = [round(x, 3), round(y, 3), round(z, 3)];
  }
  return out;
}

function updateReadout(): void {
  if (!readout) return;
  if (!selected) {
    readout.textContent = "click a prop to select";
    return;
  }
  const e = entryFor(selected);
  readout.textContent =
    `${e.id}\n` +
    `pos [${(e.position as number[]).join(", ")}] (y above floor)\n` +
    `rot [${((e.rotation as number[]) ?? [0, 0, 0]).join(", ")}]\n` +
    `scale ${JSON.stringify(e.scale ?? 1)}`;
}

async function copyProps(): Promise<void> {
  // envYawDeg rides along -- earlier exports lost the [ / ] rotation
  // because only the props array was copied.
  const json = JSON.stringify(
    {
      scene: sceneIndexOf(currentSceneId),
      sceneId: currentSceneId,
      envYawDeg,
      props: editables.map((p) => entryFor(p)),
    },
    null,
    2
  );
  try {
    await navigator.clipboard.writeText(json);
    flash("scene JSON copied (props + envYawDeg) -- paste it to Claude or manifest.js");
  } catch {
    console.log("[editor] scene JSON:\n" + json);
    flash("clipboard blocked -- JSON logged to console");
  }
}

let flashTimer: ReturnType<typeof setTimeout> | null = null;
function flash(msg: string): void {
  const el = panel?.querySelector<HTMLDivElement>(".editor-flash");
  if (!el) return;
  el.textContent = msg;
  if (flashTimer) clearTimeout(flashTimer);
  flashTimer = setTimeout(() => (el.textContent = ""), 4000);
}

function buildPanel(): void {
  panel = document.createElement("div");
  panel.style.cssText =
    "position:fixed;top:12px;right:12px;z-index:1000;background:rgba(10,12,16,.88);" +
    "color:#dfe6ee;font:12px/1.5 monospace;padding:10px 12px;border-radius:8px;" +
    "max-width:290px;pointer-events:auto;white-space:pre-wrap";
  panel.innerHTML =
    "<b>EDIT MODE</b>  1 move · 2 rotate · 3 scale\n" +
    "left-click select · right-drag look · Esc deselect\n";
  envLine = document.createElement("div");
  envLine.style.cssText = "margin-top:6px;color:#ffd28f";
  readout = document.createElement("div");
  readout.style.cssText = "margin:8px 0;color:#9fd6ff";
  readout.textContent = "click a prop to select";
  panel.appendChild(envLine);
  updateEnvLine();
  const button = document.createElement("button");
  button.textContent = "Copy props JSON";
  button.style.cssText =
    "cursor:pointer;background:#2b6cb0;color:#fff;border:0;border-radius:5px;padding:5px 10px";
  button.addEventListener("click", copyProps);
  const flashEl = document.createElement("div");
  flashEl.className = "editor-flash";
  flashEl.style.cssText = "margin-top:6px;color:#8fe3a1;min-height:14px";
  panel.append(readout, button, flashEl);
  document.body.appendChild(panel);
}
