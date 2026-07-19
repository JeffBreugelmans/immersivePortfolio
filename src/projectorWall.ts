// projectorWall.ts
//
// The S5 Lightworks optical-computing wall (TECH_SPEC §F), in its
// self-running form (Jeff's simplification, 2026-07-18): four virtual
// projectors each carry one bit-plane of a portrait quantized to five
// luminance levels. The wall cycles on its own -- projectors switch on
// one per second (each alone is pure noise), the sum resolves the
// portrait, holds, blinks off, and starts over. No user input needed;
// the exhibit performs for anyone who looks down the aisle.
//
// The packed mask texture (R/G/B/A = projector 0-3, one texel per grid
// cell) is baked offline from planning/reference/cats/profileProjection.jpg
// -- see scripts/prototypes/bake-projector-image-prototype.py for the
// validated design and docs/TECH_SPEC.md §F for the math.

import * as THREE from "three";
import { createSystem } from "@iwsdk/core";
import { registerGazeTarget, unregisterGazeTarget } from "./gazeContext";
import { editorRegisterProp } from "./editor";
import { sceneById as sceneByIdRaw } from "./manifest.js";

type WallConfig = {
  position: [number, number, number];
  rotationYDeg?: number;
  width?: number;
  height?: number;
};

// Manifest is plain JS; only S5 carries a projectorWall key.
const sceneById = sceneByIdRaw as Record<string, { projectorWall?: WallConfig } | undefined>;

const BASE = import.meta.env.BASE_URL;
// Two alpha-free textures: browsers zero out RGB on transparent texels
// during image decode, so bit data can never ride in an alpha channel.
// A carries projectors 0-2 in RGB; B carries projector 3 in R.
const MASK_A_URL = `${BASE}career/scene-03-lightworks/props/projector-mask-a.png`;
const MASK_B_URL = `${BASE}career/scene-03-lightworks/props/projector-mask-b.png`;

// Cycle timeline (seconds). Starts at the resolved image so a fresh
// visitor (and the headless QA screenshot) sees the payoff first.
const HOLD_ALL_S = 4.0; // full portrait
const OFF_S = 1.5; // blackout beat
const STEP_S = 1.0; // per-projector reveal steps
const CYCLE_S = HOLD_ALL_S + OFF_S + STEP_S * 4; // then back to full

// Matrix-green mapping validated in the prototype: base + lit * sum/4.
const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const FRAG = /* glsl */ `
  uniform sampler2D uMaskA;
  uniform sampler2D uMaskB;
  uniform vec4 uEnabled;
  varying vec2 vUv;
  void main() {
    vec3 bitsA = step(0.5, texture2D(uMaskA, vUv).rgb);
    float bitB = step(0.5, texture2D(uMaskB, vUv).r);
    float sum = dot(bitsA, uEnabled.xyz) + bitB * uEnabled.w;
    float frac = sum / 4.0;
    vec3 base = vec3(0.02, 0.05, 0.03);
    vec3 lit = vec3(0.35, 1.0, 0.55);
    gl_FragColor = vec4(base + lit * frac, 1.0);
  }
`;

export class ProjectorWallSystem extends createSystem({}) {
  private mesh: THREE.Mesh | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private maskA: THREE.Texture | null = null;
  private maskB: THREE.Texture | null = null;
  private elapsed = 0;

  init() {
    window.addEventListener("scene-loading", () => this.teardown());
    window.addEventListener("scene-changed", (e) => {
      const sceneId = (e as CustomEvent).detail?.sceneId as string | undefined;
      const config = (sceneId ? sceneById[sceneId] : null)?.projectorWall as
        | WallConfig
        | undefined;
      if (config) this.spawn(config);
    });
  }

  private spawn(config: WallConfig): void {
    const loadMask = (url: string) => {
      const texture = new THREE.TextureLoader().load(url);
      // One texel per grid cell: crisp blocks, no bilinear smear.
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      texture.colorSpace = THREE.NoColorSpace;
      return texture;
    };
    this.maskA ??= loadMask(MASK_A_URL);
    this.maskB ??= loadMask(MASK_B_URL);
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uMaskA: { value: this.maskA },
        uMaskB: { value: this.maskB },
        uEnabled: { value: new THREE.Vector4(1, 1, 1, 1) },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
    });
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(config.width ?? 4.5, config.height ?? 4.5),
      this.material
    );
    this.mesh.position.set(...config.position);
    this.mesh.rotation.y = THREE.MathUtils.degToRad(config.rotationYDeg ?? 0);
    this.elapsed = 0;
    this.world.scene.add(this.mesh);

    // ?edit support: shows up as a selectable "prop". NOTE its exported
    // y is floor-relative like every prop; when baking back into the
    // manifest's projectorWall.position (absolute), add the scene's
    // floor height (S5: -1.6).
    editorRegisterProp(
      { id: "projector-wall", position: config.position } as never,
      this.mesh
    );

    registerGazeTarget(this.mesh, {
      id: "projector-wall",
      label: "The optical-computing wall",
      description:
        "Four projectors, each showing pure noise -- but their overlapping light literally adds up: the sum of four random bit-planes resolves into a portrait. Computing with light instead of electronics, the idea behind Jeff's work at Lightworks.",
    });
  }

  private teardown(): void {
    if (this.mesh) {
      unregisterGazeTarget(this.mesh);
      this.mesh.removeFromParent();
      this.mesh.geometry.dispose();
      this.material?.dispose();
      this.mesh = null;
      this.material = null;
    }
  }

  update(delta: number) {
    if (!this.material) return;
    this.elapsed = (this.elapsed + delta) % CYCLE_S;
    const t = this.elapsed;
    const enabled = this.material.uniforms.uEnabled.value as THREE.Vector4;
    if (t < HOLD_ALL_S) {
      enabled.set(1, 1, 1, 1);
    } else if (t < HOLD_ALL_S + OFF_S) {
      enabled.set(0, 0, 0, 0);
    } else {
      // Projectors come back one per second, noise resolving into image.
      const on = Math.min(4, 1 + Math.floor((t - HOLD_ALL_S - OFF_S) / STEP_S));
      enabled.set(on > 0 ? 1 : 0, on > 1 ? 1 : 0, on > 2 ? 1 : 0, on > 3 ? 1 : 0);
    }
  }

  destroy() {
    this.teardown();
    this.maskA?.dispose();
    this.maskB?.dispose();
    super.destroy?.();
  }
}
