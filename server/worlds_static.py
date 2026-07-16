"""
Career World Explorer -- static file server
=============================================
Serves the built Vite app (dist/) plus the Marble GLB assets, matching the
same FastAPI + uvicorn + systemd pattern as avatar-chat/main.py and
awe_proxy.py so it's a familiar deployment shape on the Spark.

This is a separate, minimal app from Proxie's main.py on purpose: it has no
API key, no rate limiting, no chat logic -- it only serves static files.
Proxie itself keeps running unchanged; this just adds a second small
service alongside it.

Run (matches jeff-*.service convention):
    uvicorn worlds_static:app --host 127.0.0.1 --port 8010

Requirements:
    pip install fastapi uvicorn

Before running: build the frontend first (from the repo root, not server/):
    npm install && npm run build
This produces dist/, which is what this app serves.

Path handling note: the app is reached publicly via a path-based Tailscale
Funnel mount at /worlds (see docs/DEPLOYMENT.md), e.g.
tailscale funnel --bg --https=443 --set-path=/worlds localhost:8010
Tailscale's docs don't clearly document whether --set-path strips that
prefix before forwarding to the backend or forwards the full original path.
Rather than gamble on one behavior, StripKnownPrefixMiddleware below
normalizes both cases: it strips a leading "/worlds" if present, and is a
no-op if Tailscale already stripped it. Either way this app only ever sees
root-relative paths, matching Vite's "base": "/worlds/" asset URLs on the
frontend and the un-prefixed physical layout of dist/.
"""

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.responses import FileResponse

REPO_ROOT = Path(__file__).resolve().parent.parent
DIST_DIR = REPO_ROOT / "dist"

MOUNT_PREFIX = "/worlds"


class StripKnownPrefixMiddleware:
    """ASGI middleware: normalize a leading "/worlds" off the request path
    if present, so the rest of the app never has to know or care whether
    Tailscale's path-based Funnel mount forwarded the prefix or stripped
    it. See module docstring for why this exists. Added last (outermost)
    so it runs before routing sees the request."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            path = scope.get("path", "")
            if path == MOUNT_PREFIX:
                scope["path"] = "/"
            elif path.startswith(MOUNT_PREFIX + "/"):
                scope["path"] = path[len(MOUNT_PREFIX):]
        await self.app(scope, receive, send)


class CachedStaticFiles(StaticFiles):
    """Long cache for hashed Vite asset filenames, no-cache for index.html
    so a redeploy is picked up immediately instead of being stuck behind a
    stale cached shell page."""

    async def get_response(self, path: str, scope) -> FileResponse:
        response = await super().get_response(path, scope)
        if path == "index.html" or path == "":
            response.headers["Cache-Control"] = "no-cache"
        else:
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return response


app = FastAPI(title="Career World Explorer -- static host", docs_url=None, redoc_url=None)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(StripKnownPrefixMiddleware)


@app.get("/health")
async def health():
    return {"status": "online" if DIST_DIR.exists() else "missing dist/ -- run npm run build"}


if not DIST_DIR.exists():
    raise RuntimeError(
        f"dist/ not found at {DIST_DIR}. Run `npm install && npm run build` in the repo root first."
    )

# html=True serves index.html for unmatched paths -- needed since this is a
# single-page app that swaps scenes client-side rather than doing real
# multi-page routing.
app.mount("/", CachedStaticFiles(directory=str(DIST_DIR), html=True), name="static")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("worlds_static:app", host="127.0.0.1", port=8010, reload=False, log_level="info")
