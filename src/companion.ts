// companion.ts
//
// JB Proxie as an embodied companion (TECH_SPEC §E) -- billboard adapter
// plus the rigged-GLB adapter (tracker T082). A persistent JB Proxie
// follows the visitor through every scene under strict personal-space
// rules ("pleasant companion, not shop assistant"):
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
// Presentation is split from the state machine: the Mint-generated rigged
// avatar (companionAvatar.ts, mint-assets.json "proxie-avatar") loads in
// the background and swaps in over the billboard sprite of the 2D art;
// if it fails to load, the billboard remains the guaranteed demo path.
// Clip map: idle->idle, relocate->walk, summoned->listen, talking->talk,
// plus a one-shot wave on each scene appearance. "companion-nod" and
// "companion-flinch" window events expose the Agree/Hit-Reaction one-shots
// for the S2 rubber-hand beat.

import * as THREE from "three";
import { createSystem } from "@iwsdk/core";
import { registerGazeTarget, unregisterGazeTarget } from "./gazeContext";
import { registerInteractive, unregisterInteractive } from "./interactions";
import { CompanionAvatar } from "./companionAvatar";
import { editModeEnabled } from "./editor";

// ?proxie=billboard forces the 2D sprite (skip the rigged GLB entirely)
// -- quick escape hatch while the 3D look is still being decided.
const FORCE_BILLBOARD =
  typeof location !== "undefined" &&
  new URLSearchParams(location.search).get("proxie") === "billboard";

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
const TURN_SPEED = 2.5; // rad/s yaw easing toward the facing target
// Facing hysteresis: while standing he only re-orients once the target
// drifts >30deg off his nose, then settles to within 5deg -- constant
// micro-tracking of the player read as unsettling swaying.
const TURN_START_RAD = (30 * Math.PI) / 180;
const TURN_STOP_RAD = (5 * Math.PI) / 180;

const GAZE_META = {
  id: "jb-proxie",
  label: "JB Proxie",
  description:
    "Jeff's AI guide, walking along with the visitor. Trained on Jeff's research, resume, and philosophy; happy to explain whatever the visitor is looking at.",
};

const _playerPos = new THREE.Vector3();
const _companionPos = new THREE.Vector3();
const _toCompanion = new THREE.Vector3();
const _viewDir = new THREE.Vector3();
const _target = new THREE.Vector3();

export class CompanionSystem extends createSystem({}) {
  private sprite!: THREE.Sprite;
  private material!: THREE.SpriteMaterial;
  private textures: Partial<Record<keyof typeof ART, THREE.Texture>> = {};
  private avatar: CompanionAvatar | null = null;
  private state: CompanionState = "hidden";
  private appearAt = 0;
  private waveOnAppear = false;
  private centerSince = 0;
  private talkEndedAt = 0;
  private streaming = false;
  private speaking = false;
  private summonRequested = false;
  private targetPos = new THREE.Vector3();
  private hasTarget = false;
  private moving = false;
  private bobPhase = 0;
  private facingYaw = 0;

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
    registerGazeTarget(this.sprite, GAZE_META);
    // Clickable: tapping Proxie makes him speak (proxie-chat.js listens
    // for this propId and fires a hidden greeting prompt).
    registerInteractive(this.sprite, "jb-proxie", "companion", {
      click: { effect: "pulse" },
    });

    // Rigged avatar streams in behind the billboard and takes over
    // seamlessly; any failure leaves the billboard path untouched.
    // ?proxie=billboard skips it; ?edit hides the companion entirely so
    // he doesn't wander through prop-arrangement shots.
    if (!FORCE_BILLBOARD && !editModeEnabled) {
      CompanionAvatar.load()
        .then((avatar) => this.adoptAvatar(avatar))
        .catch((error) => {
          console.warn("[companion] rigged avatar unavailable, billboard fallback stays", error);
        });
    }

