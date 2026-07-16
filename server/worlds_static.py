"""
Career World Explorer — static file server
===========================================
Serves the built Vite app (dist/) plus the Marble GLB assets, matching the
same FastAPI + uvicorn + systemd pattern as avatar-chat/main.py and
awe_proxy.py so it's a familiar deployment shape on the Spark.

This is a separate, minimal app from Proxie's main.py on purpose: it has no
API key, no rate limiting, no chat logic — it only serves static files.
Proxie itself keeps running unchanged; this just adds a second small
service alongside it.

Run (matches jeff-*.service convention):
    uvicorn worlds_static:app --host 127.0.0.1 --port 8010

Requirements:
    pip install fastapi uvicorn

Before running: build the frontend first (from the repo root, not server/):
    npm install && npm run build
This produces dist/, which is what this app serves.
"""

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.responses import FileResponse
from starlette.requests import Request

REPO_ROOT = Path(__file__).resolve().parent.parent
DIST_DIR = REPO_ROOT / "dist"

app = FastAPI(title="Career World Explorer — static host", docs_url=None, redoc_url=None)
app.add_middleware(GZipMiddleware, minimum_size=1000)


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


@app.get("/health")
async def health():
    return {"status": "online" if DIST_DIR.exists() else "missing dist/ — run npm run build"}


if not DIST_DIR.exists():
    raise RuntimeError(
        f"dist/ not found at {DIST_DIR}. Run `npm install && npm run build` in the repo root first."
    )

# html=True serves index.html for unmatched paths — needed since this is a
# single-page app that swaps scenes client-side rather than doing real
# multi-page routing.
app.mount("/", CachedStaticFiles(directory=str(DIST_DIR), html=True), name="static")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("worlds_static:app", host="127.0.0.1", port=8010, reload=False, log_level="info")
