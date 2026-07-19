// proxie-chat.js
//
// Chat overlay wired to the REAL Proxie contract (verified against
// avatar-chat/main.py and chat-block.html -- not a guess):
//
//   POST <PROXIE_ENDPOINT>  body: { message, session_id, scene_context }
//   -> text/event-stream, lines of: data: {"token": "..."}\n\n
//
// scene_context is a short "World -- Scene: description" string built from
// manifest.js for whichever scene the visitor is currently standing in
// (via sceneManager.getCurrentSceneId()), so "what is this?" answers about
// the scene instead of the chatbot itself. main.py folds it into the
// system messages for that one turn only -- it's not saved into the
// session's stored history, since the scene changes over time and old
// turns shouldn't get stamped with whatever scene was current when they
// happened.
//   -> an optional trailing "---LINKS---" marker, followed by
//      "Title|https://url" lines, same convention chat-block.html renders
//      as link pills.
//
// PROXIE_ENDPOINT should be the Cloudflare Worker URL
// (https://jeff-avatar-proxy.jeff-d02.workers.dev/), NOT the Tailscale
// Funnel URL directly -- the Worker is what injects the X-API-Key header
// server-side so the key never has to live in this frontend. See
// docs/DEPLOYMENT.md for the CORS caveat: the Worker needs to allow
// whatever origin this app ends up hosted at.
//
// NOT YET SUPPORTED BY THE BACKEND: scene teleportation. There is no
// action/sceneId field in the current /chat response -- that would need a
// new marker convention (e.g. "---TELEPORT:scene-02-smart-glasses-lab---")
// added to avatar-chat's system_prompt.txt plus a matching parse in
// main.py's stream_ollama, mirroring how ---LINKS--- already works. This
// file parses for that marker defensively so it activates the moment the
// backend adds it, but until then every scene change here has to happen
// via portal clicks in-world, not from chat.

import { sceneById } from "./manifest.js";

const PROXIE_ENDPOINT =
  import.meta.env.VITE_PROXIE_ENDPOINT || "https://jeff-avatar-proxy.jeff-d02.workers.dev/";

const LINKS_MARKER = "---LINKS---";
const TELEPORT_MARKER = "---TELEPORT:"; // proposed convention, not live yet -- see header comment

// One session id per page load, matching chat-block.html's pattern -- keeps
// conversation continuity with Proxie's server-side session memory.
const SESSION_ID = crypto.randomUUID();

// Same three avatar states + same hosted images as the existing 2D
// chat-block.html widget on jeffxr.com (Squarespace CDN, already public --
// no need to duplicate the files into this repo). Kept identical on
// purpose so Proxie reads as the same character across both surfaces.
const AVATAR_HELLO =
  "https://images.squarespace-cdn.com/content/v1/63d97f26da579b2cafb101da/a3e81bda-8aec-460b-916c-54539a05d053/avatar_hello.PNG?format=500w";
const AVATAR_THINKING =
  "https://images.squarespace-cdn.com/content/v1/63d97f26da579b2cafb101da/8bf6ca11-2e71-4271-b99d-6dd0afbb3b92/avatar-thinking.PNG?format=500w";
const AVATAR_IDLE =
  "https://images.squarespace-cdn.com/content/v1/63d97f26da579b2cafb101da/96334f3a-aece-411d-89bf-6f1491fde54c/avatar-idle.PNG?format=500w";