    window.addEventListener("scene-loading", () => this.setState("hidden"));
    window.addEventListener("scene-changed", () => {
      if (editModeEnabled) return; // stay hidden while arranging props
      this.appearAt = performance.now() + APPEAR_DELAY_MS;
      this.waveOnAppear = true;
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

    // One-shot hooks for scripted beats (S2 rubber-hand flinch, agreements).
    window.addEventListener("companion-nod", () => this.avatar?.playOnce("nod"));
    window.addEventListener("companion-flinch", () => this.avatar?.playOnce("flinch"));
  }

  /** The object the state machine positions: rigged avatar once ready. */
  private get root(): THREE.Object3D {
    return this.avatar ? this.avatar.group : this.sprite;
  }

  /**
   * Height of the representation's origin above the floor. The world
   * floor is NOT y=0: Marble scenes put the origin at the generation
   * camera and sceneManager stands the player rig on the raycast floor,
   * so the player rig's y is the live floor height (see loadScene).
   */
  private get baseY(): number {
    return this.avatar ? 0 : SPRITE_HEIGHT / 2;
  }

  private adoptAvatar(avatar: CompanionAvatar): void {
    this.avatar = avatar;
    avatar.group.position.set(
      this.sprite.position.x,
      this.sprite.position.y - SPRITE_HEIGHT / 2, // sprite center -> feet
      this.sprite.position.z
    );
    avatar.group.rotation.y = this.facingYaw;
    avatar.group.visible = this.state !== "hidden";
    avatar.setOpacity(this.state === "hidden" ? 0 : this.material.opacity);
    this.world.scene.add(avatar.group);
    this.targetPos.y = avatar.group.position.y;

    unregisterGazeTarget(this.sprite);
    this.sprite.visible = false;
    registerGazeTarget(avatar.group, GAZE_META);
    unregisterInteractive("jb-proxie");
    registerInteractive(avatar.group, "jb-proxie", "companion", {
      click: { effect: "pulse" },
    });

    this.applyPresentation();
  }

  private setArt(key: keyof typeof ART): void {
    const texture = this.textures[key];
    if (texture) this.material.map = texture;
    this.material.needsUpdate = true;
  }

  private setState(state: CompanionState): void {
    if (this.state === state) return;
    this.state = state;
    this.root.visible = state !== "hidden";
    if (state === "hidden") {
      this.material.opacity = 0;
      this.avatar?.setOpacity(0);
      this.hasTarget = false;
      this.moving = false;
      this.summonRequested = false;
    }
    this.applyPresentation();
    window.dispatchEvent(new CustomEvent("companion-state-changed", { detail: { state } }));
  }

  /** Maps state (+motion) onto sprite art or avatar clips. */
  private applyPresentation(): void {
    if (this.avatar) {
      if (this.state === "hidden") return;
      if (this.moving && this.avatar.has("walk")) {
        this.avatar.play("walk");
      } else if (this.state === "talking") {
        this.avatar.play(this.avatar.has("talk") ? "talk" : "idle");
      } else if ((this.state === "summoned" || this.streaming) && this.avatar.has("listen")) {
        this.avatar.play("listen");
      } else {
        this.avatar.play("idle");
      }
    } else {
      this.setArt(this.state === "talking" ? "hello" : this.streaming ? "thinking" : "idle");
    }
  }

  private refreshTalkState(): void {
    if (this.state === "hidden") return;
    if (this.speaking || this.streaming) {
      this.setState("talking");
    } else if (this.state === "talking") {
      this.talkEndedAt = performance.now();
    }
    this.applyPresentation();
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
      _playerPos.y + this.baseY, // player rig y = raycast floor height
      _playerPos.z + Math.cos(yaw) * distance
    );
    this.hasTarget = true;
  }

  /**
   * Ease the avatar's yaw toward a world-space direction (dx, dz).
   * While standing (hysteresis=true) he ignores small drift and only
   * turns once the target is well off his nose, then settles.
   */
  private turningToFace = false;

  private faceToward(dx: number, dz: number, delta: number, hysteresis = false): void {
    if (!this.avatar) return; // sprites billboard on their own
    if (Math.abs(dx) < 1e-4 && Math.abs(dz) < 1e-4) return;
    const targetYaw = Math.atan2(dx, dz);
    let diff = targetYaw - this.facingYaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (hysteresis) {
      if (!this.turningToFace && Math.abs(diff) < TURN_START_RAD) return;
      this.turningToFace = Math.abs(diff) > TURN_STOP_RAD;
    } else {
      this.turningToFace = false;
    }
    const step = Math.min(Math.abs(diff), TURN_SPEED * delta) * Math.sign(diff);
    this.facingYaw += step;
    this.avatar.group.rotation.y = this.facingYaw;
  }

  update(delta: number) {
    const now = performance.now();
    this.world.player.getWorldPosition(_playerPos);
    this.avatar?.update(delta);

    if (this.state === "hidden") {
      if (this.appearAt && now >= this.appearAt) {
        this.appearAt = 0;
        this.pickAnchor();
        this.root.position.copy(this.targetPos);
        this.setState("idle");
        if (this.waveOnAppear && this.avatar?.has("wave")) {
          this.waveOnAppear = false;
          this.avatar.playOnce("wave", "idle");
        }
      }
      return;
    }

    // Fade in (billboard material or avatar material set).
    if (this.avatar) {
      if (this.avatar.opacity < 1) {
        this.avatar.setOpacity(Math.min(this.avatar.opacity + delta * 2, 1));
      }
    } else if (this.material.opacity < 1) {
      this.material.opacity = Math.min(this.material.opacity + delta * 2, 1);
    }

    this.root.getWorldPosition(_companionPos);
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
    const wasMoving = this.moving;
    this.moving = false;
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
        const dx = (_target.x - _companionPos.x) / remaining;
        const dz = (_target.z - _companionPos.z) / remaining;
        this.root.position.x += dx * step;
        this.root.position.z += dz * step;
        this.moving = true;
        this.faceToward(dx, dz, delta);
      } else {
        this.hasTarget = this.state === "summoned"; // summoned holds position
        if (this.state === "relocate") this.setState("idle");
      }
    }
    if (this.moving !== wasMoving) this.applyPresentation();

    // Stationary avatar keeps polite eye contact with the visitor --
    // with hysteresis, so he doesn't micro-track every step.
    if (!this.moving) {
      this.faceToward(
        _playerPos.x - _companionPos.x,
        _playerPos.z - _companionPos.z,
        delta,
        true
      );
    }

    // Stick to the actual floor every frame -- the player rig's y is the
    // live raycast floor height, and scene loads can change it.
    const groundY = _playerPos.y + this.baseY;
    if (this.avatar) {
      this.root.position.y = groundY;
    } else if (this.state === "talking") {
      // Gentle bob while talking -- billboard's stand-in for a talk clip.
      this.bobPhase += delta * Math.PI * 2 * BOB_HZ;
      this.sprite.position.y = groundY + Math.sin(this.bobPhase) * BOB_AMPLITUDE;
    } else {
      this.sprite.position.y = groundY;
    }
  }

  destroy() {
    unregisterGazeTarget(this.sprite);
    unregisterInteractive("jb-proxie");
    if (this.avatar) {
      unregisterGazeTarget(this.avatar.group);
      this.avatar.dispose();
      this.avatar = null;
    }
    super.destroy?.();
  }
}
