# Deploying to the Spark

Decision (confirmed): host everything on the DGX Spark, same box as Proxie.
Bandwidth is not a concern — Sonic fiber tested at 6.8 Gbps down / 7.1 Gbps
up symmetric, so serving 9 scenes' worth of Marble GLBs is well within
headroom. The remaining risk is uptime (power/ISP/crash during the exact
demo window), not throughput — worth a quick sanity check the morning of
the demo, not a blocker.

This adds a **second, independent service** alongside Proxie — it does not
touch `jeff-avatar.service` or `main.py`. If this new service crashes,
Proxie's existing chat keeps working; if Proxie has an issue, the worlds
still load.

## 1. Get the code onto the Spark and build

```bash
cd /home/jeff/git
git clone https://github.com/JeffBreugelmans/immersivePortfolio.git
cd immersivePortfolio
npm install
npm run build          # produces dist/ — this is what gets served
```

Re-run `npm run build` after every change (new scenes, code edits) and
restart the service (step 4) to pick it up.

## 2. Set up the static server

```bash
cd /home/jeff/git/immersivePortfolio
python3 -m venv .venv
.venv/bin/pip install -r server/requirements.txt
```

`server/worlds_static.py` is a minimal FastAPI app — no API key, no rate
limiting, just serves `dist/` with sane cache headers (long cache for
Vite's hashed asset filenames, no-cache for `index.html` so redeploys are
picked up immediately).

## 3. Install the systemd service

```bash
sudo cp jeff-worlds.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now jeff-worlds
sudo systemctl status jeff-worlds     # confirm it's active
curl http://localhost:8010/health     # should return {"status":"online"}
```

Bound to `127.0.0.1:8010` — same as Proxie's `main.py` (`127.0.0.1:8000`),
not `0.0.0.0`, since the only intended entry point is via Tailscale Funnel,
not direct LAN/tailnet access.

## 4. Expose it publicly via Tailscale Funnel

**Recommended: its own port, no path routing.** Funnel allows exactly 3
public ports per node: `443`, `8443`, `10000`. Proxie's chat already owns
`443` at the root path. Rather than carving out a `/worlds` subpath on
`443` (which would require rewriting every absolute `/worlds/...` asset
path in `src/manifest.js` and setting a Vite `base`), just claim a second
port outright — zero changes to existing Proxie config, zero changes to
the manifest's asset paths:

```bash
tailscale funnel --bg --https=8443 localhost:8010
tailscale funnel status     # confirm both 443 (Proxie) and 8443 (worlds) are listed
```

The app is then reachable at `https://dgxspark.tail8341fc.ts.net:8443/`.

**Test this against the actual hackathon venue wifi before the demo.**
Conference/corporate networks sometimes block outbound non-standard ports
even when 443 is wide open. If `8443` turns out to be blocked at ASU
California Center:

**Fallback: path-based routing on 443.** This shares the existing port
with Proxie instead of adding a new one:

```bash
tailscale funnel --bg --https=443 --set-path=/worlds localhost:8010
```

This is additive — it does not disturb the existing root (`/`) mapping to
Proxie on port 8000; Tailscale matches the more specific `/worlds` prefix
first. If you go this route, you now need two code changes that the
port-based option above doesn't require:

1. `vite.config.js` — add `base: '/worlds/'` so built asset URLs resolve
   under the subpath.
2. `src/manifest.js` — the `glb` paths are currently absolute
   (`/worlds/afternow/.../scene.glb`); with `base: '/worlds/'` set, either
   change them to relative paths (`worlds/afternow/.../scene.glb`) or
   prefix them with `import.meta.env.BASE_URL`.

Default to the port-based approach and only switch if venue testing shows
it's blocked.

## 5. Proxie chat — CORS check (action needed, not yet done here)

The chat overlay (`src/proxie-chat.js`) calls the existing Cloudflare
Worker (`jeff-avatar-proxy.jeff-d02.workers.dev`), the same one
`chat-block.html` already uses — this reuses the Worker's existing API-key
injection, so no secret needs to live in this frontend.

**What to verify (the Worker's source isn't in this repo, so this couldn't
be checked automatically):** if the Worker enforces an `Origin` allowlist
(likely, given `main.py`'s own CORS whitelist is locked to `jeffxr.com` +
localhost), it needs the new WebXR app's origin added —
`https://dgxspark.tail8341fc.ts.net:8443` (or the venue's actual browser
origin, if different). Without this, the chat overlay's `fetch()` calls
will fail with a CORS error in the browser console even though the Worker
and FastAPI are both healthy. Check the Worker script in your Cloudflare
dashboard (Workers & Pages → jeff-avatar-proxy) for its CORS headers.

## 6. Scene-triggered teleportation — not built yet

Right now Proxie has no way to tell the WebXR app to change scenes — the
`/chat` endpoint only streams `{"token": "..."}` and an optional
`---LINKS---` block (see `avatar-chat/README.md`). `src/proxie-chat.js`
already parses defensively for a proposed `---TELEPORT:<sceneId>---`
marker, but nothing emits it yet. To make Proxie scene-aware:

1. Add a `## SCENE TRANSITIONS` section to `system_prompt.txt` (same
   pattern as the existing "Dynamically Added Knowledge" section) listing
   the scene ids from `src/manifest.js` and instructing the model to
   append `---TELEPORT:<sceneId>---` when a topic clearly maps to one of
   them.
2. No `main.py` code change should be needed — the think-block stripper
   and streaming logic already forward arbitrary trailing text verbatim,
   the same way `---LINKS---` passes through untouched today.

Until this is done, scene changes only happen via in-world portal clicks,
which is a perfectly fine fallback for the demo if this doesn't get built
in time.
