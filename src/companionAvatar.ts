// companionAvatar.ts
//
// Rigged-GLB presentation layer for JB Proxie (TECH_SPEC §E, tracker T061/
// T082). Wraps the Mint-generated rigged character and its external
// animation-clip GLBs (see mint-assets.json key "proxie-avatar") behind a
// tiny play/playOnce API with 200ms crossfades, so CompanionSystem can stay
// a pure state machine. Loads the character plus idle/walk first (the
// clips a first frame needs), then streams the remaining clips in the
// background and upgrades silently.

import * as THREE from "three";
import { createMintGltfLoader } from "./gltfRuntime";

const BASE = import.meta.env.BASE_URL;
const DIR = `${BASE}assets/mint/proxie-avatar/`;

const RIGGED_URL = `${DIR}rigged_character_glb.glb`;

export type ClipName =
  | "idle"
  | "walk"
  | "talk"
  | "explain"
  | "nod"
  | "wave"
  | "listen"
  | "flinch";

// Registry localPath basenames, keyed by the semantic role the companion
// state machine uses (clip files embed one animation each).
const CLIP_FILES: Record<ClipName, string> = {
  idle: "clip-w97fsh531084t1cpztsgpvt7ex8aty9q-animation_glb.glb",
  walk: "clip-w97c4ac7hvv6h1rv8wcdyqq21x8avejw-animation_glb.glb",
  talk: "clip-w976vqkjy0xjvq7nr0cgs9hp958at7bd-animation_glb.glb",
  explain: "clip-w977m6c6qrf0d90tve2hbna2yd8atsbf-animation_glb.glb",
  nod: "clip-w977p6hqeemenrpw0d3sfjw3198avxd0-animation_glb.glb",
  wave: "clip-w97c3hs9yt1ksv04e77dx78qdn8avgft-animation_glb.glb",
  listen: "clip-w97aavseq7gan51vgb29ncehys8avpb5-animation_glb.glb",
  flinch: "clip-w970ejjk1cp8mf6kb62n98p3098atemy-animation_glb.glb",
};

// Clips whose absence must not delay the companion's first appearance.
const DEFERRED_CLIPS: ClipName[] = ["talk", "explain", "nod", "wave", "listen", "flinch"];

const CROSSFADE_S = 0.2;
// meters. Was 1.8 (the Mint rig request) -- Jeff's review 2026-07-19: at
// 1.8 he loomed noticeably over the visitor's ~1.6m eye height (feet
// ground-snap to the player's floor y, so the full 0.2m gap read as
// height, not distance). 1.65 keeps him human-proportioned while putting
// his head near the visitor's own eye line instead of above it. Tune
// further by eye -- this is a first pass, not a measured fix.
const TARGET_HEIGHT = 1.65;

// Per-clip playback speed. The catalog "Neutral Idle" ships with busy
// over-the-shoulder glances and weight shifts; slowed down it reads as
// calm breathing instead of nervous swaying (Jeff's review 2026-07-18).
const CLIP_TIMESCALE: Partial<Record<ClipName, number>> = {
  idle: 0.45,
  listen: 0.8,
};

export class CompanionAvatar {
  readonly group = new THREE.Group();
  readonly height: number;

  private mixer: THREE.AnimationMixer;
  private actions = new Map<ClipName, THREE.AnimationAction>();
  private current: ClipName | null = null;
  private oneShotReturn: ClipName | null = null;
  private materials: (THREE.Material & { opacity: number; transparent: boolean })[] = [];
  private baseTransparent: boolean[] = [];

