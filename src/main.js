import "aframe";
import "./portal.js";
import { initSceneManager } from "./scene-manager.js";
import { initChatOverlay } from "./proxie-chat.js";
import "./style.css";

const sceneEl = document.querySelector("#main-scene");

function boot() {
  const sceneManager = initSceneManager();
  initChatOverlay(sceneManager);
}

if (sceneEl.hasLoaded) {
  boot();
} else {
  sceneEl.addEventListener("loaded", boot);
}
