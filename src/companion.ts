// companion.ts
//
// JB Proxie as an embodied companion (TECH_SPEC §E) -- billboard adapter.
// A persistent sprite of the existing 2D avatar art follows the visitor
// through every scene under strict personal-space rules ("pleasant
// companion, not shop assistant"):
//
//   - anchors 2.5-3.0m away, 30-45 degrees off view center
//   - never inside 1.5m of the player
//   - sidesteps if it lingers in the center-view cone >1.5s
//   - approaches (to 1.8m) ONLY when addressed via chat/mic or after the
//     visitor dwells on an interactive prop
//
// State machine: hidden -> idle -> relocate <-> summoned -> talking.
// Talk state is driven by the proxie-speaking / proxie-stream events
// published by proxie-chat.js (double-keyed for the Quest-TTS risk).
// No pathfinding: straight-line steering on the open ring around the
// player -- the same open-circle assumption the portal ring relies on.
//
// The rigged-GLB adapter (idle/walk/talk clips) swaps in behind the same
// state machine once the avatar asset exists; this billboard is the
// guaranteed demo fallback.

import * as THREE from "three";
import { createSystem } from "@iwsdk/core";
import { registerGazeTarget, unregisterGazeTarget } from "./gazeContext";

// Same hosted art as the chat overlay -- one character across surfaces.
const ART = {
  hello:
    "https://images.squarespace-cdn.com/content/v1/63d97f26da579b2cafb101da/a3e81bda-8aec-460b-916c-54539a05d053/avatar_hello.PNG?format=500w",
  thinking:
    "https://images.squarespace-cdn.com/content/v1/63d97f26da579b2cafb101da/8bf6ca11-2e71-4271-b99d-6dd0afbb3b92/avatar-thinking.PNG?format=500w",
  idle:
    "https://images.squarespace-cdn.com/content/v1/63d97f26da579b2cafb101da/96334f3a-aece-411d-89bf-6f1491fde54c/avatar-idle.PNG?format=500w",
};

type CompanionState = "hidden" | "idle" | "relocate" | "summoned" | "talking";

const SPRITE_HEIGHT = 1.1;
const ANCHOR_MIN = 2.5;
const ANCHOR_MAX = 3.0;
const SUMMON_DISTANCE = 1.8;
const HARD_FLOOR = 1.5; // never closer than this
const RELOCATE_TRIGGER_DISTANCE = 4.0;
const WALK_SPEED = 1.2; // m/s
const CENTER_CONE_RAD = (15 * Math.PI) / 180;
const CENTER_LINGER_MS = 1500;
const APPEAR_DELAY_MS = 1000;
const TALK_LINGER_MS = 2000;
const BOB_HZ = 2;
const BOB_AMPLITUDE = 0.05;

const _playerPos = new THREE.Vector3();
const _companionPos = new THREE.Vector3();
const _toCompanion = new THREE.Vector3();
const _viewDir = new THREE.Vector3();
const _target = new THREE.Vector3();

export class CompanionSystem extends createSystem({}) {
  private sprite!: THREE.Sprite;
  private material!: THREE.SpriteMaterial;
  private textures: Partial<Record<keyof typeof ART, THREE.Texture>> = {};
  private state: CompanionState = "hidden";
  private appearAt = 0;
  private centerSince = 0;
  private talkEndedAt = 0;
  private streaming = false;
  private speaking = false;
  private summonRequested = false;
  private targetPos = new THREE.Vector3();
  private hasTarget = false;
  private bobPhase = 0;

  init() {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    for (const [key, url] of Object.entries(ART) as [keyof typeof ART, string][]) {
      loader.load(url, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        this.textures[key] = texture;
        if (key === "idle" && this.material.map === null) this.setArt("idle");
      });
    }

    this.material = new THREE.SpriteMaterial({ transparent: true, opacity: 0, depthTest: true });
    this.sprite = new THREE.Sprite(this.material);
    this.sprite.scale.set(SPRITE_HEIGHT * 0.8, SPRITE_HEIGHT, 1);
    this.sprite.visible = false;
    this.sprite.renderOrder = 1;
    this.world.scene.add(this.sprite);

    registerGazeTarget(this.sprite, {
      id: "jb-proxie",
      label: "JB Proxie",
      description:
        "Jeff's AI guide, walking along with the visitor. Trained on Jeff's research, resume, and philosophy; happy to explain whatever the visitor is looking at.",
    });

    window.addEventListener("scene-loading", () => this.setState("hidden"));
    window.addEventListener("scene-changed", () => {
      this.appearAt = performance.now() + APPEAR_DELAY_MS;
    });

    // "Addressed" = a chat/mic message went out.
    window.addEventListener("proxie-stream-started", () => {
      this.streaming = true;
      this.summonRequested = true;
      this.refreshTalkState();
    });
    window.addEventListener("proxie-stream-ended", () => {
      this.streaming = false;
      this.refreshTalkState();
    });
    window.addEventListener("proxie-speaking-started", () => {
      this.speaking = true;
      this.refreshTalkState();
    });
    window.addEventListener("proxie-speaking-ended", () => {
      this.speaking = false;
      this.refreshTalkState();
    });

