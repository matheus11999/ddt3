"""Cuts the Codex sheet of the POW ready aura (src/game/powReadyAura.ts) into the game strip.

Source: public/assets/combat/source/pow-ready-aura-gold.png, a 3x2 grid of looping frames painted on flat black around
the green silhouette of the lying fighter (pow-ready-silhouette.png, the fighter drawn 2.6x at x=256 with its feet at
y=452 of each 512 px cell; the Codex prompt is next to it). Light is drawn on black: the green and the black become
transparent, the colour is un-premultiplied so the painting keeps its glow on any background, and every frame is moved
so its own silhouette sits where the template's does (the painter drifts a little per cell).
Run: py scripts/build-pow-aura.py
"""
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'public/assets/combat/source'
SHEET = SRC / 'pow-ready-aura-gold.png'
SILHOUETTE = SRC / 'pow-ready-silhouette.png'
OUT = ROOT / 'public/assets/combat/pow-ready-aura-gold.png'
COLS, ROWS, SIZE = 3, 2, 256

def green(img: Image.Image) -> np.ndarray:
    a = np.asarray(img.convert('RGB')).astype(np.int16)
    return (a[..., 1] > 150) & (a[..., 1] > a[..., 0] + 60) & (a[..., 1] > a[..., 2] + 60)

def unblack(img: Image.Image) -> Image.Image:
    a = np.asarray(img.convert('RGB')).copy()
    a[green(img)] = 0
    a = a.astype(np.float32) / 255.0
    # Near-black noise of the painted background goes fully clear.
    alpha = np.clip((a.max(axis=2) - .035) / .965, 0, 1)
    rgb = np.where(alpha[..., None] > 0, np.clip(a / np.maximum(alpha[..., None], 1e-3), 0, 1), 0)
    return Image.fromarray((np.dstack([rgb, alpha[..., None]]) * 255).round().astype(np.uint8), 'RGBA')

sheet = Image.open(SHEET)
cw, ch = sheet.width // COLS, sheet.height // ROWS
ty, tx = (v.mean() for v in np.nonzero(green(Image.open(SILHOUETTE).crop((0, 0, cw, ch)))))
strip = Image.new('RGBA', (SIZE * COLS * ROWS, SIZE))
for i in range(COLS * ROWS):
    col, row = i % COLS, i // COLS
    crop = sheet.crop((col * cw, row * ch, (col + 1) * cw, (row + 1) * ch))
    ys, xs = np.nonzero(green(crop))
    cx, cy = cw // 2 + int(round(xs.mean() - tx)), ch // 2 + int(round(ys.mean() - ty))
    side = min(cw, ch)
    cell = unblack(crop).crop((cx - side // 2, cy - side // 2, cx + side // 2, cy + side // 2)).resize((SIZE, SIZE), Image.LANCZOS)
    strip.paste(cell, (i * SIZE, 0))
strip.save(OUT, optimize=True)
print(f'{OUT.relative_to(ROOT)}: {COLS * ROWS} frames of {SIZE}px')
