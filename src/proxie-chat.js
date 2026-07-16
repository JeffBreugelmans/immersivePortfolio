// proxie-chat.js
//
// Chat overlay wired to the REAL Proxie contract (verified against
// avatar-chat/main.py and chat-block.html -- not a guess):
//
//   POST <PROXIE_ENDPOINT>  body: { message, session_id }
//   -> text/event-stream, lines of: data: {"token": "..."}\n\n
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

const PROXIE_ENDPOINT =
  import.meta.env.VITE_PROXIE_ENDPOINT || "https://jeff-avatar-proxy.jeff-d02.workers.dev/";

const LINKS_MARKER = "---LINKS---";
const TELEPORT_MARKER = "---TELEPORT:"; // proposed convention, not live yet -- see header comment

// One session id per page load, matching chat-block.html's pattern -- keeps
// conversation continuity with Proxie's server-side session memory.
const SESSION_ID = crypto.randomUUID();

export function initChatOverlay(sceneManager) {
  const form = document.querySelector("#chat-form");
  const input = document.querySelector("#chat-input");
  const log = document.querySelector("#chat-log");

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

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const message = input.value.trim();
    if (!message) return;

    appendMessage("user", message);
    input.value = "";
    input.disabled = true;

    const replyEl = appendMessage("proxie", "...");
    let fullText = "";
    let firstToken = true;

    try {
      const res = await fetch(PROXIE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, session_id: SESSION_ID }),
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

      // Proposed teleport marker -- inert until the backend actually emits
      // it (see header comment). Safe to leave in: it just won't match
      // anything today.
      const teleportIdx = parts[0].indexOf(TELEPORT_MARKER);
      if (teleportIdx !== -1) {
        const sceneId = parts[0].slice(teleportIdx + TELEPORT_MARKER.length).split(/[\s-]*$/)[0].trim();
        if (sceneId && window.teleportTo) window.teleportTo(sceneId);
      }
    } catch (err) {
      replyEl.textContent = "Proxie request failed (" + err.message + ").";
    } finally {
      input.disabled = false;
      input.focus();
    }
  });
}
