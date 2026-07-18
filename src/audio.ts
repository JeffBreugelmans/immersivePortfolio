// audio.ts
//
// Per-scene ambient loops + interaction SFX (TECH_SPEC §D). All
// three.js-native, zero new dependencies. Assets come from Mint and may
// not exist yet -- every load failure is silent, so the manifest can name
// audio files before they're generated (same 404-quietly philosophy as
// props).
//
// Consumes (never invents) existing window events:
//   scene-loading    -> start fetching the incoming scene's ambient
//   scene-changed    -> crossfade ambient A->B over 1.5s
//   prop-interaction -> play the interaction's sfx key at the prop (2D for now)
//   teleport-request -> UI whoosh
//   hud-toggled      -> on/off blip
//   proxie-speaking-started/ended -> duck ambient -6dB while Proxie talks
//
// Manifest: per-scene optional `ambient` (url) + `ambientVolume`; shared
// `sfxLibrary` map of key -> url (see manifest.js).
//
// Autoplay policy: the AudioContext starts suspended everywhere. We
// resume on the first pointerdown/keydown or XR session start; until
// then ambient starts are queued (latest wins) and SFX are dropped.

import * as THREE from "three";
import { createSystem } from "@iwsdk/core";
import { sceneById, sfxLibrary } from "./manifest.js";

const AMBIENT_VOLUME_DEFAULT = 0.35;
const CROSSFADE_S = 1.5;
const DUCK_FACTOR = 0.5; // -6dB
const DUCK_RAMP_S = 0.3;

interface SceneAudioInfo {
  ambient?: string;
  ambientVolume?: number;
}

export class AudioManagerSystem extends createSystem({}) {
  private listener!: THREE.AudioListener;
  private ambientA!: THREE.Audio;
  private ambientB!: THREE.Audio;
  private activeSlot: "A" | "B" = "A";
  private uiAudio!: THREE.Audio;
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private unlocked = false;
  private pendingAmbient: { url: string; volume: number } | null = null;
  private ducked = false;
  private currentVolume = AMBIENT_VOLUME_DEFAULT;

  init() {
    this.listener = new THREE.AudioListener();
    this.world.camera.add(this.listener);
    this.ambientA = new THREE.Audio(this.listener);
    this.ambientB = new THREE.Audio(this.listener);
    this.uiAudio = new THREE.Audio(this.listener);

    const unlock = () => {
      if (this.unlocked) return;
      this.unlocked = true;
      this.listener.context.resume().then(() => {
        if (this.pendingAmbient) {
          const { url, volume } = this.pendingAmbient;
          this.pendingAmbient = null;
          this.startAmbient(url, volume);
        }
      });
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    this.world.visibilityState.subscribe(() => unlock());

    window.addEventListener("scene-loading", (e) => {
      const sceneId = (e as CustomEvent).detail?.sceneId;
      const info = (sceneId ? sceneById[sceneId] : null) as SceneAudioInfo | null;
      if (info?.ambient) void this.loadBuffer(info.ambient); // warm the cache
    });

    window.addEventListener("scene-changed", (e) => {
      const sceneId = (e as CustomEvent).detail?.sceneId;
      const info = (sceneId ? sceneById[sceneId] : null) as SceneAudioInfo | null;
      if (info?.ambient) {
        this.startAmbient(info.ambient, info.ambientVolume ?? AMBIENT_VOLUME_DEFAULT);
      } else {
        this.stopAmbient();
      }
    });

    window.addEventListener("prop-interaction", (e) => {
      const { propId, sceneId, trigger } = (e as CustomEvent).detail ?? {};
      if (trigger === "gaze-off") return;
      const scene = sceneId ? sceneById[sceneId] : null;
      // Props in manifest.js are untyped JS; the empty arrays infer as
      // never[] until real entries exist, hence the local cast.
      const props = (scene?.props ?? []) as {
        id: string;
        interaction?: Record<string, { sfx?: string } | undefined>;
      }[];
      const prop = props.find((p) => p.id === propId);
      const sfxKey = prop?.interaction?.[trigger === "wave" ? "wave" : trigger]?.sfx;
      if (sfxKey) this.playSfx(sfxKey);
    });

    window.addEventListener("teleport-request", () => this.playSfx("portal-whoosh"));
    window.addEventListener("hud-toggled", () => this.playSfx("hud-blip"));

    window.addEventListener("proxie-speaking-started", () => this.setDucked(true));
    window.addEventListener("proxie-speaking-ended", () => this.setDucked(false));
  }

  private loadBuffer(url: string): Promise<AudioBuffer | null> {
    let promise = this.buffers.get(url);
    if (!promise) {
      promise = new Promise((resolve) => {
        new THREE.AudioLoader().load(
          url,
          (buffer) => resolve(buffer),
          undefined,
          () => resolve(null) // asset not generated yet -- silent no-op
        );
      });
      this.buffers.set(url, promise);
    }
    return promise;
  }

  private ambient(slot: "A" | "B"): THREE.Audio {
    return slot === "A" ? this.ambientA : this.ambientB;
  }

  private async startAmbient(url: string, volume: number): Promise<void> {
    if (!this.unlocked) {
      this.pendingAmbient = { url, volume };
      return;
    }
    const buffer = await this.loadBuffer(url);
    if (!buffer) return;
    this.currentVolume = volume;

    const from = this.ambient(this.activeSlot);
    this.activeSlot = this.activeSlot === "A" ? "B" : "A";
    const to = this.ambient(this.activeSlot);

    if (to.isPlaying) to.stop();
    to.setBuffer(buffer);
    to.setLoop(true);
    to.setVolume(0);
    to.play();

    const ctx = this.listener.context;
    const target = this.ducked ? volume * DUCK_FACTOR : volume;
    to.gain.gain.linearRampToValueAtTime(target, ctx.currentTime + CROSSFADE_S);
    if (from.isPlaying) {
      from.gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + CROSSFADE_S);
      setTimeout(() => from.isPlaying && from.stop(), CROSSFADE_S * 1000 + 100);
    }
  }

  private stopAmbient(): void {
    const active = this.ambient(this.activeSlot);
    if (!active.isPlaying) return;
    const ctx = this.listener.context;
    active.gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + CROSSFADE_S);
    setTimeout(() => active.isPlaying && active.stop(), CROSSFADE_S * 1000 + 100);
  }

  private setDucked(ducked: boolean): void {
    this.ducked = ducked;
    const active = this.ambient(this.activeSlot);
    if (!active.isPlaying) return;
    const ctx = this.listener.context;
    const target = ducked ? this.currentVolume * DUCK_FACTOR : this.currentVolume;
    active.gain.gain.cancelScheduledValues(ctx.currentTime);
    active.gain.gain.linearRampToValueAtTime(target, ctx.currentTime + DUCK_RAMP_S);
  }

  private async playSfx(key: string): Promise<void> {
    if (!this.unlocked) return; // drop pre-unlock SFX
    const url = (sfxLibrary as Record<string, string>)[key];
    if (!url) return;
    const buffer = await this.loadBuffer(url);
    if (!buffer) return;
    // 2D playback for now; positional attachment at the emitting prop is
    // a follow-up once real SFX assets exist to tune (tracker row).
    const node = this.uiAudio;
    if (node.isPlaying) node.stop();
    node.setBuffer(buffer);
    node.setLoop(false);
    node.setVolume(0.8);
    node.play();
  }
}
