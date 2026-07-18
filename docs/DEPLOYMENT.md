# Deploying to the Spark

Decision (confirmed): host everything on the DGX Spark, same box as Proxie.
Bandwidth is not a concern -- Sonic fiber tested at 6.8 Gbps down / 7.1 Gbps
up symmetric, so serving 9 scenes' worth of Marble splats is well within
headroom. The remaining risk is uptime (power/ISP/crash during the exact
demo window), not throughput -- worth a quick sanity check the morning of
the demo, not a blocker.

This adds a **second, independent service** alongside Proxie -- it does not
touch `jeff-avatar.service` or `main.py`. If this new service crashes,
Proxie's existing chat keeps working; if Proxie has an issue, the worlds
still load.

## 0. Node version check (new since the IWSDK migration)

The frontend build now requires **Node >= 20.19** (Vite 7 + IWSDK). Check
on the Spark before building:

```bash
node --version    # must be >= 20.19; if older, upgrade via nvm:
# nvm install 22 && nvm alias default 22
```

`npm install` picks up the repo's `.npmrc` (`legacy-peer-deps=true`) --
needed because SparkJS's peer range predates the pinned super-three r181.
Nothing to configure manually; just don't delete `.npmrc`.

## 1. Get the code onto the Spark and build

```bash
cd /home/jeff/git/immersivePortfolio
git pull
npm install
npm run build          # produces dist/ -- this is what gets served
```

Re-run `npm run build` after every change (new scenes, code edits) and
restart the service (step 4) to pick it up.

## 2. Set up the static server

```bash
cd /home/jeff/git/immersivePortfolio
python3 -m venv .venv
.venv/bin/pip install -r server/requirements.txt
```

`server/worlds_static.py` is a minimal FastAPI app -- no API key, no rate
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

Bound to `127.0.0.1:8010` -- same as Proxie's `main.py` (`127.0.0.1:8000`),
not `0.0.0.0`, since the only intended entry point is via Tailscale Funnel,
not direct LAN/tailnet access.

## 4. Expose it publicly via Tailscale Funnel -- path-based on 443