  private constructor(model: THREE.Object3D, height: number) {
    this.height = height;
    this.group.add(model);
    this.mixer = new THREE.AnimationMixer(model);
    this.mixer.addEventListener("finished", () => {
      if (this.oneShotReturn) {
        const next = this.oneShotReturn;
        this.oneShotReturn = null;
        this.play(next);
      }
    });
    model.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.frustumCulled = false; // skinned bounds lag the animated pose
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) {
          this.materials.push(mat as CompanionAvatar["materials"][number]);
          this.baseTransparent.push((mat as THREE.Material).transparent);
        }
      }
    });
  }

  /**
   * Loads the rigged character plus the idle and walk clips before
   * resolving; the remaining clips stream in afterwards. Rejects if the
   * character or either core clip fails, so the caller can stay on the
   * billboard fallback.
   */
  static async load(): Promise<CompanionAvatar> {
    const loader = createMintGltfLoader();
    const [rigged, idleGltf, walkGltf] = await Promise.all([
      loader.loadAsync(RIGGED_URL),
      loader.loadAsync(`${DIR}${CLIP_FILES.idle}`),
      loader.loadAsync(`${DIR}${CLIP_FILES.walk}`),
    ]);

    const model = rigged.scene;
    // Ground-snap and normalize: feet on y=0, height exactly TARGET_HEIGHT.
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const scale = size.y > 0.01 ? TARGET_HEIGHT / size.y : 1;
    model.scale.setScalar(scale);
    model.position.y -= bounds.min.y * scale;

    const avatar = new CompanionAvatar(model, TARGET_HEIGHT);
    avatar.registerClip("idle", idleGltf.animations[0]);
    avatar.registerClip("walk", walkGltf.animations[0]);
    avatar.play("idle", 0);

    void avatar.loadDeferredClips(loader);
    return avatar;
  }

  private async loadDeferredClips(loader: ReturnType<typeof createMintGltfLoader>) {
    for (const name of DEFERRED_CLIPS) {
      try {
        const gltf = await loader.loadAsync(`${DIR}${CLIP_FILES[name]}`);
        this.registerClip(name, gltf.animations[0]);
      } catch (error) {
        console.warn(`[companion] clip "${name}" failed to load`, error);
      }
    }
  }

  private registerClip(name: ClipName, clip?: THREE.AnimationClip) {
    if (!clip) return;
    const action = this.mixer.clipAction(clip);
    action.timeScale = CLIP_TIMESCALE[name] ?? 1;
    this.actions.set(name, action);
  }

  has(name: ClipName): boolean {
    return this.actions.has(name);
  }

  /** Crossfades to a looping clip. No-op if already playing or not loaded. */
  play(name: ClipName, fadeS = CROSSFADE_S): void {
    if (this.current === name && !this.oneShotReturn) return;
    const action = this.actions.get(name);
    if (!action) return;
    this.oneShotReturn = null;
    action.reset();
    action.setLoop(THREE.LoopRepeat, Infinity);
    this.crossfadeTo(action, fadeS);
    this.current = name;
  }

  /** Plays a clip once, then returns to `returnTo` (default: current loop). */
  playOnce(name: ClipName, returnTo?: ClipName): void {
    const action = this.actions.get(name);
    if (!action) return;
    this.oneShotReturn = returnTo ?? (this.current === name ? "idle" : this.current ?? "idle");
    action.reset();
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    this.crossfadeTo(action, CROSSFADE_S);
    this.current = name;
  }

  private crossfadeTo(action: THREE.AnimationAction, fadeS: number): void {
    const previous = this.currentAction();
    action.play();
    if (previous && previous !== action) {
      previous.crossFadeTo(action, fadeS, false);
    } else {
      action.fadeIn(fadeS);
    }
  }

  private currentAction(): THREE.AnimationAction | null {
    return this.current ? this.actions.get(this.current) ?? null : null;
  }

  /** Fade support for scene transitions; restores authored transparency at 1. */
  setOpacity(alpha: number): void {
    const fading = alpha < 1;
    this.materials.forEach((mat, i) => {
      mat.opacity = alpha;
      mat.transparent = fading ? true : this.baseTransparent[i];
    });
  }

  get opacity(): number {
    return this.materials[0]?.opacity ?? 1;
  }

  update(delta: number): void {
    this.mixer.update(delta);
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.group.removeFromParent();
  }
}
