#!/usr/bin/env python3
"""Prototype of scripts/bake-projector-image.mjs (TECH_SPEC.md §F).

Python throwaway to validate the design and produce a preview for Jeff
before committing to the Node production script + exact grid resolution.
"""
import numpy as np
from PIL import Image, ImageEnhance

SRC = "/home/user/immersivePortfolio/planning/reference/cats/profileProjection.jpg"
OUT = "/tmp/claude-0/-home-user-immersivePortfolio/6a203bc4-1693-59ba-bdb0-b0a073d7222c/scratchpad"

GRID = 30           # square grid (source + screen are both 1:1)
LEVELS = 5           # 0..4 brightness steps
BLOCK_PX = 40        # upscale factor for the preview render (nearest-neighbor blocks)
SEED = 7

# Matrix-green mapping from the shader (base + lit * sum/4).
BASE = np.array([0.02, 0.05, 0.03])
LIT = np.array([0.35, 1.0, 0.55])


def load_luminance(path: str, grid: int) -> np.ndarray:
    im = Image.open(path).convert("L")
    # Mild contrast boost -- portraits with soft studio-less lighting
    # otherwise cluster in the middle brightness levels and lose the
    # face's structure once quantized to only 5 steps.
    im = ImageEnhance.Contrast(im).enhance(1.35)
    im = im.resize((grid, grid), Image.LANCZOS)
    return np.asarray(im, dtype=np.float64) / 255.0


def quantize(lum: np.ndarray, levels: int) -> np.ndarray:
    return np.clip(np.round(lum * (levels - 1)), 0, levels - 1).astype(np.uint8)


def bake_masks(levels_grid: np.ndarray, n_channels: int, seed: int) -> np.ndarray:
    """For each cell with target level L, pick L of n_channels at random
    to be 'on'. Returns (H, W, n_channels) uint8 array of 0/1."""
    rng = np.random.default_rng(seed)
    h, w = levels_grid.shape
    masks = np.zeros((h, w, n_channels), dtype=np.uint8)
    for y in range(h):
        for x in range(w):
            n_on = int(levels_grid[y, x])
            if n_on == 0:
                continue
            on_idx = rng.choice(n_channels, size=n_on, replace=False)
            masks[y, x, on_idx] = 1
    return masks


def render(masks: np.ndarray, enabled: list[bool], block_px: int) -> Image.Image:
    h, w, n = masks.shape
    enabled_arr = np.array(enabled, dtype=np.float64)
    total_sum = masks.astype(np.float64) @ enabled_arr  # (H, W)
    frac = total_sum / n  # 0..1
    rgb = BASE[None, None, :] + LIT[None, None, :] * frac[:, :, None]
    rgb = np.clip(rgb, 0, 1)
    img = Image.fromarray((rgb * 255).astype(np.uint8), "RGB")
    return img.resize((w * block_px, h * block_px), Image.NEAREST)


def main() -> None:
    lum = load_luminance(SRC, GRID)
    levels_grid = quantize(lum, LEVELS)
    masks = bake_masks(levels_grid, 4, SEED)

    # Save the packed bit-plane texture itself (R/G/B/A = projector 0-3).
    packed = (masks * 255).astype(np.uint8)
    Image.fromarray(packed, "RGBA" if masks.shape[2] == 4 else "RGB").resize(
        (GRID * 8, GRID * 8), Image.NEAREST
    ).save(f"{OUT}/bake-packed-texture.png")

    stages = [
        ("bake-00-off.png", [False, False, False, False]),
        ("bake-01-one.png", [True, False, False, False]),
        ("bake-02-two.png", [True, True, False, False]),
        ("bake-03-three.png", [True, True, True, False]),
        ("bake-04-all.png", [True, True, True, True]),
    ]
    for name, enabled in stages:
        render(masks, enabled, BLOCK_PX).save(f"{OUT}/{name}")
        print(f"wrote {name} (enabled={enabled})")

    # Side-by-side contact sheet: source (resized) | all-4-on reconstruction.
    src_thumb = Image.open(SRC).convert("RGB").resize((GRID * BLOCK_PX, GRID * BLOCK_PX), Image.LANCZOS)
    recon = render(masks, [True, True, True, True], BLOCK_PX)
    sheet = Image.new("RGB", (src_thumb.width * 2 + 20, src_thumb.height), "white")
    sheet.paste(src_thumb, (0, 0))
    sheet.paste(recon, (src_thumb.width + 20, 0))
    sheet.save(f"{OUT}/bake-compare.png")
    print("wrote bake-compare.png")


if __name__ == "__main__":
    main()