**This is now the default, not the fallback.** Originally this used its own
port (`:8443`) to avoid any ambiguity about path handling. Switched to
path-based routing on 443 for a cleaner URL (`jeffxr.com/worlds` forwards
to `https://dgxspark.tail8341fc.ts.net/worlds` instead of a URL with a
raw port number in it -- see the redirect setup already done in
Squarespace's URL Mappings).

**If `:8443` is currently still running from the earlier setup, turn it off
first:**

```bash
tailscale funnel --https=8443 localhost:8010 off
```

**Then turn on the path-based mount:**

```bash
tailscale funnel --bg --https=443 --set-path=/worlds localhost:8010
tailscale funnel status     # confirm 443 shows both the root (Proxie) and /worlds mappings
```

This is additive on port 443 -- it does not disturb the existing root (`/`)
mapping to Proxie on port 8000; Tailscale matches the more specific
`/worlds` prefix first.

**Verify it's actually working before updating anything else:**

```bash
curl -I https://dgxspark.tail8341fc.ts.net/worlds/
curl -I https://dgxspark.tail8341fc.ts.net/worlds/assets/  # any 2xx/3xx/404 is fine, just not a connection error
```

**Why this required code changes (already made in this repo, nothing left
to do here):** Tailscale's own docs don't clearly state whether
`--set-path` strips the `/worlds` prefix before forwarding to the backend
or keeps the full original path. Rather than gamble on one behavior:

1. `vite.config.ts` sets `base: "/worlds/"`, so the built `index.html`
   references its JS/CSS as `/worlds/assets/...`.
2. `src/manifest.js` builds every `glb` path from
   `import.meta.env.BASE_URL` instead of a hardcoded string, so it
   automatically matches whatever `base` is set to.
3. The `public/worlds/<world>/...` folder structure was flattened to
   `public/<world>/...` (dropped the redundant `worlds` segment) -- it was
   colliding with the new `/worlds` routing prefix and would have produced
   wrong paths under one of the two possible Tailscale behaviors.
4. `server/worlds_static.py` now wraps the app in
   `StripKnownPrefixMiddleware`, which strips a leading `/worlds` from the
   incoming request path if present, and is a no-op if Tailscale already
   stripped it. Verified locally against both cases (simulated by curling
   the dev server with and without a `/worlds` prefix) -- both return
   identical, correct responses. This means it doesn't actually matter
   which way Tailscale behaves; either way the app resolves correctly.

**Local dev note:** with `base: "/worlds/"` set, `npm run dev` now serves
the app at `http://localhost:5173/worlds/`, not the bare root -- the root
path 404s. Open the `/worlds/` path explicitly when testing locally.

## 5. Update the Squarespace redirect

The existing URL Mapping (`Settings > Advanced > URL Mappings` or
`Settings > Developer Tools > URL Mappings` depending on your Squarespace
version) currently points `/worlds` at
`https://dgxspark.tail8341fc.ts.net:8443/`. Update it to:

```
/worlds -> https://dgxspark.tail8341fc.ts.net/worlds 302
```

Kept as a 302 (temporary) rather than 301 -- same reasoning as before, in
case this needs to change again before the final URL is locked in. Test in
an incognito window afterward, since redirects can get cached.

## 6. Proxie chat -- CORS check (resolved)

The chat overlay (`src/proxie-chat.js`) calls the existing Cloudflare
Worker (`jeff-avatar-proxy.jeff-d02.workers.dev`), the same one
`chat-block.html` already uses -- this reuses the Worker's existing API-key
injection, so no secret needs to live in this frontend.

**Resolved -- no action needed.** Checked the Worker's source directly in
the Cloudflare dashboard (Workers & Pages -> jeff-avatar-proxy -> Edit code).
It does not enforce an origin allowlist at all: both the OPTIONS preflight
handler and the actual POST response hardcode
`"Access-Control-Allow-Origin": "*"`. The Worker accepts requests from any
origin, so this was never actually a blocker -- chat already worked from
`jeffxr.com/worlds` without any Worker changes, and works after this URL
switch too, since the Worker doesn't care what origin it's called from.

Separately, `avatar-chat/main.py`'s own CORS whitelist (used for direct
callers of Proxie's API, not the Worker) has also been updated to include
`https://dgxspark.tail8341fc.ts.net` alongside `jeffxr.com` + localhost.

Worth knowing for later: the wildcard `*` is permissive by design or by
oversight -- either way, anyone can call this Worker from any origin as long
as they hit it directly (the `X-API-Key` is what actually gates access, not
CORS). Not a hackathon blocker, but revisit if this ever needs tightening
post-demo.

## 7. Scene-triggered teleportation -- not built yet

Right now Proxie has no way to tell the WebXR app to change scenes -- the
`/chat` endpoint only streams `{"token": "..."}` and an optional
`---LINKS---` block (see `avatar-chat/README.md`). `src/proxie-chat.js`
already parses defensively for a proposed `---TELEPORT:<sceneId>---`
marker, but nothing emits it yet. To make Proxie scene-aware:

1. Add a `## SCENE TRANSITIONS` section to `system_prompt.txt` (same
   pattern as the existing "Dynamically Added Knowledge" section) listing
   the scene ids from `src/manifest.js` and instructing the model to
   append `---TELEPORT:<sceneId>---` when a topic clearly maps to one of
   them.
2. No `main.py` code change should be needed -- the think-block stripper
   and streaming logic already forward arbitrary trailing text verbatim,
   the same way `---LINKS---` passes through untouched today.

Until this is done, scene changes only happen via in-world portal clicks,
which is a perfectly fine fallback for the demo if this doesn't get built
in time.