    // Dwelling on an interactive prop invites him over to comment.
    window.addEventListener("prop-interaction", (e) => {
      if ((e as CustomEvent).detail?.trigger === "gaze") this.summonRequested = true;
    });
  }

  private setArt(key: keyof typeof ART): void {
    const texture = this.textures[key];
    if (texture) this.material.map = texture;
    this.material.needsUpdate = true;
  }

  private setState(state: CompanionState): void {
    if (this.state === state) return;
    this.state = state;
    this.sprite.visible = state !== "hidden";
    if (state === "hidden") {
      this.material.opacity = 0;
      this.hasTarget = false;
      this.summonRequested = false;
    }
    this.setArt(state === "talking" ? "hello" : this.streaming ? "thinking" : "idle");
    window.dispatchEvent(new CustomEvent("companion-state-changed", { detail: { state } }));
  }

  private refreshTalkState(): void {
    if (this.state === "hidden") return;
    if (this.speaking || this.streaming) {
      this.setState("talking");
    } else if (this.state === "talking") {
      this.talkEndedAt = performance.now();
    }
  }

  /** Pick an anchor on the ring around the player, 30-45deg off view center. */
  private pickAnchor(distance = ANCHOR_MIN + Math.random() * (ANCHOR_MAX - ANCHOR_MIN)): void {
    this.world.camera.getWorldDirection(_viewDir);
    const viewYaw = Math.atan2(_viewDir.x, _viewDir.z);
    const side = Math.random() < 0.5 ? 1 : -1;
    const offset = ((30 + Math.random() * 15) * Math.PI) / 180;
    const yaw = viewYaw + side * offset;
    this.targetPos.set(
      _playerPos.x + Math.sin(yaw) * distance,
      SPRITE_HEIGHT / 2,
      _playerPos.z + Math.cos(yaw) * distance
    );
    this.hasTarget = true;
  }

  update(delta: number) {
    const now = performance.now();
    this.world.player.getWorldPosition(_playerPos);

    if (this.state === "hidden") {
      if (this.appearAt && now >= this.appearAt) {
        this.appearAt = 0;
        this.pickAnchor();
        this.sprite.position.copy(this.targetPos);
        this.setState("idle");
      }
      return;
    }

    // Fade in.
    if (this.material.opacity < 1) {
      this.material.opacity = Math.min(this.material.opacity + delta * 2, 1);
    }

    this.sprite.getWorldPosition(_companionPos);
    const distanceToPlayer = Math.hypot(
      _companionPos.x - _playerPos.x,
      _companionPos.z - _playerPos.z
    );

    // Talking linger: drift back to idle a beat after speech ends.
    if (this.state === "talking" && !this.speaking && !this.streaming) {
      if (now - this.talkEndedAt > TALK_LINGER_MS) {
        this.summonRequested = false;
        this.setState("idle");
        this.pickAnchor();
      }
    }

    // Summon: approach to conversation distance when addressed.
    if (this.summonRequested && this.state === "idle") {
      this.setState("summoned");
      this.pickAnchor(SUMMON_DISTANCE);
    }

    if (this.state === "idle") {
      // Player walked away -> relocate to a fresh anchor.
      if (distanceToPlayer > RELOCATE_TRIGGER_DISTANCE) {
        this.setState("relocate");
        this.pickAnchor();
      } else {
        // Sidestep if lingering in the player's center view.
        this.world.camera.getWorldDirection(_viewDir);
        _toCompanion.subVectors(_companionPos, _playerPos).setY(0).normalize();
        _viewDir.setY(0).normalize();
        const angle = _viewDir.angleTo(_toCompanion);
        if (angle < CENTER_CONE_RAD) {
          if (!this.centerSince) this.centerSince = now;
          else if (now - this.centerSince > CENTER_LINGER_MS) {
            this.centerSince = 0;
            this.setState("relocate");
            this.pickAnchor();
          }
        } else {
          this.centerSince = 0;
        }
      }
    }

    // Steering toward the current target (relocate / summoned / drift).
    if (this.hasTarget) {
      _target.copy(this.targetPos);
      // Enforce the hard floor: never steer inside 1.5m of the player.
      const targetDistance = Math.hypot(_target.x - _playerPos.x, _target.z - _playerPos.z);
      if (targetDistance < HARD_FLOOR) {
        const scale = HARD_FLOOR / Math.max(targetDistance, 0.001);
        _target.set(
          _playerPos.x + (_target.x - _playerPos.x) * scale,
          _target.y,
          _playerPos.z + (_target.z - _playerPos.z) * scale
        );
      }
      const remaining = Math.hypot(
        _target.x - _companionPos.x,
        _target.z - _companionPos.z
      );
      if (remaining > 0.05) {
        const step = Math.min(WALK_SPEED * delta, remaining);
        this.sprite.position.x += ((_target.x - _companionPos.x) / remaining) * step;
        this.sprite.position.z += ((_target.z - _companionPos.z) / remaining) * step;
      } else {
        this.hasTarget = this.state === "summoned"; // summoned holds position
        if (this.state === "relocate") this.setState("idle");
      }
    }

    // Gentle bob while talking (billboard's stand-in for a talk clip).
    if (this.state === "talking") {
      this.bobPhase += delta * Math.PI * 2 * BOB_HZ;
      this.sprite.position.y = SPRITE_HEIGHT / 2 + Math.sin(this.bobPhase) * BOB_AMPLITUDE;
    } else {
      this.sprite.position.y = SPRITE_HEIGHT / 2;
    }
  }

  destroy() {
    unregisterGazeTarget(this.sprite);
    super.destroy?.();
  }
}