export function initChatOverlay(sceneManager) {
  const form = document.querySelector("#chat-form");
  const input = document.querySelector("#chat-input");
  const log = document.querySelector("#chat-log");
  const avatarImg = document.querySelector("#avatar-img");
  const micButton = document.querySelector("#chat-mic");
  const muteButton = document.querySelector("#chat-mute");

  // Fade-swap, matching chat-block.html's setAvatar() exactly.
  function setAvatar(src) {
    if (!avatarImg) return;
    avatarImg.style.opacity = "0";
    setTimeout(() => {
      avatarImg.src = src;
      avatarImg.style.opacity = "1";
    }, 220);
  }

  function appendMessage(role, text) {
    const line = document.createElement("div");
    line.className = "chat-line chat-" + role;
    line.textContent = text;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
    return line;
  }

  function renderLinks(linksText) {
    const lines = linksText.trim().split("\n").filter((l) => l.includes("|"));
    if (!lines.length) return;

    const panel = document.createElement("div");
    panel.className = "chat-line chat-proxie chat-links";
    lines.forEach((lineText) => {
      const pipe = lineText.indexOf("|");
      if (pipe === -1) return;
      const title = lineText.slice(0, pipe).trim();
      const url = lineText.slice(pipe + 1).trim();
      if (!title || !url) return;

      const a = document.createElement("a");
      a.href = url;
      a.textContent = title;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      panel.appendChild(a);
    });
    log.appendChild(panel);
    log.scrollTop = log.scrollHeight;
  }

  window.addEventListener("scene-changed", (e) => {
    appendMessage("system", "-- now in: " + e.detail.scene.title + " --");
  });

  function currentSceneContext() {
    const sceneId = sceneManager.getCurrentSceneId();
    const scene = sceneId ? sceneById[sceneId] : null;
    if (!scene) return "";
    let context = `${scene.worldTitle} -- ${scene.title}: ${scene.description}`;

    // Gaze awareness (src/gazeContext.ts): tell Proxie what the visitor is
    // physically looking at, so "what is this?" has a referent. The
    // backend needs no changes -- this just rides along inside the
    // scene_context string it already folds into the system prompt.
    const gaze = window.__gazeContext;
    if (gaze?.lookingAt) {
      const { label, description } = gaze.lookingAt;
      context += `. The visitor is currently looking at: ${label}` + (description ? ` -- ${description}` : "");
    }
    const others = (gaze?.visible ?? [])
      .filter((v) => v.id !== gaze?.lookingAt?.id)
      .map((v) => v.label)
      .slice(0, 6);
    if (others.length) {
      context += `. Also visible on screen: ${others.join(", ")}`;
    }
    return context;
  }

  // ----------------------------------------------------------------
  // Voice output: speak Proxie's reply sentence-by-sentence as the SSE
  // stream produces it (browser speechSynthesis -- works on desktop and
  // Quest browser, nothing server-side). Muted via the header toggle.
  // ----------------------------------------------------------------
  let ttsMuted = localStorage.getItem("proxie-tts-muted") === "1";
  const ttsSupported = "speechSynthesis" in window;

  function reflectMuteState() {
    if (!muteButton) return;
    if (!ttsSupported) {
      muteButton.hidden = true;
      return;
    }
    muteButton.textContent = ttsMuted ? "🔇" : "🔊";
    muteButton.classList.toggle("muted", ttsMuted);
  }
  reflectMuteState();

  muteButton?.addEventListener("click", () => {
    ttsMuted = !ttsMuted;
    localStorage.setItem("proxie-tts-muted", ttsMuted ? "1" : "0");
    if (ttsMuted && ttsSupported) window.speechSynthesis.cancel();
    reflectMuteState();
  });

  // ----------------------------------------------------------------
  // Speaking / streaming state broadcast. The companion avatar keys its
  // talk animation off these, and the audio manager ducks the ambient
  // loop. Double-keyed (TTS utterances AND SSE stream activity) because
  // speechSynthesis voices are unverified on Quest browser -- if TTS
  // never fires there, stream activity still drives the talk state.
  // ----------------------------------------------------------------
  let activeUtterances = 0;
  function setSpeaking(on) {
    window.__proxieSpeaking = on;
    window.dispatchEvent(new CustomEvent(on ? "proxie-speaking-started" : "proxie-speaking-ended"));
  }
  function utteranceStarted() {
    if (++activeUtterances === 1) setSpeaking(true);
  }
  function utteranceDone() {
    if (activeUtterances > 0 && --activeUtterances === 0) setSpeaking(false);
  }

  function speak(text) {
    const cleaned = text.trim();
    if (!ttsSupported || ttsMuted || !cleaned) return;
    const utterance = new SpeechSynthesisUtterance(cleaned);
    utterance.rate = 1.05;
    utterance.onstart = utteranceStarted;
    utterance.onend = utteranceDone;
    utterance.onerror = utteranceDone;
    window.speechSynthesis.speak(utterance);
  }

  // Feeds streaming tokens in; flushes complete sentences out to speak().
  function makeSentenceSpeaker() {
    let spokenUpTo = 0;
    return {
      push(fullText) {
        const speakable = fullText.split(LINKS_MARKER)[0];
        // Flush every complete sentence we haven't spoken yet.
        const re = /[.!?](?:\s|$)/g;
        re.lastIndex = spokenUpTo;
        let match;
        let flushEnd = spokenUpTo;
        while ((match = re.exec(speakable)) !== null) flushEnd = re.lastIndex;
        if (flushEnd > spokenUpTo) {
          speak(speakable.slice(spokenUpTo, flushEnd));
          spokenUpTo = flushEnd;
        }
      },
      finish(fullText) {
        const speakable = fullText.split(LINKS_MARKER)[0].trimEnd();
        if (spokenUpTo < speakable.length) speak(speakable.slice(spokenUpTo));
      },
    };
  }

  async function sendMessage(message, { hidden = false } = {}) {
    if (!message) return;

    if (ttsSupported) window.speechSynthesis.cancel();
    // Hidden prompts (companion taps, gaze commentary) skip the user
    // bubble -- only Proxie's reply appears, so he seems to speak up on
    // his own instead of echoing a stage direction.
    if (!hidden) appendMessage("user", message);
    input.value = "";
    input.disabled = true;

    const replyEl = appendMessage("proxie", "...");
    let fullText = "";
    let firstToken = true;
    const speaker = makeSentenceSpeaker();

    setAvatar(AVATAR_THINKING);
    window.dispatchEvent(new CustomEvent("proxie-stream-started"));

    try {
      const res = await fetch(PROXIE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          session_id: SESSION_ID,
          scene_context: currentSceneContext(),
        }),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let lineBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // A chunk can split mid-line -- only process complete lines, keep
        // the trailing partial line for the next chunk (same approach as
        // chat-block.html).
        lineBuffer += decoder.decode(value, { stream: true });
        const lines = lineBuffer.split("\n");
        lineBuffer = lines.pop();

        for (const l of lines) {
          if (!l.startsWith("data: ") || l === "data: [DONE]") continue;
          try {
            const data = JSON.parse(l.slice(6));
            if (data.token) {
              if (firstToken) {
                firstToken = false;
                fullText = "";
              }
              fullText += data.token;
              replyEl.textContent = fullText.split(LINKS_MARKER)[0].trimEnd();
              speaker.push(fullText);
            }
            if (data.error) {
              replyEl.textContent = "Proxie encountered an error. Please try again.";
            }
          } catch {
            // ignore malformed SSE line, matches chat-block.html's tolerance
          }
        }
      }

      const parts = fullText.split(LINKS_MARKER);
      replyEl.textContent = parts[0].trimEnd();
      if (parts[1]) renderLinks(parts[1]);
      speaker.finish(fullText);

      // Proposed teleport marker -- inert until the backend actually emits
      // it (see header comment). Safe to leave in: it just won't match
      // anything today.
      const teleportIdx = parts[0].indexOf(TELEPORT_MARKER);
      if (teleportIdx !== -1) {
        const sceneId = parts[0].slice(teleportIdx + TELEPORT_MARKER.length).split(/[\s-]*$/)[0].trim();
        if (sceneId && window.teleportTo) window.teleportTo(sceneId);
      }

      setAvatar(AVATAR_IDLE);
    } catch (err) {
      replyEl.textContent = "Proxie request failed (" + err.message + ").";
      setAvatar(AVATAR_IDLE);
    } finally {
      window.dispatchEvent(new CustomEvent("proxie-stream-ended"));
      input.disabled = false;
      input.focus();
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    sendMessage(input.value.trim());
  });

  // ----------------------------------------------------------------
  // Companion-initiated conversation (Jeff's ask 2026-07-19: "he was
  // just there, but I wasn't able to trigger any responses"). Two ways
  // the walking Proxie now speaks without the visitor typing anything:
  //   1. Click/tap him -> a hidden greeting prompt; only his reply shows.
  //   2. Gaze-dwell on an interactive prop -> he walks over (companion
  //      state machine already does this) AND comments on it, using the
  //      gaze target already embedded in scene_context.
  // Hidden prompts never render a user bubble, are skipped while a
  // reply is streaming, and gaze commentary is throttled: once per prop
  // per scene visit, minimum 45s between comments.
  // ----------------------------------------------------------------
  const GAZE_COMMENT_COOLDOWN_MS = 45000;
  let lastGazeCommentAt = 0;
  let commentedProps = new Set();
  window.addEventListener("scene-changed", () => {
    commentedProps = new Set();
  });
  window.addEventListener("prop-interaction", (e) => {
    const d = e.detail || {};
    if (input.disabled) return; // a reply is already streaming
    if (d.propId === "jb-proxie" && d.trigger === "click") {
      sendMessage(
        "(The visitor just tapped you on the shoulder in the scene. Greet them warmly in one or two sentences and invite them to ask about whatever they're looking at.)",
        { hidden: true }
      );
      return;
    }
    if (d.trigger === "gaze" && d.propId && d.propId !== "jb-proxie") {
      const now = Date.now();
      if (commentedProps.has(d.propId) || now - lastGazeCommentAt < GAZE_COMMENT_COOLDOWN_MS) return;
      commentedProps.add(d.propId);
      lastGazeCommentAt = now;
      sendMessage(
        "(Unprompted: the visitor has been looking at the object named in your scene context. Walk over and offer one or two enthusiastic sentences about it -- no greeting, just the interesting bit.)",
        { hidden: true }
      );
    }
  });

  // ----------------------------------------------------------------
  // Voice input: push-to-talk via the Web Speech API. Feature-detected --
  // Chrome/Edge desktop have it; where it's missing (Firefox, some
  // headset browsers) the mic button simply never appears and typing
  // remains the path. Hold the button (or click to toggle) to dictate;
  // the interim transcript previews in the input, and the final result
  // sends as a normal message so the whole pipeline (gaze context, SSE,
  // TTS reply) is identical to typing.
  // ----------------------------------------------------------------
  const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (micButton && SpeechRecognitionImpl) {
    micButton.hidden = false;

    let recognition = null;
    let listening = false;

    function stopListening() {
      listening = false;
      micButton.classList.remove("listening");
      recognition?.stop();
    }

    function startListening() {
      if (listening) return;
      listening = true;
      micButton.classList.add("listening");

      recognition = new SpeechRecognitionImpl();
      recognition.lang = navigator.language || "en-US";
      recognition.interimResults = true;
      recognition.continuous = false;

      let finalTranscript = "";
      recognition.onresult = (event) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) finalTranscript += result[0].transcript;
          else interim += result[0].transcript;
        }
        input.value = (finalTranscript + interim).trim();
      };
      recognition.onerror = (event) => {
        if (event.error === "not-allowed") {
          appendMessage("system", "-- microphone permission denied; type instead --");
          micButton.hidden = true;
        }
        stopListening();
      };
      recognition.onend = () => {
        listening = false;
        micButton.classList.remove("listening");
        const message = input.value.trim();
        if (message) sendMessage(message);
      };
      recognition.start();
    }

    micButton.addEventListener("click", () => {
      if (listening) stopListening();
      else startListening();
    });
  }
}
